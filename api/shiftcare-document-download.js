// Vercel serverless function — mints a time-limited download link for a
// client's document already on ShiftCare. Exists so the Command Centre app
// (a separate Vercel project with no ShiftCare credentials of its own) can
// preview/download a document without duplicating the ShiftCare API key
// there — this endpoint holds the real credentials, the caller only needs
// its own dedicated bearer token.
//
// GET /v3/clients/{client_id}/documents/{id}/download returns a pre-signed
// URL that needs no ShiftCare auth and expires within minutes (ShiftCare's
// own spec), so this relays that URL fresh on every call rather than
// caching it.
const crypto = require('crypto');

const SHIFTCARE_ACCOUNT_ID = process.env.SHIFTCARE_ACCOUNT_ID || '291708';
const SHIFTCARE_API_KEY = process.env.SHIFTCARE_API_KEY || '';
const SHIFTCARE_DOWNLOAD_TOKEN = process.env.SHIFTCARE_DOWNLOAD_TOKEN || '';
const SHIFTCARE_BASE = 'https://api.shiftcare.com/api';

function tokenMatches(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7).trim());
  const want = Buffer.from(SHIFTCARE_DOWNLOAD_TOKEN);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!SHIFTCARE_DOWNLOAD_TOKEN || !tokenMatches(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!SHIFTCARE_API_KEY) {
    console.error('SHIFTCARE ENDPOINT NOT CONFIGURED — missing SHIFTCARE_API_KEY');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  const { client_id, document_id } = req.query || {};
  if (!client_id || !Number.isInteger(Number(client_id))) {
    return res.status(400).json({ ok: false, error: 'client_id (integer) is required' });
  }
  if (!document_id || !Number.isInteger(Number(document_id))) {
    return res.status(400).json({ ok: false, error: 'document_id (integer) is required' });
  }

  const basic = Buffer.from(`${SHIFTCARE_ACCOUNT_ID}:${SHIFTCARE_API_KEY}`).toString('base64');

  try {
    const scRes = await fetch(
      `${SHIFTCARE_BASE}/v3/clients/${Number(client_id)}/documents/${Number(document_id)}/download?time_zone=Australia/Brisbane`,
      { headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' } }
    );
    const text = await scRes.text();
    const data = text ? JSON.parse(text) : null;
    if (!scRes.ok) {
      return res.status(scRes.status).json({ ok: false, error: 'ShiftCare rejected the request', detail: data });
    }
    return res.status(200).json({ ok: true, url: data.url, expiresAt: data.expires_at });
  } catch (err) {
    console.error('shiftcare-document-download failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Request failed', detail: err.message });
  }
};
