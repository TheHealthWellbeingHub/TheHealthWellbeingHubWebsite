// Vercel serverless function — creates a ShiftCare client on behalf of the
// Command Centre app, which holds no ShiftCare API credentials of its own
// (same pattern as shiftcare-client-notes.js). Used when a new participant
// is onboarded (workflow 03) and by the New Participant form.
//
// POST { first_name, dob, family_name?, preferred_name?, email?,
//        mobile_number?, address?, ndis_number? } → { ok, client }
// Only these fields are passed on; anything else in the body is ignored.
//
// Auth: Authorization: Bearer <SHIFTCARE_CLIENTS_TOKEN>.
const crypto = require('crypto');

const SHIFTCARE_ACCOUNT_ID = process.env.SHIFTCARE_ACCOUNT_ID || '291708';
const SHIFTCARE_API_KEY = process.env.SHIFTCARE_API_KEY || '';
const SHIFTCARE_CLIENTS_TOKEN = process.env.SHIFTCARE_CLIENTS_TOKEN || '';
const SHIFTCARE_BASE = 'https://api.shiftcare.com/api';

const FIELDS = ['first_name', 'family_name', 'preferred_name', 'dob', 'email', 'mobile_number', 'address', 'ndis_number'];

function tokenMatches(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7).trim());
  const want = Buffer.from(SHIFTCARE_CLIENTS_TOKEN);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!SHIFTCARE_CLIENTS_TOKEN || !tokenMatches(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!SHIFTCARE_API_KEY) {
    console.error('SHIFTCARE ENDPOINT NOT CONFIGURED — missing SHIFTCARE_API_KEY');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  const body = req.body || {};
  const fields = {};
  for (const key of FIELDS) {
    if (typeof body[key] === 'string' && body[key].trim()) fields[key] = body[key].trim();
  }
  if (!fields.first_name || !/^\d{4}-\d{2}-\d{2}$/.test(fields.dob || '')) {
    return res.status(400).json({ ok: false, error: 'first_name and dob (YYYY-MM-DD) are required' });
  }

  const basic = Buffer.from(`${SHIFTCARE_ACCOUNT_ID}:${SHIFTCARE_API_KEY}`).toString('base64');
  try {
    const scRes = await fetch(`${SHIFTCARE_BASE}/v3/clients`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const text = await scRes.text();
    const data = text ? JSON.parse(text) : null;
    if (!scRes.ok) {
      return res.status(scRes.status).json({ ok: false, error: 'ShiftCare rejected the new client', detail: data });
    }
    const client = (data && (data.client || data)) || {};
    return res.status(200).json({ ok: true, client });
  } catch (err) {
    console.error('shiftcare-clients POST failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Request failed', detail: err.message });
  }
};
