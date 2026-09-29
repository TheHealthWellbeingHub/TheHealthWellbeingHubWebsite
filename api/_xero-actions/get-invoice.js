// Fetches one Xero invoice by ID (or number), including line items and
// drafts — the read-only Xero MCP tools in chat can't see DRAFT invoices.
// Also used by the Command Centre's invoice preview (Invoicing page), which
// sends its own token. Read-only.
const { isConfigured, xeroApiFetch, tokenMatches } = require('../_xero');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';
// Bearer <XERO_STATUS_TOKEN>, or the Command Centre's send token (as ensure-contact).
const TOKENS = [XERO_STATUS_TOKEN, process.env.SEND_EMAIL_TOKEN, process.env.COMMAND_CENTRE_SEND_TOKEN].filter(Boolean);

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!isConfigured() || !XERO_STATUS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!TOKENS.some((t) => tokenMatches(bearer, t)) && !tokenMatches(req.query.token, XERO_STATUS_TOKEN)) {
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
