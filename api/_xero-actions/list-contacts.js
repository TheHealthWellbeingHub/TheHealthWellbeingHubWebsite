// Diagnostic-only: lists Xero contacts (id, name, Account Number, status).
// Used to reconcile which real contacts still need their Account Number
// tagged with a matching ShiftCare client_id — see weekly-invoice-draft.js.
const { isConfigured, listAllContacts, tokenMatches } = require('../_xero');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!isConfigured() || !XERO_STATUS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, XERO_STATUS_TOKEN) && !tokenMatches(req.query.token, XERO_STATUS_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    const contacts = await listAllContacts();
    return res.status(200).json({
      ok: true,
      count: contacts.length,
      contacts: contacts.map((c) => ({
        id: c.ContactID,
        name: c.Name,
        accountNumber: c.AccountNumber || null,
        status: c.ContactStatus,
        isCustomer: c.IsCustomer,
      })),
    });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'Xero read failed', detail: err.message });
  }
};
