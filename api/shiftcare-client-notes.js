// Vercel serverless function — reads/writes a ShiftCare client's notes field
// on behalf of the Command Centre app, which holds no ShiftCare API
// credentials of its own. GET reads the current notes (needed before a
// write, since ShiftCare's PATCH replaces the field rather than appending);
// POST replaces it with the given value.
const crypto = require('crypto');

const SHIFTCARE_ACCOUNT_ID = process.env.SHIFTCARE_ACCOUNT_ID || '291708';
const SHIFTCARE_API_KEY = process.env.SHIFTCARE_API_KEY || '';
const SHIFTCARE_CLIENT_NOTES_TOKEN = process.env.SHIFTCARE_CLIENT_NOTES_TOKEN || '';
const SHIFTCARE_BASE = 'https://api.shiftcare.com/api';

function tokenMatches(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7).trim());
  const want = Buffer.from(SHIFTCARE_CLIENT_NOTES_TOKEN);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!SHIFTCARE_CLIENT_NOTES_TOKEN || !tokenMatches(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!SHIFTCARE_API_KEY) {
    console.error('SHIFTCARE ENDPOINT NOT CONFIGURED — missing SHIFTCARE_API_KEY');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  const basic = Buffer.from(`${SHIFTCARE_ACCOUNT_ID}:${SHIFTCARE_API_KEY}`).toString('base64');

  if (req.method === 'GET') {
    const { client_id } = req.query || {};
    if (!client_id || !Number.isInteger(Number(client_id))) {
      return res.status(400).json({ ok: false, error: 'client_id (integer) is required' });
    }
    try {
      const scRes = await fetch(`${SHIFTCARE_BASE}/v3/clients/${Number(client_id)}`, {
        headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' },
      });
      const text = await scRes.text();
      const data = text ? JSON.parse(text) : null;
      if (!scRes.ok) {
        return res.status(scRes.status).json({ ok: false, error: 'ShiftCare rejected the request', detail: data });
      }
      const client = (data && (data.client || data)) || {};
      return res.status(200).json({ ok: true, notes: client.notes || '' });
    } catch (err) {
      console.error('shiftcare-client-notes GET failed:', err.message);
      return res.status(502).json({ ok: false, error: 'Request failed', detail: err.message });
    }
  }

  const { client_id, notes } = req.body || {};
  if (!client_id || !Number.isInteger(Number(client_id))) {
    return res.status(400).json({ ok: false, error: 'client_id (integer) is required' });
  }
  if (typeof notes !== 'string') {
    return res.status(400).json({ ok: false, error: 'notes (string) is required' });
  }

  try {
    const scRes = await fetch(`${SHIFTCARE_BASE}/v3/clients/${Number(client_id)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    });
    const text = await scRes.text();
    const data = text ? JSON.parse(text) : null;
    if (!scRes.ok) {
      return res.status(scRes.status).json({ ok: false, error: 'ShiftCare rejected the update', detail: data });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('shiftcare-client-notes POST failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Request failed', detail: err.message });
  }
};
