// Shared Xero OAuth2 + API helper. Not a route itself (Vercel skips files
// prefixed with "_"). Used by xero-connect.js, xero-callback.js,
// xero-status.js and, later, the invoicing functions.
//
// Xero's refresh tokens ROTATE on every use — each refresh call returns a
// new refresh_token that must replace the old one, or the connection dies
// in ~60 days. That means a deployed, unattended function needs somewhere
// durable to read the current one from and write the new one back to.
// This repo has no database of its own for that, so it uses the Vercel
// project's own env vars as the store, via the Vercel REST API — the same
// values Vercel injects into the function at runtime. See persistRefreshToken.
const crypto = require('crypto');

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID || '';
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET || '';
const XERO_REDIRECT_URI = process.env.XERO_REDIRECT_URI || 'https://www.thehealthwellbeinghub.com/api/xero-callback';

// Least privilege: only what invoicing needs, not the payroll/projects
// scopes the app is configured to allow. offline_access is what makes
// Xero issue a refresh_token at all.
const XERO_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'email',
  'accounting.contacts',
  'accounting.contacts.read',
  'accounting.invoices',
  'accounting.invoices.read',
  'accounting.settings.read',
].join(' ');

function isConfigured() {
  return Boolean(XERO_CLIENT_ID && XERO_CLIENT_SECRET);
}

function basicAuthHeader() {
  return 'Basic ' + Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64');
}

// Signed, stateless CSRF token for the OAuth "state" param — no server-side
// session store exists between the connect and callback requests (they can
// land on different serverless instances), so the state carries its own
// short-lived HMAC instead.
function signState() {
  const payload = `${Date.now()}.${crypto.randomBytes(8).toString('hex')}`;
  const sig = crypto.createHmac('sha256', XERO_CLIENT_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyState(state) {
  if (typeof state !== 'string') return false;
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const [ts, nonce, sig] = parts;
  const payload = `${ts}.${nonce}`;
  const want = crypto.createHmac('sha256', XERO_CLIENT_SECRET).update(payload).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  // 10 minute window — long enough for a human to log into Xero and click Allow.
  return Date.now() - Number(ts) < 10 * 60 * 1000;
}

function authorizeUrl() {
  const state = signState();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: XERO_CLIENT_ID,
    redirect_uri: XERO_REDIRECT_URI,
    scope: XERO_SCOPES,
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: XERO_REDIRECT_URI,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Xero token exchange failed: ${res.status} ${JSON.stringify(body)}`);
  return body; // { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Xero token refresh failed: ${res.status} ${JSON.stringify(body)}`);
  return body; // new access_token + rotated refresh_token
}

async function getConnections(accessToken) {
  const res = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Xero connections lookup failed: ${res.status} ${JSON.stringify(body)}`);
  return body; // [{ tenantId, tenantName, ... }]
}

// Writes a value back into this Vercel project's env vars so the next
// invocation (possibly a different serverless instance, possibly next
// week's cron run) picks it up. Requires VERCEL_API_TOKEN + VERCEL_PROJECT_ID
// to be set — until they are, callers fall back to showing the value for a
// human to paste in manually once.
async function canPersistToVercel() {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID);
}

async function persistEnvVar(key, value) {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID || '';
  if (!token || !projectId) {
    throw new Error('VERCEL_API_TOKEN / VERCEL_PROJECT_ID not configured — cannot self-persist');
  }
  const qs = new URLSearchParams({ upsert: 'true' });
  if (teamId) qs.set('teamId', teamId);
  const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?${qs.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      value,
      type: 'sensitive',
      target: ['production'],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Vercel env update failed for ${key}: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

// Returns a valid access token + tenant id for API calls, rotating and
// persisting the refresh token along the way. Throws a clear error if the
// connection hasn't been established yet (no XERO_REFRESH_TOKEN) so callers
// can surface a "not connected" state rather than a confusing Xero 401.
async function getAccessContext() {
  const refreshToken = process.env.XERO_REFRESH_TOKEN || '';
  const tenantId = process.env.XERO_TENANT_ID || '';
  if (!refreshToken) {
    throw new Error('not_connected: no XERO_REFRESH_TOKEN — run /api/xero-connect first');
  }
  const tokens = await refreshAccessToken(refreshToken);
  if (await canPersistToVercel()) {
    await persistEnvVar('XERO_REFRESH_TOKEN', tokens.refresh_token);
  } else {
    console.error(
      'XERO refresh token rotated but VERCEL_API_TOKEN/VERCEL_PROJECT_ID are not set — ' +
      'the new refresh token was NOT saved. Update XERO_REFRESH_TOKEN manually or this ' +
      'connection will stop working once the old token expires.'
    );
  }
  let effectiveTenantId = tenantId;
  if (!effectiveTenantId) {
    const connections = await getConnections(tokens.access_token);
    if (!connections.length) throw new Error('Xero returned no connected organisations for this token');
    effectiveTenantId = connections[0].tenantId;
    if (await canPersistToVercel()) {
      await persistEnvVar('XERO_TENANT_ID', effectiveTenantId);
    }
  }
  return { accessToken: tokens.access_token, tenantId: effectiveTenantId };
}

async function xeroApiFetch(pathname, opts = {}) {
  const { accessToken, tenantId } = await getAccessContext();
  const res = await fetch(`https://api.xero.com/api.xro/2.0${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Xero-tenant-id': tenantId,
      Accept: 'application/json',
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Xero API ${pathname} failed: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

function tokenMatches(given, want) {
  if (typeof given !== 'string' || !want) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  isConfigured,
  authorizeUrl,
  verifyState,
  exchangeCodeForTokens,
  getConnections,
  canPersistToVercel,
  persistEnvVar,
  getAccessContext,
  xeroApiFetch,
  tokenMatches,
};
