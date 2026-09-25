// ShiftCare REST API helper. Not a route itself (Vercel skips files
// prefixed with "_"). Used by the weekly invoiceable-items pull
// (weekly-invoice-draft.js) and the Xero create-invoice action.
//
// ShiftCare's public API uses HTTP Basic Auth with the numeric account ID
// as username and the API key as password (help.shiftcare.com — Managing
// API Keys), not a bearer token. Base URL is region-specific; this account
// is Australian (Logan Central, QLD).
const SHIFTCARE_API_BASE = process.env.SHIFTCARE_API_BASE || 'https://api.shiftcare.com';
const SHIFTCARE_ACCOUNT_ID = process.env.SHIFTCARE_ACCOUNT_ID || '291708';
const SHIFTCARE_API_KEY = process.env.SHIFTCARE_API_KEY || '';

function isConfigured() {
  return Boolean(SHIFTCARE_API_KEY && SHIFTCARE_ACCOUNT_ID);
}

function basicAuthHeader() {
  return 'Basic ' + Buffer.from(`${SHIFTCARE_ACCOUNT_ID}:${SHIFTCARE_API_KEY}`).toString('base64');
}

async function shiftcareApiFetch(pathname, params = {}) {
  if (!isConfigured()) throw new Error('not_configured: SHIFTCARE_API_KEY missing');
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(`${key}[]`, v));
    else qs.set(key, value);
  }
  const url = `${SHIFTCARE_API_BASE}${pathname}${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: basicAuthHeader(),
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`ShiftCare API ${pathname} returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`ShiftCare API ${pathname} failed: ${res.status} ${JSON.stringify(body)}`);
  return body;
}

module.exports = { isConfigured, shiftcareApiFetch };
