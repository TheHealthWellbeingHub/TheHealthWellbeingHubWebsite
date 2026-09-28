// Weekly invoicing — runs every Monday 8am Brisbane (vercel.json cron,
// Sunday 22:00 UTC). For the Monday-Sunday week just gone it builds each
// participant's invoice from ShiftCare (api/_invoicing.js), saves it in Xero
// as a DRAFT dated today, and emails the office the list to check. Nothing
// is sent to a plan manager: staff open each draft in Xero, check it, and
// approve and send it themselves. Running it twice for the same week does
// not create a second invoice.
//
// GET, Authorization: Bearer <CRON_SECRET> (Vercel Cron) or <XERO_STATUS_TOKEN>.
// Query: start & end (YYYY-MM-DD, default last week), clientId (one or more,
// comma-separated ShiftCare client IDs), dryRun=1 (build and return only:
// nothing written to Xero, nothing emailed).
const { isConfigured: shiftcareConfigured } = require('./_shiftcare');
const { isConfigured: xeroConfigured, tokenMatches } = require('./_xero');
const { isConfigured: mailConfigured, sendEmail } = require('./_mail');
const { isConfigured: supabaseConfigured } = require('./_lib/supabase');
const { lastWeek, buildWeek, createDraft, xeroLink } = require('./_invoicing');

const CRON_SECRET = process.env.CRON_SECRET || '';
const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';
const ADMIN_EMAIL = process.env.INVOICE_DRAFT_EMAIL || 'officethehealthwellbeinghub@gmail.com';

const money = (n) => `$${Number(n).toFixed(2)}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function summaryEmail(period, results, notSetUp) {
  const made = results.filter((r) => r.invoiceNumber && !r.skipped);
  const total = made.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const rows = results.map((r) => {
    const status = r.error
      ? `<b style="color:#a8323a">Not created: ${esc(r.error)}</b>`
      : r.skipped
        ? `Not created: ${esc(r.skipped)}`
        : `<a href="${xeroLink(r.invoiceId)}">${esc(r.invoiceNumber)}</a> — draft`;
    const flags = r.flags.length ? `<ul style="margin:4px 0 0;color:#9a5a00">${r.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
    return `<tr><td style="padding:8px;border-bottom:1px solid #e2d9e6;vertical-align:top"><b>${esc(r.name)}</b><br>${esc(r.reference)} · ${esc(r.contactName)}${flags}</td>
      <td style="padding:8px;border-bottom:1px solid #e2d9e6;vertical-align:top;text-align:right">${money(r.total)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2d9e6;vertical-align:top">${status}</td></tr>`;
  });
  const html = `<div style="font:14px/1.5 Arial,sans-serif;color:#1f2440">
    <p><b>${made.length} draft invoice${made.length === 1 ? '' : 's'} in Xero</b> for ${esc(period.start)} to ${esc(period.end)}, ${money(total)} in total. Open each one in Xero, check it, then approve and send.</p>
    <table style="border-collapse:collapse;width:100%">${rows.join('')}</table>
    ${notSetUp.length ? `<p style="margin-top:16px"><b>Had shifts but aren't set up for invoicing</b> (add them in the Command Centre → Invoicing):</p><ul>${notSetUp.map((n) => `<li>${esc(n.name)} — ${n.shiftCount} shift${n.shiftCount === 1 ? '' : 's'}</li>`).join('')}</ul>` : ''}
  </div>`;
  const text = [
    `${made.length} draft invoices in Xero for ${period.start} to ${period.end}, ${money(total)} in total.`,
    '',
    ...results.map((r) => `${r.name} — ${money(r.total)} — ${r.error ? `NOT CREATED: ${r.error}` : r.skipped ? `not created: ${r.skipped}` : r.invoiceNumber}${r.flags.length ? `\n  ! ${r.flags.join('\n  ! ')}` : ''}`),
    ...(notSetUp.length ? ['', 'Had shifts but not set up for invoicing:', ...notSetUp.map((n) => `  ${n.name}`)] : []),
  ].join('\n');
  return { subject: `Invoices for ${period.start} to ${period.end}: ${made.length} drafts in Xero, ${money(total)}`, html, text };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!shiftcareConfigured() || !xeroConfigured() || !mailConfigured() || !supabaseConfigured()) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, CRON_SECRET) && !tokenMatches(bearer, XERO_STATUS_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const q = req.query || {};
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const { start, end } = ymd.test(q.start || '') && ymd.test(q.end || '') ? { start: q.start, end: q.end } : lastWeek();
  const clientIds = q.clientId ? String(q.clientId).split(',').map((s) => s.trim()).filter(Boolean) : null;
  const dryRun = q.dryRun === '1' || q.dryRun === 'true';

  try {
    const built = await buildWeek({ start, end, clientIds });
    if (dryRun) return res.status(200).json({ ok: true, dryRun: true, ...built });

    const results = [];
    for (const inv of built.invoices) {
      try {
        const out = await createDraft(inv, built.period);
        results.push({ ...inv, ...out });
      } catch (err) {
        console.error('invoice draft failed:', inv.clientId, err.message);
        results.push({ ...inv, error: err.message });
      }
    }
    const mail = summaryEmail(built.period, results, built.notSetUp);
    await sendEmail({ to: ADMIN_EMAIL, subject: mail.subject, text: mail.text, html: mail.html });

    return res.status(200).json({
      ok: true,
      period: built.period,
      emailedTo: ADMIN_EMAIL,
      results: results.map(({ clientId, name, total, invoiceId, invoiceNumber, skipped, error, flags }) => ({
        clientId, name, total, invoiceId, invoiceNumber, skipped, error, flags,
      })),
      notSetUp: built.notSetUp,
    });
  } catch (err) {
    console.error('weekly-invoice-draft failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Invoice run failed', detail: err.message });
  }
};
