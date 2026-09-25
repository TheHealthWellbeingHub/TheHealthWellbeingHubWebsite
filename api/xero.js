// Vercel serverless function — one entry point for the Xero actions, because
// the Hobby plan allows only 12 functions per deployment. Each action lives
// in api/_xero-actions/ (underscore folders are not deployed as functions)
// and keeps its own auth, method and body checks.
//
//   /api/xero?action=list-contacts    GET   contacts with their ShiftCare client IDs
//   /api/xero?action=get-invoice      GET   one invoice, including drafts (?id=)
//   /api/xero?action=create-invoice   POST  a DRAFT invoice for one client and period
//   /api/xero?action=admin-contact    POST  create a contact or set its AccountNumber/status
//   /api/xero?action=admin-invoice    POST  change a draft invoice's status (e.g. DELETED)
//
// The read-only health check stays at /api/xero-status.
const ACTIONS = {
  'list-contacts': () => require('./_xero-actions/list-contacts'),
  'get-invoice': () => require('./_xero-actions/get-invoice'),
  'create-invoice': () => require('./_xero-actions/create-invoice'),
  'admin-contact': () => require('./_xero-actions/admin-contact'),
  'admin-invoice': () => require('./_xero-actions/admin-invoice'),
};

module.exports = (req, res) => {
  const action = String((req.query || {}).action || '');
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) {
    return res.status(404).json({ ok: false, error: `Unknown action — use one of: ${Object.keys(ACTIONS).join(', ')}` });
  }
  return ACTIONS[action]()(req, res);
};
