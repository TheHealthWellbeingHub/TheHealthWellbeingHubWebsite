// Weekly ShiftCare -> Xero invoicing. Not a route itself (Vercel skips "_"
// files). Used by weekly-invoice-draft.js (the Monday cron, all participants)
// and the xero?action=create-invoice action (one participant, on demand).
//
// One invoice per participant per Monday-Sunday week, laid out the way H&W
// invoices by hand (see docs/invoicing.md):
//   - hours come from the ROSTER (ShiftCare shifts), not clock-ins — most
//     workers forget to clock in. Each worker on a shift counts, so two
//     workers for 8 hours is 16 hours.
//   - weekday, Saturday and Sunday hours are separate lines, each with the
//     participant's own support item; kilometres are one travel line, the
//     sum of the workers' "carer mileage" entries (progress notes, category
//     mileage) on that participant's shifts.
//   - rates come from the invoice_rates table (the NDIS price guide), not
//     ShiftCare's price book.
//   - who it goes to (the plan manager), the reference and the support items
//     come from the invoice_participants table, edited in the Command Centre.
// Invoices are only ever created as DRAFT. A person approves and sends them.
const { shiftcareApiFetch } = require('./_shiftcare');
const { xeroApiFetch } = require('./_xero');
const { rest, selectMany, insertOne } = require('./_lib/supabase');

const ACCOUNT_CODE = process.env.INVOICE_ACCOUNT_CODE || '201';
const TAX_RATE_NAME = process.env.INVOICE_TAX_RATE_NAME || 'GST Free Income';
const BRANDING_THEME_NAME = process.env.INVOICE_BRANDING_THEME || 'Standard';

// ---- dates (Brisbane has no daylight saving: fixed +10:00) --------------

