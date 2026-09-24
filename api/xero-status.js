// Read-only health check: confirms the stored refresh token still works and
// shows which Xero organisation it's connected to, without touching any
// invoice, contact or accounting data. Safe to call as often as needed.
const { isConfigured, getAccessContext, canPersistToVercel, xeroApiFetch, tokenMatches } = require('./_xero');

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

  try {
    const { tenantId } = await getAccessContext();
    const org = await xeroApiFetch('/Organisation');
    return res.status(200).json({
      ok: true,
      connected: true,
      tenantId,
      organisationName: org.Organisations?.[0]?.Name,
      selfPersisting: await canPersistToVercel(),
    });
  } catch (err) {
    const notConnected = err.message.startsWith('not_connected');
    return res.status(notConnected ? 409 : 502).json({
      ok: false,
      connected: false,
      error: notConnected ? 'not_connected' : 'xero_error',
      detail: err.message,
    });
  }
};
