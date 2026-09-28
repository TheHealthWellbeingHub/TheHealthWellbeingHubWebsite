// Sales invoices issued on or after a date, in every status including DRAFT
// (the read-only Xero tools in chat can't see drafts). Used to check what's
// already been invoiced before drafting more.
//
// GET ?since=YYYY-MM-DD[&reference=text][&page=N] — 100 per page, with line items.
const { isConfigured, xeroApiFetch, tokenMatches } = require('../_xero');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!isConfigured() || !XERO_STATUS_TOKEN) return res.status(503).json({ ok: false, error: 'not_configured' });
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, XERO_STATUS_TOKEN)) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { since, reference } = req.query || {};
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(since || '');
  if (!m) return res.status(400).json({ ok: false, error: 'since (YYYY-MM-DD) is required' });
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let where = `Type=="ACCREC" AND Date>=DateTime(${m[1]},${m[2]},${m[3]})`;
  if (reference) where += ` AND Reference.Contains("${String(reference).replace(/"/g, '')}")`;

  try {
    const body = await xeroApiFetch(`/Invoices?where=${encodeURIComponent(where)}&order=Date&page=${page}`);
    const invoices = (body.Invoices || []).map((i) => ({
      id: i.InvoiceID,
      number: i.InvoiceNumber,
      reference: i.Reference,
      status: i.Status,
      date: i.DateString,
      contact: i.Contact && i.Contact.Name,
      contactId: i.Contact && i.Contact.ContactID,
      total: i.Total,
      lines: (i.LineItems || []).map((l) => ({
        description: l.Description,
        quantity: l.Quantity,
        unitAmount: l.UnitAmount,
        itemCode: l.ItemCode || null,
        accountCode: l.AccountCode,
        taxType: l.TaxType,
      })),
    }));
    return res.status(200).json({ ok: true, page, count: invoices.length, invoices });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'Xero read failed', detail: err.message });
  }
};
