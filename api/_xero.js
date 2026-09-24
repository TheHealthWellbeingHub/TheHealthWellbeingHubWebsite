// Xero "Custom Connection" API helper. Not a route itself (Vercel skips
// files prefixed with "_"). Used by xero-status.js and, later, the
// invoicing functions.
//
// A Custom Connection is a Xero app type registered once, in the Xero
// Developer Portal, against one specific organisation — H&W's own. Unlike
// the standard OAuth2 web-app flow, there is no per-user consent screen and
// no rotating refresh token to keep alive: it authenticates directly with
// XERO_CLIENT_ID/XERO_CLIENT_SECRET via grant_type=client_credentials and
// gets a fresh ~30-minute access token per call. Nothing to persist, and
// this code never needs write access to this project's own secret store.
const crypto = require('crypto');

const XERO_CLIENT_ID = process.env.XERO_CLIENT_ID || '';
const XERO_CLIENT_SECRET = process.env.XERO_CLIENT_SECRET || '';

// Least privilege: only what invoicing needs.
const XERO_SCOPES = [
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

// Best-effort, per-instance cache only (same spirit as the rate limiters in
// hubspot-submit.js / send-participant-email.js) — a cold serverless
// instance just re-authenticates, which is cheap and stateless.
let cachedToken = null; // { accessToken, expiresAt }

async function getAccessToken() {
  if (!isConfigured()) throw new Error('not_configured: XERO_CLIENT_ID / XERO_CLIENT_SECRET missing');
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
    return cachedToken.accessToken;
  }
  const res = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: XERO_SCOPES,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Xero client-credentials auth failed: ${res.status} ${JSON.stringify(body)}`);
  cachedToken = { accessToken: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return cachedToken.accessToken;
}

// A Custom Connection is already scoped to exactly one organisation, so —
// unlike the multi-tenant OAuth web-app flow — calls need no
// Xero-tenant-id header at all.
async function xeroApiFetch(pathname, opts = {}) {
  const accessToken = await getAccessToken();
  const res = await fetch(`https://api.xero.com/api.xro/2.0${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

// Small orgs rarely have more than a page of contacts, so one fetch (Xero
// defaults to 100/page) covers matching without dealing with query-string
// escaping for a server-side "where" filter per lookup.
async function listAllContacts() {
  const body = await xeroApiFetch('/Contacts');
  return body.Contacts || [];
}

// The org's default revenue account, used when creating an invoice line
// item that doesn't specify one. Picks the first active REVENUE-class
// account rather than guessing a code, and fails loudly if none exists.
async function getDefaultRevenueAccountCode() {
  const body = await xeroApiFetch('/Accounts');
  const account = (body.Accounts || []).find((a) => a.Class === 'REVENUE' && a.Status === 'ACTIVE');
  if (!account) throw new Error('No active REVENUE account found in the Xero chart of accounts');
  return account.Code;
}

module.exports = { isConfigured, getAccessToken, xeroApiFetch, listAllContacts, getDefaultRevenueAccountCode, tokenMatches };
