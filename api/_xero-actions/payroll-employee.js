// A new support worker as an employee in Xero Payroll (AU). Called by the
// Command Centre once the worker's date of birth and home address are known
// (Xero won't create an employee without them). Matches an existing
// employee by name and date of birth first, so it never creates a second one.
//
// GET  ?action=payroll-employee&check=1  → can we reach Payroll? (read-only)
// POST { first_name, family_name, dob (YYYY-MM-DD), address, suburb, state,
//        postcode, email?, mobile?, gender?, start_date? }
// Auth: Bearer <XERO_STATUS_TOKEN>, or the Command Centre's send token.
const { isConfigured, xeroPayrollFetch, tokenMatches } = require('../_xero');

const TOKENS = [process.env.XERO_STATUS_TOKEN, process.env.SEND_EMAIL_TOKEN, process.env.COMMAND_CENTRE_SEND_TOKEN].filter(Boolean);
const STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];
const GENDER = { male: 'M', female: 'F', 'non-binary': 'I', intersex: 'I', m: 'M', f: 'F' };

const s = (v) => String(v == null ? '' : v).trim();
const xeroDate = (ymd) => `${ymd}T00:00:00`;

module.exports = async (req, res) => {
  if (!isConfigured() || !TOKENS.length) return res.status(503).json({ ok: false, error: 'not_configured' });
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!TOKENS.some((t) => tokenMatches(bearer, t))) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const body = await xeroPayrollFetch('/Employees?page=1');
      return res.status(200).json({ ok: true, payroll: true, employees: (body.Employees || []).length });
    } catch (err) {
      return res.status(200).json({ ok: false, payroll: false, error: err.message.slice(0, 300) });
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const b = req.body || {};
  const first = s(b.first_name);
  const last = s(b.family_name);
  const dob = s(b.dob);
  const state = s(b.state).toUpperCase();
  const missing = [];
  if (!first) missing.push('first name');
  if (!last) missing.push('family name');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) missing.push('date of birth');
  if (!s(b.address)) missing.push('street address');
  if (!s(b.suburb)) missing.push('suburb');
  if (!STATES.includes(state)) missing.push('state');
  if (!/^\d{4}$/.test(s(b.postcode))) missing.push('postcode');
  if (missing.length) return res.status(400).json({ ok: false, error: `Xero Payroll needs: ${missing.join(', ')}`, missing });

  try {
    const where = `FirstName=="${first.replace(/"/g, '')}"&&LastName=="${last.replace(/"/g, '')}"`;
    const found = await xeroPayrollFetch(`/Employees?where=${encodeURIComponent(where)}`);
    const same = (found.Employees || []).find((e) => {
      const d = String(e.DateOfBirth || '');
      const ms = /\/Date\((-?\d+)/.exec(d);
      const ymd = ms ? new Date(Number(ms[1])).toISOString().slice(0, 10) : d.slice(0, 10);
      return !ymd || ymd === dob;
    });
    if (same) return res.status(200).json({ ok: true, created: false, employeeId: same.EmployeeID });

    const employee = {
      FirstName: first,
      LastName: last,
      DateOfBirth: xeroDate(dob),
      HomeAddress: { AddressLine1: s(b.address), City: s(b.suburb), Region: state, PostalCode: s(b.postcode), Country: 'AUSTRALIA' },
      ...(s(b.email) ? { Email: s(b.email) } : {}),
      ...(s(b.mobile) ? { Mobile: s(b.mobile) } : {}),
      ...(GENDER[s(b.gender).toLowerCase()] ? { Gender: GENDER[s(b.gender).toLowerCase()] } : {}),
      ...(/^\d{4}-\d{2}-\d{2}$/.test(s(b.start_date)) ? { StartDate: xeroDate(s(b.start_date)) } : {}),
    };
    const body = await xeroPayrollFetch('/Employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([employee]),
    });
    const saved = (body.Employees || [])[0];
    return res.status(200).json({ ok: true, created: true, employeeId: saved ? saved.EmployeeID : null });
  } catch (err) {
    console.error('xero payroll-employee failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Xero Payroll write failed', detail: err.message.slice(0, 300) });
  }
};
