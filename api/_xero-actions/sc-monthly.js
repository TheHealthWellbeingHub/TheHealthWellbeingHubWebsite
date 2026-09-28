// Monthly Support Coordination drafts (api/_sc-invoicing.js), 8am Brisbane on
// the 1st of every month, for the month just gone. The Vercel cron calls
// /api/sc-monthly-invoice-draft (a rewrite to this action — the Hobby plan's
// 12 functions are all used) at 22:00 UTC on the 28th-31st; only the call
// that lands on the 1st in Brisbane does anything. Emails the office the
// drafts and anyone not invoiced.
//
// GET, Authorization: Bearer <CRON_SECRET> (Vercel Cron) or <XERO_STATUS_TOKEN>.
// By hand (XERO_STATUS_TOKEN) it runs any day, for the month before
// today=YYYY-MM-DD (default today). clientId: one or more
// sc_invoice_clients ids, comma-separated. dryRun=1: build only — nothing
// written to Xero or Supabase, nothing emailed.
const { isConfigured: xeroConfigured, tokenMatches } = require('../_xero');
const { isConfigured: mailConfigured, sendEmail } = require('../_mail');
const { isConfigured: supabaseConfigured } = require('../_lib/supabase');
const { runScMonth, brisbaneToday } = require('../_sc-invoicing');

const CRON_SECRET = process.env.CRON_SECRET || '';
const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';
const ADMIN_EMAIL = process.env.INVOICE_DRAFT_EMAIL || 'officethehealthwellbeinghub@gmail.com';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function summaryEmail(made, attention) {
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
    : `Support Coordination: no new drafts, ${attention.length} not invoiced — needs checking`;
  return { subject, html, text };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!xeroConfigured() || !mailConfigured() || !supabaseConfigured()) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const byHand = tokenMatches(bearer, XERO_STATUS_TOKEN);
  if (!byHand && !tokenMatches(bearer, CRON_SECRET)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!byHand && !brisbaneToday().endsWith('-01')) {
    return res.status(200).json({ ok: true, skipped: 'runs on the 1st of the month' });
  }

  const q = req.query || {};
  const today = /^\d{4}-\d{2}-\d{2}$/.test(q.today || '') ? q.today : undefined;
  const clientIds = q.clientId ? String(q.clientId).split(',').map((s) => s.trim()).filter(Boolean) : null;
  const dryRun = q.dryRun === '1' || q.dryRun === 'true';

  try {
    const run = await runScMonth({ today, clientIds, dryRun });
    if (dryRun) return res.status(200).json({ ok: true, dryRun: true, ...run });

    const made = run.results.filter((r) => r.invoiceNumber);
    const attention = run.results.filter((r) => r.held || r.problem);
    let emailedTo = null;
    if (made.length || attention.length) {
      const mail = summaryEmail(made, attention);
      await sendEmail({ to: ADMIN_EMAIL, subject: mail.subject, text: mail.text, html: mail.html });
      emailedTo = ADMIN_EMAIL;
    }
    return res.status(200).json({ ok: true, today: run.today, emailedTo, results: run.results });
  } catch (err) {
    console.error('sc-monthly failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Support Coordination run failed', detail: err.message });
  }
};
