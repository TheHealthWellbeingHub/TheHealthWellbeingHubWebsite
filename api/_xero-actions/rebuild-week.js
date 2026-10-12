// Rebuilds one week's weekly invoices from ShiftCare as it is now — the
// Command Centre's "Rebuild this week's invoices" button (Invoicing page).
// For each participant set up for invoicing: a week with a DRAFT is redone in
// place (same invoice number, lines replaced); a week with no invoice yet gets
// a new DRAFT; an approved, sent or paid invoice is never changed, only
// reported. Same build as the Monday run (api/_invoicing.js). No email.
//
// POST { start, end, clientIds? } — start/end are the Monday and Sunday of
// the week; clientIds limits it to those ShiftCare client IDs.
// Auth: Bearer <XERO_STATUS_TOKEN>, or the Command Centre's send token
// (SEND_EMAIL_TOKEN / COMMAND_CENTRE_SEND_TOKEN), as get-invoice.
const { isConfigured: shiftcareConfigured } = require('../_shiftcare');
const { isConfigured: xeroConfigured, tokenMatches } = require('../_xero');
const { buildWeek, createDraft, xeroLink } = require('../_invoicing');

const TOKENS = [process.env.XERO_STATUS_TOKEN, process.env.SEND_EMAIL_TOKEN, process.env.COMMAND_CENTRE_SEND_TOKEN].filter(Boolean);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!shiftcareConfigured() || !xeroConfigured() || !TOKENS.length) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!TOKENS.some((t) => tokenMatches(bearer, t))) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { start, end, clientIds } = req.body || {};
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(start || '') || !ymd.test(end || '')) {
    return res.status(400).json({ ok: false, error: 'start and end (YYYY-MM-DD) are required' });
  }
  const ids = Array.isArray(clientIds) && clientIds.length ? clientIds.map(String) : null;

  try {
    const built = await buildWeek({ start, end, clientIds: ids });
    const results = [];
    for (const inv of built.invoices) {
      try {
        const out = await createDraft(inv, built.period, { replace: true });
        results.push({
          clientId: inv.clientId,
          name: inv.name,
          total: out.total ?? inv.total,
          invoiceId: out.invoiceId || null,
          invoiceNumber: out.invoiceNumber || null,
          link: out.invoiceId ? xeroLink(out.invoiceId) : null,
          replaced: Boolean(out.replaced),
          skipped: out.skipped || null,
          flags: inv.flags,
        });
      } catch (err) {
        console.error('rebuild-week draft failed:', inv.clientId, err.message);
        results.push({ clientId: inv.clientId, name: inv.name, total: inv.total, error: err.message, flags: inv.flags });
      }
    }
    return res.status(200).json({ ok: true, period: built.period, results, notSetUp: built.notSetUp });
  } catch (err) {
    console.error('rebuild-week failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Rebuild failed', detail: err.message });
  }
};