function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday-Sunday week before the current one, in Brisbane time. */
function lastWeek(now = Date.now()) {
  const today = new Date(now + 10 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const thisMonday = addDays(today, dow === 0 ? -6 : 1 - dow);
  return { start: addDays(thisMonday, -7), end: addDays(thisMonday, -1) };
}

function dmy(ymd) {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function dateRangeText(dates) {
  const sorted = [...new Set(dates)].sort();
  if (!sorted.length) return '';
  return sorted.length === 1 ? dmy(sorted[0]) : `${dmy(sorted[0])} - ${dmy(sorted[sorted.length - 1])}`;
}

function dayType(ymd) {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  if (dow === 6) return 'saturday';
  if (dow === 0) return 'sunday';
  return 'weekday';
}

const round2 = (n) => Math.round(n * 100) / 100;

// ---- ShiftCare ----------------------------------------------------------

async function pagedShiftcare(pathname, params, key) {
  const out = [];
  for (let page = 1; page <= 50; page += 1) {
    const body = await shiftcareApiFetch(pathname, { ...params, page, per_page: 20, include_metadata: true });
    const rows = body[key] || [];
    out.push(...rows);
    const totalPages = Number(body._metadata && body._metadata.total_pages) || 1;
    if (page >= totalPages || rows.length === 0) break;
  }
  return out;
}

async function shiftStaffCount(shift) {
  if (Array.isArray(shift.staff) && shift.staff.length) return shift.staff.length;
  const body = await shiftcareApiFetch(`/api/v3/shifts/${encodeURIComponent(shift.id)}/staffs`, { per_page: 20 });
  return (body.staffs || []).length;
}

async function weekShifts(start, end) {
  return pagedShiftcare(
    '/api/v3/shifts',
    { from_date: start, to_date: end, include_clients: true, include_staff: true, time_zone: 'account' },
    'shifts'
  );
}

// Workers log kilometres as a progress note in the "mileage" category:
// "Added carer mileage of 102 ...". Notes can be written days after the
// shift, so they're found by the shift's date, not the note's.
async function weekMileageNotes(start, end) {
  const createdFrom = `${addDays(start, -14)}T00:00:00Z`;
  return pagedShiftcare(
    '/api/v3/progress_notes',
    { category: ['mileage'], created_from: createdFrom, shift_date_from: start, shift_date_to: end, time_zone: 'account' },
    'progress_notes'
  );
}

function carerKm(note) {
  const m = /carer mileage of\s+([\d.]+)/i.exec(note.message || '');
  return m ? Number(m[1]) : 0;
}

// ---- Supabase settings --------------------------------------------------

async function loadSettings() {
  const [participants, rates] = await Promise.all([
    selectMany('invoice_participants', 'active=eq.true'),
    selectMany('invoice_rates', 'order=code.asc'),
  ]);
  const ids = participants.map((p) => p.shiftcare_client_id);
  const ndis = ids.length
    ? await selectMany(
        'participants',
        `shiftcare_client_id=in.(${ids.map(encodeURIComponent).join(',')})`,
        'shiftcare_client_id,ndis_number'
      )
    : [];
  return {
    participants,
    rates: new Map(rates.map((r) => [r.code, Number(r.rate)])),
    ndisById: new Map(ndis.map((r) => [String(r.shiftcare_client_id), r.ndis_number])),
  };
}

// ---- building -----------------------------------------------------------

/** Builds (never sends) each participant's invoice for the week. */
async function buildWeek({ start, end, clientIds = null }) {
  const [settings, shifts, notes] = await Promise.all([loadSettings(), weekShifts(start, end), weekMileageNotes(start, end)]);

  // A worker who enters mileage again for the same shift is correcting it:
  // only their LATEST entry counts. (Two workers on one shift each have
  // their own entry, and both count.)
  const latest = new Map(); // "shiftId|staffId" -> note
  for (const n of notes) {
    if (!n.shift_id) continue;
    const key = `${n.shift_id}|${(n.staff && n.staff.id) || ''}`;
    const prev = latest.get(key);
    if (!prev || Date.parse(n.created_at) > Date.parse(prev.created_at)) latest.set(key, n);
  }
  const kmByShift = new Map(); // shiftId -> { km, replaced: [km, ...] }
  for (const n of notes) {
    if (!n.shift_id) continue;
    const key = `${n.shift_id}|${(n.staff && n.staff.id) || ''}`;
    const entry = kmByShift.get(String(n.shift_id)) || { km: 0, replaced: [] };
    if (latest.get(key) === n) entry.km += carerKm(n);
    else entry.replaced.push(carerKm(n));
    kmByShift.set(String(n.shift_id), entry);
  }

  // Shifts per client, and who had shifts but isn't set up for invoicing.
  const byClient = new Map();
  const names = new Map();
  for (const s of shifts) {
    for (const c of s.clients || []) {
      const id = String(c.id);
      if (!byClient.has(id)) byClient.set(id, []);
      byClient.get(id).push({ shift: s, client: c });
      names.set(id, [c.first_name, c.family_name].filter(Boolean).join(' '));
    }
  }
  const setUp = new Set(settings.participants.map((p) => p.shiftcare_client_id));
  const notSetUp = [...byClient.keys()]
    .filter((id) => !setUp.has(id) && !(clientIds && !clientIds.includes(id)))
    .map((id) => ({ clientId: id, name: names.get(id) || id, shiftCount: byClient.get(id).length }));

  const invoices = [];
  for (const p of settings.participants) {
    if (clientIds && !clientIds.includes(p.shiftcare_client_id)) continue;
    const entries = byClient.get(p.shiftcare_client_id) || [];
    const flags = [];
    const groups = { weekday: { hours: 0, dates: [] }, saturday: { hours: 0, dates: [] }, sunday: { hours: 0, dates: [] } };
    const billedDates = [];
    const countedShifts = new Set();
    let km = 0;

    for (const { shift, client } of entries) {
      const date = String(shift.start_at).slice(0, 10);
      if (shift.cancelled_at && !client.absent_reason) continue; // cancelled without charge
      if (shift.cancelled_at) flags.push(`${dmy(date)}: cancelled by the client (${client.absent_reason}) — billed`);
      const workers = await shiftStaffCount(shift);
      if (!workers) {
        flags.push(`${dmy(date)}: shift has no worker assigned — not billed`);
        continue;
      }
      if (shift.sleepover || (shift.shift_type && shift.shift_type !== 'standard')) {
        flags.push(`${dmy(date)}: ${shift.sleepover ? 'sleepover' : shift.shift_type} shift — billed as ordinary hours, check it`);
      }
      if ((shift.clients || []).length > 1) flags.push(`${dmy(date)}: shared shift (${shift.clients.length} participants) — check hours and km`);
      const hours = (Date.parse(shift.end_at) - Date.parse(shift.start_at)) / 3600000 - (Number(shift.break_time) || 0) / 60;
      const type = dayType(date);
      const endsLocal = String(shift.end_at).slice(11, 16);
      if (type === 'weekday' && (endsLocal > '20:00' || String(shift.end_at).slice(0, 10) !== date)) {
        flags.push(`${dmy(date)}: shift runs past 8pm — billed at the weekday daytime rate, check it`);
      }
      groups[type].hours += hours * workers;
      groups[type].dates.push(date);
      billedDates.push(date);
      const kms = kmByShift.get(String(shift.id));
      if (kms && !countedShifts.has(String(shift.id))) {
        countedShifts.add(String(shift.id));
        km += kms.km;
        if (kms.replaced.length) {
          flags.push(`${dmy(date)}: mileage entered more than once — used the latest entry, left out ${kms.replaced.join(' + ')} km`);
        }
      }
    }

    const ndis = settings.ndisById.get(p.shiftcare_client_id);
    if (!ndis) flags.push('No NDIS number in the Command Centre — add it to the participant');
    const header = (dates) => `${dateRangeText(dates)}\n${p.invoice_name}\n${p.ndis_label}: ${ndis || 'MISSING'}`;

    const lines = [];
    const addLine = (label, code, text, qty, dates) => {
      if (!(qty > 0)) return;
      if (!code) {
        flags.push(`${qty} ${label} with no support item set — not on the invoice`);
        return;
      }
      const rate = settings.rates.get(code);
      if (rate === undefined) {
        flags.push(`No rate for ${code} in the rate table — ${label} not on the invoice`);
        return;
      }
      lines.push({ code, description: `${header(dates)}\n${text || code}`, quantity: round2(qty), rate, amount: round2(round2(qty) * rate) });
    };
    addLine('weekday hours', p.weekday_code, p.weekday_text, groups.weekday.hours, groups.weekday.dates);
    addLine('Saturday hours', p.saturday_code, p.saturday_text, groups.saturday.hours, groups.saturday.dates);
    addLine('Sunday hours', p.sunday_code, p.sunday_text, groups.sunday.hours, groups.sunday.dates);
    addLine('km', p.travel_code, p.travel_text, km, billedDates);
    if (billedDates.length && km === 0 && p.travel_code) flags.push('No mileage entered by workers this week');

    invoices.push({
      clientId: p.shiftcare_client_id,
      name: p.invoice_name,
      reference: p.reference,
      contactName: p.xero_contact_name,
      lines,
      total: round2(lines.reduce((sum, l) => sum + l.amount, 0)),
      flags: [...new Set(flags)],
    });
  }
  return { period: { start, end, issueDate: addDays(end, 1) }, invoices, notSetUp };
}

// ---- Xero ---------------------------------------------------------------

let xeroLookups = null;
async function xeroSetup() {
  if (xeroLookups) return xeroLookups;
  const [themes, taxRates] = await Promise.all([xeroApiFetch('/BrandingThemes'), xeroApiFetch('/TaxRates')]);
  const theme = (themes.BrandingThemes || []).find((t) => t.Name === BRANDING_THEME_NAME);
  const tax = (taxRates.TaxRates || []).find((t) => t.Name === TAX_RATE_NAME && t.Status === 'ACTIVE');
  if (!tax) throw new Error(`No active Xero tax rate called "${TAX_RATE_NAME}"`);
  xeroLookups = { brandingThemeId: theme ? theme.BrandingThemeID : null, taxType: tax.TaxType };
  return xeroLookups;
}

async function findContact(name) {
  const where = `Name=="${name.replace(/"/g, '\\"')}"`;
  const body = await xeroApiFetch(`/Contacts?where=${encodeURIComponent(where)}`);
  const active = (body.Contacts || []).filter((c) => c.ContactStatus === 'ACTIVE');
  return active[0] || null;
}

/** An earlier draft for the same participant and week that still exists. */
async function existingDraft(clientId, periodStart) {
  const rows = await selectMany(
    'invoice_drafts',
    `shiftcare_client_id=eq.${encodeURIComponent(clientId)}&period_start=eq.${periodStart}`
  );
  const row = rows[0];
  if (!row) return null;
  if (row.xero_invoice_id) {
    const body = await xeroApiFetch(`/Invoices/${encodeURIComponent(row.xero_invoice_id)}`).catch(() => null);
    const inv = body && body.Invoices && body.Invoices[0];
    if (inv && inv.Status !== 'DELETED' && inv.Status !== 'VOIDED') return { ...row, status: inv.Status };
  }
  // Deleted in Xero (or never made): forget it so the week can be drafted again.
  await rest(`/invoice_drafts?id=eq.${row.id}`, { method: 'DELETE' });
  return null;
}

/** Creates one DRAFT invoice in Xero. Returns { invoiceId, invoiceNumber, total } or { skipped }.
 * With { replace: true }, a week that already has a DRAFT is rebuilt in
 * place (same invoice number); an approved or paid one is never touched. */
async function createDraft(invoice, period, { replace = false } = {}) {
  if (!invoice.lines.length) return { skipped: 'nothing to invoice' };
  const earlier = await existingDraft(invoice.clientId, period.start);
  if (earlier && !(replace && earlier.status === 'DRAFT')) {
    return { skipped: `already drafted (${earlier.xero_invoice_number || earlier.xero_invoice_id}, ${earlier.status})`, invoiceId: earlier.xero_invoice_id };
  }

  const contact = await findContact(invoice.contactName);
  if (!contact) return { skipped: `no active Xero contact called "${invoice.contactName}"` };
  const { brandingThemeId, taxType } = await xeroSetup();

  const body = await xeroApiFetch('/Invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Invoices: [
        {
          // Updating by InvoiceID replaces the draft's lines with these.
          ...(earlier ? { InvoiceID: earlier.xero_invoice_id } : {}),
          Type: 'ACCREC',
          Contact: { ContactID: contact.ContactID },
          Date: period.issueDate,
          DueDate: period.issueDate,
          Reference: invoice.reference,
          ...(brandingThemeId ? { BrandingThemeID: brandingThemeId } : {}),
          LineAmountTypes: 'Exclusive',
          Status: 'DRAFT',
          // No InvoiceNumber: Xero gives the next one in the sequence.
          LineItems: invoice.lines.map((l) => ({
            Description: l.description,
            Quantity: l.quantity,
            UnitAmount: l.rate,
            AccountCode: ACCOUNT_CODE,
            TaxType: taxType,
          })),
        },
      ],
    }),
  });
  const created = body.Invoices && body.Invoices[0];
  if (!created || created.HasErrors) {
    const errors = (created && created.ValidationErrors || []).map((e) => e.Message).join('; ');
    throw new Error(`Xero didn't create the invoice for ${invoice.name}${errors ? `: ${errors}` : ''}`);
  }
  if (earlier) {
    await rest(`/invoice_drafts?id=eq.${earlier.id}`, { method: 'PATCH', body: JSON.stringify({ total: created.Total }) });
  } else {
    await insertOne('invoice_drafts', {
      shiftcare_client_id: invoice.clientId,
      period_start: period.start,
      period_end: period.end,
      xero_invoice_id: created.InvoiceID,
      xero_invoice_number: created.InvoiceNumber,
      total: created.Total,
    });
  }
  return { invoiceId: created.InvoiceID, invoiceNumber: created.InvoiceNumber, total: created.Total, replaced: Boolean(earlier) };
}

function xeroLink(invoiceId) {
  return `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${invoiceId}`;
}

module.exports = { lastWeek, addDays, buildWeek, createDraft, xeroLink };
