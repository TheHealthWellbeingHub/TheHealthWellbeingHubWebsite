// Monthly Support Coordination invoicing. Not a route (Vercel skips "_"
// files). Run every morning by the cron (/api/sc-monthly-invoice-draft ->
// xero?action=sc-monthly); see docs/invoicing.md.
//
// Each client in sc_invoice_clients (Command Centre -> Invoicing -> Support
// Coordination) is billed once a month for the period from the 1st to their
// end day, e.g. 01/09/2026 - 21/09/2026. The morning after the end day, their
// invoice is drafted in Xero, dated that day, copying their settings exactly:
//   line = "<period>\n" + description, quantity = hours, price = rate table.
// A client is left alone, and listed for the office, when they're on hold
// (hold_reason), their settings are incomplete, or their plan has ended.
// A period already invoiced in Xero — by this run or by hand — is never
// drafted again.
const { xeroApiFetch } = require('./_xero');
const { rest, selectMany, insertOne } = require('./_lib/supabase');
const { dmy, findContact, xeroLink } = require('./_invoicing');
const { findExisting, draftBody, saveDraft } = require('./_xero-drafts');

const pad = (n) => String(n).padStart(2, '0');

/** Today in Brisbane (no daylight saving: fixed +10:00). */
function brisbaneToday(now = Date.now()) {
  return new Date(now + 10 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * This month's period for a client, and whether it has ended. The end day is
 * held one short of the month's last day (so a 28th end is the 27th in
 * February) so the invoice is still drafted inside the month it covers.
 */
function periodFor(client, today) {
  const [y, m, d] = today.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endDay = Math.min(Number(client.end_day), daysInMonth - 1);
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(endDay)}`,
    due: d > endDay,
    firstDay: d === endDay + 1,
    shortened: endDay !== Number(client.end_day),
  };
}

async function recordedDraft(clientId, start) {
  const rows = await selectMany('sc_invoice_drafts', `client_id=eq.${clientId}&period_start=eq.${start}`);
  const row = rows[0];
  if (!row) return null;
  const body = row.xero_invoice_id
    ? await xeroApiFetch(`/Invoices/${encodeURIComponent(row.xero_invoice_id)}`).catch(() => null)
    : null;
  const inv = body && body.Invoices && body.Invoices[0];
  if (inv && inv.Status !== 'DELETED' && inv.Status !== 'VOIDED') return { number: row.xero_invoice_number, status: inv.Status };
  // Deleted in Xero: forget it so the month can be drafted again.
  await rest(`/sc_invoice_drafts?id=eq.${row.id}`, { method: 'DELETE' });
  return null;
}

/**
 * Drafts every active client whose period has ended this month and isn't
 * invoiced yet. Options: today (YYYY-MM-DD, default Brisbane today),
 * clientIds (only these), dryRun (build only, nothing written).
 * Returns { today, results: [...] } — one entry per active client.
 */
async function runScMonth({ today = brisbaneToday(), clientIds = null, dryRun = false } = {}) {
  const [clients, rates] = await Promise.all([
    selectMany('sc_invoice_clients', 'active=eq.true&order=name.asc'),
    selectMany('invoice_rates', 'order=code.asc', 'code,rate'),
  ]);
  const rateOf = new Map(rates.map((r) => [r.code, Number(r.rate)]));
  const results = [];

  for (const c of clients) {
    if (clientIds && !clientIds.includes(c.id)) continue;
    const base = { id: c.id, name: c.name, reference: c.reference, contactName: c.xero_contact_name, flags: [] };
    try {
      if (!c.end_day) {
        results.push({ ...base, due: true, firstDay: true, problem: 'No period end day set' });
        continue;
      }
      const p = periodFor(c, today);
      Object.assign(base, { periodStart: p.start, periodEnd: p.end, due: p.due, firstDay: p.firstDay });
      if (!p.due) {
        results.push({ ...base, waiting: `due after ${dmy(p.end)}` });
        continue;
      }
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
      if (p.shortened) base.flags.push(`Period ends ${dmy(p.end)} (their usual end day doesn't fit this month)`);

      const recorded = await recordedDraft(c.id, p.start);
      if (recorded) {
        results.push({ ...base, done: `already drafted (${recorded.number}, ${recorded.status})` });
        continue;
      }
      const contact = await findContact(c.xero_contact_name);
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
        xero_invoice_id: saved.invoiceId,
        xero_invoice_number: saved.invoiceNumber,
        total: saved.total,
      });
      results.push({ ...base, total: saved.total, invoiceId: saved.invoiceId, invoiceNumber: saved.invoiceNumber, link: xeroLink(saved.invoiceId) });
    } catch (err) {
      console.error('sc invoice failed:', c.name, err.message);
      results.push({ ...base, due: true, firstDay: true, problem: err.message });
    }
  }
  return { today, results };
}

module.exports = { brisbaneToday, periodFor, runScMonth };
