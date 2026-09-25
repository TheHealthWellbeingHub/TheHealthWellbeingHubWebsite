// Diagnostic-only: fetches one Xero invoice by ID, including line items.
// Exists because the read-only Xero MCP tools in chat can only see
// UNPAID/PAID invoices, not DRAFT ones — this endpoint has no such
// restriction since it talks to the Xero API directly.
const { isConfigured, xeroApiFetch, tokenMatches } = require('./_xero');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!isConfigured() || !XERO_STATUS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, XERO_STATUS_TOKEN) && !tokenMatches(req.query.token, XERO_STATUS_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ ok: false, error: 'id query param required' });

  try {
    const body = await xeroApiFetch(`/Invoices/${id}`);
    return res.status(200).json({ ok: true, invoice: body.Invoices?.[0] || null });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'Xero read failed', detail: err.message });
  }
};
