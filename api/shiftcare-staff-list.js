// Vercel serverless function — relays ShiftCare's staff list for the
// Command Centre app, which holds no ShiftCare API credentials of its own
// (only this website project does). Read-only.
const crypto = require('crypto');

const SHIFTCARE_ACCOUNT_ID = process.env.SHIFTCARE_ACCOUNT_ID || '291708';
const SHIFTCARE_API_KEY = process.env.SHIFTCARE_API_KEY || '';
const SHIFTCARE_STAFF_RELAY_TOKEN = process.env.SHIFTCARE_STAFF_RELAY_TOKEN || '';
const SHIFTCARE_BASE = 'https://api.shiftcare.com/api';

function tokenMatches(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7).trim());
  const want = Buffer.from(SHIFTCARE_STAFF_RELAY_TOKEN);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function shapeStaff(s) {
  return {
    id: s.id,
    name: s.name || [s.first_name, s.family_name].filter(Boolean).join(' ').trim(),
    role: s.role || '',
    jobTitle: s.job_title || '',
    employmentType: s.employment_type || '',
    languages: s.languages || [],
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!SHIFTCARE_STAFF_RELAY_TOKEN || !tokenMatches(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!SHIFTCARE_API_KEY) {
    console.error('SHIFTCARE ENDPOINT NOT CONFIGURED — missing SHIFTCARE_API_KEY');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  const basic = Buffer.from(`${SHIFTCARE_ACCOUNT_ID}:${SHIFTCARE_API_KEY}`).toString('base64');

  try {
    const all = [];
    let page = 1;
    for (;;) {
      const scRes = await fetch(
        `${SHIFTCARE_BASE}/v3/staff?page=${page}&per_page=20&sort_by=name&sort_type=asc`,
        { headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' } }
      );
      const text = await scRes.text();
      const data = text ? JSON.parse(text) : null;
      if (!scRes.ok) {
        return res.status(scRes.status).json({ ok: false, error: 'ShiftCare rejected the request', detail: data });
      }
      all.push(...(data.staff || []).map(shapeStaff));
      const meta = data._metadata || {};
      if (!meta.next_page_link || page >= (Number(meta.total_pages) || 1) || page > 20) break;
      page += 1;
    }
    return res.status(200).json({ ok: true, staff: all });
  } catch (err) {
    console.error('shiftcare-staff-list failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Request failed', detail: err.message });
  }
};
