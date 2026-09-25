// Small admin utility: change a Xero invoice's status. Used to remove the
// test draft invoice from xero-create-invoice.js's dry run. A DRAFT
// invoice can be set to "DELETED" (Xero's only form of removal for a
// draft — there is no hard delete); an AUTHORISED one would need
// "VOIDED" instead, which this also supports.
//
// POST body: { invoiceId, status }
const { isConfigured, xeroApiFetch, tokenMatches } = require('./_xero');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!isConfigured() || !XERO_STATUS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, XERO_STATUS_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const { invoiceId, status } = req.body || {};
  if (!invoiceId || !status) {
    return res.status(400).json({ ok: false, error: 'invoiceId and status are required' });
  }

  try {
    const body = await xeroApiFetch(`/Invoices/${invoiceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Status: status }),
    });
    const saved = body.Invoices?.[0];
    return res.status(200).json({
      ok: true,
      invoice: saved ? { id: saved.InvoiceID, number: saved.InvoiceNumber, status: saved.Status } : null,
    });
  } catch (err) {
    console.error('xero-admin-invoice failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Xero write failed', detail: err.message });
  }
};
