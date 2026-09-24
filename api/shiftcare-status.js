// Diagnostic-only: confirms the ShiftCare API credentials work and reports
// the SHAPE of one invoiceable-items response (top-level keys, item count,
// and the keys of the first item) — never actual amounts, client names or
// other real data. This exists to verify the real API's field names before
// any parsing logic is built on top of them, without pulling real
// participant billing data into a chat transcript to do it.
//
// Reuses the same admin bearer token as xero-status.js (XERO_STATUS_TOKEN
// — named for where it was first introduced, but functions as a general
// "internal diagnostics" credential, not something Xero-specific).
const { isConfigured, shiftcareApiFetch } = require('./_shiftcare');
const crypto = require('crypto');

const STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';

function tokenMatches(given, want) {
  if (typeof given !== 'string' || !want) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function keysOnly(obj) {
  if (Array.isArray(obj)) return `array[${obj.length}]`;
  if (obj && typeof obj === 'object') return Object.keys(obj);
  return typeof obj;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!isConfigured() || !STATUS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, STATUS_TOKEN) && !tokenMatches(req.query.token, STATUS_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  try {
    const body = await shiftcareApiFetch('/api/v3/invoiceable_items', {
      start_date_in_account_time_zone: fmt(weekAgo),
      end_date_in_account_time_zone: fmt(today),
      per_page: 1,
    });
    const topLevelKeys = keysOnly(body);
    const itemsKey = Array.isArray(body) ? null : Object.keys(body).find((k) => Array.isArray(body[k]));
    const items = Array.isArray(body) ? body : (itemsKey ? body[itemsKey] : []);
    const firstItem = items[0] || null;
    const firstItemKeys = firstItem ? keysOnly(firstItem) : null;
    const totalsKeys = firstItem && firstItem.totals ? keysOnly(firstItem.totals) : null;
    const lineItems = firstItem && firstItem.line_items;
    const firstLineItemKeys = Array.isArray(lineItems) && lineItems[0] ? keysOnly(lineItems[0]) : null;

    return res.status(200).json({
      ok: true,
      connected: true,
      dateRangeUsed: { from: fmt(weekAgo), to: fmt(today) },
      topLevelKeys,
      paginationKeys: body.pagination ? keysOnly(body.pagination) : null,
      itemsFieldName: itemsKey,
      itemCount: items.length,
      firstItemKeys,
      totalsKeys,
      lineItemsCount: Array.isArray(lineItems) ? lineItems.length : null,
      firstLineItemKeys,
    });
  } catch (err) {
    return res.status(502).json({ ok: false, connected: false, error: 'shiftcare_error', detail: err.message });
  }
};
