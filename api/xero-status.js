// Vercel serverless function — health check for the Xero Custom Connection.
// Read-only, no accounting writes: it proves the stored client credentials
// actually authenticate with Xero and reports which organisation is
// connected. It is also the building block every future Xero write endpoint
// will reuse for its access token + tenant id (a Custom Connection's bearer
// token authenticates the app, not a specific organisation — every
// accounting API call still needs an `xero-tenant-id` header, and the only
// way to learn that id is this same /connections call).
//
// Auth: Authorization: Bearer <XERO_STATUS_TOKEN> — its own secret rather
// than reusing SEND_EMAIL_TOKEN, so rotating one Xero endpoint's access
// never touches the unrelated email-sending endpoint's.
const crypto = require('crypto');

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID || '';
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET || '';
const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';

function tokenMatches(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7).trim());
  const want = Buffer.from(XERO_STATUS_TOKEN);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

// Custom Connections use the client_credentials grant — no browser login,
// no refresh token. The bearer token this returns authenticates the app
// itself and is valid for 30 minutes; nothing here caches it, since this
// endpoint is called rarely enough that a fresh token per call is simplest.
async function getXeroAccessToken() {
  const basic = Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error((data && (data.error_description || data.error)) || `Xero token endpoint ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data.access_token;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!XERO_STATUS_TOKEN || !tokenMatches(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
    console.error('XERO ENDPOINT NOT CONFIGURED — missing XERO_CLIENT_ID / XERO_CLIENT_SECRET');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  try {
    const accessToken = await getXeroAccessToken();
    const connRes = await fetch('https://api.xero.com/connections', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const connections = await connRes.json();
    if (!connRes.ok) {
      return res.status(502).json({ ok: false, error: 'Xero /connections call failed', detail: connections });
    }
    return res.status(200).json({
      ok: true,
      authenticated: true,
      organisations: (connections || []).map((c) => ({
        tenantId: c.tenantId,
        tenantName: c.tenantName,
        tenantType: c.tenantType,
      })),
    });
  } catch (err) {
    console.error('xero-status failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Xero authentication failed', detail: err.message });
  }
};
