// The plan manager's Xero contact, made sure of from the Command Centre's
// invoicing settings: found by exact name (the weekly draft matches contacts
// by name — _invoicing.js findContact), or created with that name if Xero
// has no active contact called that. Never renames, archives or merges.
//
// POST body: { name, email? }
// Auth: Bearer <XERO_STATUS_TOKEN>, or the Command Centre's send token
// (SEND_EMAIL_TOKEN / COMMAND_CENTRE_SEND_TOKEN) — this action can only add a
// contact, never change one.
const { isConfigured, xeroApiFetch, tokenMatches } = require('../_xero');

const TOKENS = [process.env.XERO_STATUS_TOKEN, process.env.SEND_EMAIL_TOKEN, process.env.COMMAND_CENTRE_SEND_TOKEN].filter(Boolean);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!isConfigured() || !TOKENS.length) return res.status(503).json({ ok: false, error: 'not_configured' });
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!TOKENS.some((t) => tokenMatches(bearer, t))) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const name = String((req.body || {}).name || '').trim().replace(/\s+/g, ' ');
  const email = String((req.body || {}).email || '').trim();
  if (!name || name.length > 255) return res.status(400).json({ ok: false, error: 'name is required' });

  try {
    const where = `Name=="${name.replace(/"/g, '\\"')}"`;
    const found = await xeroApiFetch(`/Contacts?where=${encodeURIComponent(where)}`);
    const active = (found.Contacts || []).find((c) => c.ContactStatus === 'ACTIVE');
    if (active) return res.status(200).json({ ok: true, created: false, contact: { id: active.ContactID, name: active.Name } });
    const archived = (found.Contacts || []).find((c) => c.ContactStatus === 'ARCHIVED');
    if (archived) {
      return res.status(409).json({ ok: false, error: `Xero has an archived contact called "${name}" — restore it in Xero rather than making a second one.` });
    }
    const contact = { Name: name };
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) contact.EmailAddress = email;
    const body = await xeroApiFetch('/Contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Contacts: [contact] }),
    });
    const saved = body.Contacts && body.Contacts[0];
    return res.status(200).json({ ok: true, created: true, contact: saved ? { id: saved.ContactID, name: saved.Name } : null });
  } catch (err) {
    console.error('xero ensure-contact failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Xero write failed', detail: err.message });
  }
};
