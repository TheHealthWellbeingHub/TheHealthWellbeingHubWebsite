// Read-only health check: confirms the Custom Connection credentials still
// work and shows which Xero organisation they're scoped to, without
// touching any invoice, contact or accounting data. Safe to call as often
// as needed.
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

  try {
    const org = await xeroApiFetch('/Organisation');
    return res.status(200).json({
      ok: true,
      connected: true,
      organisationName: org.Organisations?.[0]?.Name,
      organisationId: org.Organisations?.[0]?.OrganisationID,
    });
  } catch (err) {
    return res.status(502).json({ ok: false, connected: false, error: 'xero_error', detail: err.message });
  }
};
