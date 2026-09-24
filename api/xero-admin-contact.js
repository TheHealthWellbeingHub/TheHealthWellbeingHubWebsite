// Small admin utility: create a Xero contact, or set the AccountNumber on
// an existing one, by name. Built to test the weekly invoice draft's
// contact-matching end to end with fake data, but doubles as the real tool
// for tagging each of the ~40 real plan-manager contacts with its matching
// ShiftCare client_id — see weekly-invoice-draft.js for why Account Number
// is the matching key instead of a name guess.
//
// POST body: { name, accountNumber, contactId? }
// - No contactId: creates a new contact with that name + Account Number.
// - contactId given: updates just that contact's Account Number (name is
//   ignored — Xero's POST /Contacts upserts by ContactID when included).
const { isConfigured, xeroApiFetch, tokenMatches } = require('./_xero');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!isConfigured() || !XERO_STATUS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, XERO_STATUS_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const { name, accountNumber, contactId } = req.body || {};
  if (!accountNumber || (!contactId && !name)) {
    return res.status(400).json({ ok: false, error: 'name (or contactId) and accountNumber are required' });
  }

  const contact = { AccountNumber: String(accountNumber) };
  if (contactId) contact.ContactID = contactId;
  if (name) contact.Name = name;

  try {
    const body = await xeroApiFetch('/Contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Contacts: [contact] }),
    });
    const saved = body.Contacts?.[0];
    return res.status(200).json({
      ok: true,
      contact: saved ? { id: saved.ContactID, name: saved.Name, accountNumber: saved.AccountNumber } : null,
    });
  } catch (err) {
    console.error('xero-admin-contact failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Xero write failed', detail: err.message });
  }
};
