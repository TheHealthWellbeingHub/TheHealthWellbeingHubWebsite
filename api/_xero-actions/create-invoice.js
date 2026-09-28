// One participant's weekly invoice, on demand — the same build as the Monday
// run (api/_invoicing.js), for re-doing a week after fixing something in
// ShiftCare or the Command Centre. Always a DRAFT in Xero; a person approves
// and sends it. A week that already has a draft is left alone (delete the
// old draft in Xero first to redo it).
//
// POST { clientId, start, end, dryRun } — start/end are the Monday and
// Sunday of the week. dryRun: true returns the invoice without creating it.
const { isConfigured: shiftcareConfigured } = require('../_shiftcare');
const { isConfigured: xeroConfigured, tokenMatches } = require('../_xero');
const { buildWeek, createDraft, xeroLink } = require('../_invoicing');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!shiftcareConfigured() || !xeroConfigured() || !XERO_STATUS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, XERO_STATUS_TOKEN)) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { clientId, start, end, dryRun } = req.body || {};
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!clientId || !ymd.test(start || '') || !ymd.test(end || '')) {
    return res.status(400).json({ ok: false, error: 'clientId, start and end (YYYY-MM-DD) are required' });
  }

  try {
    const built = await buildWeek({ start, end, clientIds: [String(clientId)] });
    const invoice = built.invoices[0];
    if (!invoice) return res.status(404).json({ ok: false, error: 'This participant is not set up for invoicing' });
    if (dryRun) return res.status(200).json({ ok: true, dryRun: true, period: built.period, invoice });
    const out = await createDraft(invoice, built.period);
    return res.status(200).json({ ok: true, period: built.period, ...out, link: out.invoiceId ? xeroLink(out.invoiceId) : null, flags: invoice.flags });
  } catch (err) {
    console.error('create-invoice failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Invoice creation failed', detail: err.message });
  }
};
