// Vercel serverless function — one entry point for the Xero actions, because
// the Hobby plan allows only 12 functions per deployment. Each action lives
// in api/_xero-actions/ (underscore folders are not deployed as functions)
// and keeps its own auth, method and body checks.
//
//   /api/xero?action=list-contacts    GET   contacts with their ShiftCare client IDs
//   /api/xero?action=get-invoice      GET   one invoice, including drafts (?id=)
//   /api/xero?action=list-invoices    GET   invoices since a date, drafts included (?since=)
//   /api/xero?action=create-invoice   POST  one participant's weekly DRAFT invoice (docs/invoicing.md)
//   /api/xero?action=create-draft     POST  one DRAFT invoice from given lines (e.g. Support Coordination)
//   /api/xero?action=sc-monthly       GET   monthly Support Coordination drafts (daily cron, docs/invoicing.md)
//   /api/xero?action=admin-contact    POST  create a contact or set its AccountNumber/status
//   /api/xero?action=ensure-contact   POST  find a contact by name, or create it (Command Centre invoicing)
//   /api/xero?action=payroll-employee GET/POST  can we reach Payroll? / a new support worker as an employee
//   /api/xero?action=admin-invoice    POST  change a draft invoice's status (e.g. DELETED)
//   /api/xero?action=status           GET   read-only health check, also served at /api/xero-status
const ACTIONS = {
  'list-contacts': () => require('./_xero-actions/list-contacts'),
  'get-invoice': () => require('./_xero-actions/get-invoice'),
  'list-invoices': () => require('./_xero-actions/list-invoices'),
  'create-invoice': () => require('./_xero-actions/create-invoice'),
  'create-draft': () => require('./_xero-actions/create-draft'),
  'sc-monthly': () => require('./_xero-actions/sc-monthly'),
  'admin-contact': () => require('./_xero-actions/admin-contact'),
  'ensure-contact': () => require('./_xero-actions/ensure-contact'),
  'payroll-employee': () => require('./_xero-actions/payroll-employee'),
  'admin-invoice': () => require('./_xero-actions/admin-invoice'),
  status: () => require('./_xero-actions/status'),
};

module.exports = (req, res) => {
  const action = String((req.query || {}).action || '');
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) {
    return res.status(404).json({ ok: false, error: `Unknown action — use one of: ${Object.keys(ACTIONS).join(', ')}` });
  }
  return ACTIONS[action]()(req, res);
};
