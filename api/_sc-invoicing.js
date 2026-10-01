// Monthly Support Coordination invoicing. Not a route (Vercel skips "_"
// files). Run at 8am Brisbane on the 1st of every month by the cron
// (/api/sc-monthly-invoice-draft -> xero?action=sc-monthly), for the month
// just gone — as the Core run does every Monday for the week just gone. See
// docs/invoicing.md.
//
// Each client in sc_invoice_clients (Command Centre -> Invoicing -> Support
// Coordination) is billed for the 1st of the month to their end day, e.g.
// 01/09/2026 - 21/09/2026, copying their settings exactly:
//   line = "<period>\n" + description, quantity = hours, price = rate table.
// The draft is dated the 1st it's made on. A client is left alone, and
// listed for the office, when they're on hold (hold_reason), their settings
// are incomplete, or their plan has ended. A period already invoiced in
// Xero — by this run or by hand — is never drafted again.
const { xeroApiFetch } = require('./_xero');
const { rest, selectMany, insertOne } = require('./_lib/supabase');
const { dmy, findContact, xeroLink } = require('./_invoicing');
const { findExisting, draftBody, saveDraft, withRetry } = require('./_xero-drafts');

const pad = (n) => String(n).padStart(2, '0');

/** Today in Brisbane (no daylight saving: fixed +10:00). */
function brisbaneToday(now = Date.now()) {
  return new Date(now + 10 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** The month before `today`'s, as { start, end } of a client's period in it.
 * An end day past the month's last day (e.g. 30 in February) is the last day. */
function periodFor(client, today) {
  const [y, m] = today.split('-').map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const daysInMonth = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const endDay = Math.min(Number(client.end_day), daysInMonth);
  return { start: `${py}-${pad(pm)}-01`, end: `${py}-${pad(pm)}-${pad(endDay)}`, shortened: endDay !== Number(client.end_day) };
}

async function recordedDraft(clientId, start) {
  const rows = await selectMany('sc_invoice_drafts', `client_id=eq.${clientId}&period_start=eq.${start}`);
  const row = rows[0];
  if (!row) return null;
  const body = row.xero_invoice_id
    ? await withRetry(() => xeroApiFetch(`/Invoices/${encodeURIComponent(row.xero_invoice_id)}`))
    : null;
  const inv = body && body.Invoices && body.Invoices[0];
  if (inv && inv.Status !== 'DELETED' && inv.Status !== 'VOIDED') return { number: row.xero_invoice_number, status: inv.Status };
  // Deleted in Xero: forget it so the month can be drafted again.
  await rest(`/sc_invoice_drafts?id=eq.${row.id}`, { method: 'DELETE' });
  return null;
}

/**
 * Drafts every active client's invoice for the month before `today` that
 * isn't invoiced yet, dated `today`. Options: today (YYYY-MM-DD, default
 * Brisbane today), clientIds (only these), dryRun (build only, nothing
 * written). Returns { today, results: [...] } — one entry per active client.
 */
async function runScMonth({ today = brisbaneToday(), clientIds = null, dryRun = false } = {}) {
  const [clients, rates] = await Promise.all([
    selectMany('sc_invoice_clients', 'active=eq.true&order=name.asc'),
    selectMany('invoice_rates', 'order=code.asc', 'code,rate'),
  ]);
  const rateOf = new Map(rates.map((r) => [r.code, Number(r.rate)]));
  // Every client's reference, by plan manager: an invoice carrying another
  // client's reference is that client's, even when it names the same person.
  const allClients = await selectMany('sc_invoice_clients', 'order=name.asc', 'reference,xero_contact_name');
  const refsByContact = new Map();
  for (const x of allClients) {
    const key = String(x.xero_contact_name || '').trim().toLowerCase();
    if (!refsByContact.has(key)) refsByContact.set(key, []);
    refsByContact.get(key).push(x.reference);
  }
  const results = [];
  // Many clients share a plan manager: look each one up in Xero once per run
  // (Xero allows 60 calls a minute).
  const contacts = new Map();
  const invoiceCache = new Map();
  const contactFor = async (name) => {
    if (!contacts.has(name)) contacts.set(name, await withRetry(() => findContact(name)));
    return contacts.get(name);
  };

  for (const c of clients) {
    if (clientIds && !clientIds.includes(c.id)) continue;
    const base = { id: c.id, name: c.name, reference: c.reference, contactName: c.xero_contact_name, flags: [] };
    try {
      if (!c.end_day) {
        results.push({ ...base, problem: 'No period end day set' });
        continue;
      }
      const p = periodFor(c, today);
      Object.assign(base, { periodStart: p.start, periodEnd: p.end });
      if (c.hold_reason) {
        results.push({ ...base, held: c.hold_reason });
        continue;
      }
      const missing = [
        !c.xero_contact_name && 'plan manager',
        !(Number(c.hours) > 0) && 'hours',
        !c.description && 'description',
        !rateOf.has(c.rate_code) && `a price for ${c.rate_code}`,
      ].filter(Boolean);
      if (missing.length) {
        results.push({ ...base, problem: `Settings missing: ${missing.join(', ')}` });
        continue;
      }
      if (c.plan_end && c.plan_end < p.start) {
        results.push({ ...base, problem: `Plan ended ${dmy(c.plan_end)} — update the plan end date or pause them` });
        continue;
      }
      if (c.plan_end && c.plan_end <= p.end) base.flags.push(`Plan ends ${dmy(c.plan_end)}, inside this period`);
      else if (c.plan_end && Date.parse(c.plan_end) - Date.parse(today) < 45 * 86400000) base.flags.push(`Plan ends ${dmy(c.plan_end)}`);
      if (p.shortened) base.flags.push(`Period ends ${dmy(p.end)}, the last day of the month (their usual end day is day ${c.end_day})`);

      const recorded = await recordedDraft(c.id, p.start);
      if (recorded) {
        results.push({ ...base, done: `already drafted (${recorded.number}, ${recorded.status})` });
        continue;
      }
      const contact = await contactFor(c.xero_contact_name);
      if (!contact) {
        results.push({ ...base, problem: `No active Xero contact called "${c.xero_contact_name}"` });
        continue;
      }
      const invoiceName = c.description.split('\n')[0];
      const existing = await findExisting({
        contactId: contact.ContactID,
        starts: new Set([p.start]),
        reference: c.reference,
        names: [invoiceName, c.name],
        otherReferences: refsByContact.get(String(c.xero_contact_name || '').trim().toLowerCase()) || [],
        cache: invoiceCache,
      });
      if (existing.length) {
        results.push({ ...base, done: `already invoiced (${existing.map((e) => `${e.number} ${e.status}`).join(', ')})` });
        continue;
      }

      const line = {
        description: `${dmy(p.start)} - ${dmy(p.end)}\n${c.description}`,
        quantity: Number(c.hours),
        unitAmount: rateOf.get(c.rate_code),
      };
      const total = Math.round(line.quantity * line.unitAmount * 100) / 100;
      const invoice = await draftBody({ contactId: contact.ContactID, reference: c.reference, date: today, lines: [line] });
      if (dryRun) {
        results.push({ ...base, total, wouldCreate: { contact: contact.Name, line } });
        continue;
      }
      const saved = await saveDraft(invoice);
      await insertOne('sc_invoice_drafts', {
        client_id: c.id,
        period_start: p.start,
        period_end: p.end,
        invoice_date: today,
        xero_invoice_id: saved.invoiceId,
        xero_invoice_number: saved.invoiceNumber,
        total: saved.total,
      });
      results.push({ ...base, total: saved.total, invoiceId: saved.invoiceId, invoiceNumber: saved.invoiceNumber, link: xeroLink(saved.invoiceId) });
    } catch (err) {
      console.error('sc invoice failed:', c.name, err.message);
      results.push({ ...base, problem: err.message });
    }
  }
  return { today, results };
}

module.exports = { brisbaneToday, periodFor, runScMonth };
