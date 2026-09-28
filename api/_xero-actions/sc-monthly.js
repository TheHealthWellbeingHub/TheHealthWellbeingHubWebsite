// Monthly Support Coordination drafts (api/_sc-invoicing.js). Called every
// morning at 8am Brisbane by the Vercel cron via /api/sc-monthly-invoice-draft
// (a rewrite to this action — the Hobby plan's 12 functions are all used).
// Drafts whoever's period ended yesterday or earlier this month and emails
// the office the list; quiet on days with nothing new.
//
// GET, Authorization: Bearer <CRON_SECRET> (Vercel Cron) or <XERO_STATUS_TOKEN>.
// Query: today=YYYY-MM-DD (run as if it were that day), clientId (one or
// more sc_invoice_clients ids, comma-separated), dryRun=1 (build only:
// nothing written to Xero or Supabase, nothing emailed).
const { isConfigured: xeroConfigured, tokenMatches } = require('../_xero');
const { isConfigured: mailConfigured, sendEmail } = require('../_mail');
const { isConfigured: supabaseConfigured } = require('../_lib/supabase');
const { runScMonth } = require('../_sc-invoicing');

const CRON_SECRET = process.env.CRON_SECRET || '';
const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';
const ADMIN_EMAIL = process.env.INVOICE_DRAFT_EMAIL || 'officethehealthwellbeinghub@gmail.com';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function summaryEmail(today, made, attention) {
  const total = made.reduce((s, r) => s + Number(r.total || 0), 0);
  const cell = 'padding:8px;border-bottom:1px solid #e2d9e6;vertical-align:top';
  const flagList = (r) => (r.flags.length ? `<ul style="margin:4px 0 0;color:#9a5a00">${r.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '');
  const madeRows = made.map((r) => `<tr><td style="${cell}"><b>${esc(r.name)}</b><br>${esc(r.reference)} · ${esc(r.contactName)} · ${esc(r.periodStart.split('-').reverse().join('/'))} – ${esc(r.periodEnd.split('-').reverse().join('/'))}${flagList(r)}</td>
    <td style="${cell};text-align:right">${money(r.total)}</td><td style="${cell}"><a href="${r.link}">${esc(r.invoiceNumber)}</a> — draft</td></tr>`);
  const html = `<div style="font:14px/1.5 Arial,sans-serif;color:#1f2440">
    ${made.length ? `<p><b>${made.length} Support Coordination draft${made.length === 1 ? '' : 's'} in Xero</b>, ${money(total)} in total. Open each one in Xero, check it, then approve and send.</p>
    <table style="border-collapse:collapse;width:100%">${madeRows.join('')}</table>` : ''}
    ${attention.length ? `<p style="margin-top:16px"><b>Not invoiced — needs someone to look</b> (Command Centre → Invoicing → Support Coordination):</p>
    <ul>${attention.map((r) => `<li><b>${esc(r.name)}</b>: ${esc(r.held ? `On hold — ${r.held}` : r.problem)}</li>`).join('')}</ul>` : ''}
  </div>`;
  const text = [
    made.length ? `${made.length} Support Coordination drafts in Xero, ${money(total)} in total.` : '',
    ...made.map((r) => `${r.name} — ${money(r.total)} — ${r.invoiceNumber}${r.flags.length ? `\n  ! ${r.flags.join('\n  ! ')}` : ''}`),
    ...(attention.length ? ['', 'Not invoiced — needs someone to look:', ...attention.map((r) => `  ${r.name}: ${r.held ? `On hold — ${r.held}` : r.problem}`)] : []),
  ].join('\n');
  const subject = made.length
    ? `Support Coordination: ${made.length} draft${made.length === 1 ? '' : 's'} in Xero, ${money(total)}`
    : `Support Coordination: ${attention.length} not invoiced — needs checking`;
  return { subject, html, text };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!xeroConfigured() || !mailConfigured() || !supabaseConfigured()) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, CRON_SECRET) && !tokenMatches(bearer, XERO_STATUS_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const q = req.query || {};
  const today = /^\d{4}-\d{2}-\d{2}$/.test(q.today || '') ? q.today : undefined;
  const clientIds = q.clientId ? String(q.clientId).split(',').map((s) => s.trim()).filter(Boolean) : null;
  const dryRun = q.dryRun === '1' || q.dryRun === 'true';

  try {
    const run = await runScMonth({ today, clientIds, dryRun });
    if (dryRun) return res.status(200).json({ ok: true, dryRun: true, ...run });

    const made = run.results.filter((r) => r.invoiceNumber);
    // Held or broken clients are reported the morning their period ends (or
    // alongside new drafts), not every day for the rest of the month.
    const attention = run.results.filter((r) => (r.held || r.problem) && (r.firstDay || made.length));
    let emailedTo = null;
    if (made.length || attention.length) {
      const mail = summaryEmail(run.today, made, attention);
      await sendEmail({ to: ADMIN_EMAIL, subject: mail.subject, text: mail.text, html: mail.html });
      emailedTo = ADMIN_EMAIL;
    }
    return res.status(200).json({ ok: true, today: run.today, emailedTo, results: run.results });
  } catch (err) {
    console.error('sc-monthly failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Support Coordination run failed', detail: err.message });
  }
};
