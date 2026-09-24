// One-time (or reconnect) entry point: an admin visits this URL in a
// browser, it redirects to Xero's own login/consent screen, and Xero sends
// the result to xero-callback.js. Nothing is copy-pasted by hand.
//
// Auth is a query-string token, not a header, because this is a browser
// navigation, not an API call — reuses XERO_STATUS_TOKEN (already
// provisioned in Vercel for this Xero workstream) rather than adding a
// second secret with the same purpose.
const { isConfigured, authorizeUrl, tokenMatches } = require('./_xero');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  if (!isConfigured() || !XERO_STATUS_TOKEN) {
    console.error('XERO CONNECT NOT CONFIGURED — missing XERO_CLIENT_ID / XERO_CLIENT_SECRET / XERO_STATUS_TOKEN');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  if (!tokenMatches(req.query.token, XERO_STATUS_TOKEN)) {
    return res.status(401).send('Unauthorized');
  }

  res.writeHead(302, { Location: authorizeUrl() });
  res.end();
};
