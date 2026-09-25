// Step 2 of 2, and the only function that ever writes an invoice. Deliberately
// separate from weekly-invoice-draft.js and never referenced by vercel.json's
// cron — this only runs when someone explicitly calls it for one specific
// client, after reviewing that client's line in the draft email.
//
// Always creates the invoice as Xero Status "DRAFT", never "AUTHORISED" —
// nothing is sent to a plan manager automatically. A human still opens it
// in Xero and approves/sends it themselves. That's not a placeholder to
// tighten later; it's the permanent safety margin for a pipeline a human
// only spot-checks, not one they read line by line every week.
//
// POST body: { clientId, start, end } — start/end must match the period
// the draft was built from, so the invoice reflects what was reviewed.
const { isConfigured: shiftcareConfigured, shiftcareApiFetch } = require('./_shiftcare');
const {
  isConfigured: xeroConfigured,
  xeroApiFetch,
  listAllContacts,
  getDefaultRevenueAccountCode,
  tokenMatches,
} = require('./_xero');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!shiftcareConfigured() || !xeroConfigured() || !XERO_STATUS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, XERO_STATUS_TOKEN)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const { clientId, start, end } = req.body || {};
  if (!clientId || !start || !end) {
    return res.status(400).json({ ok: false, error: 'clientId, start and end are required' });
  }

  try {
    const [items, contacts] = await Promise.all([
      shiftcareApiFetch('/api/v3/invoiceable_items', {
        client_id: clientId,
        start_date_in_account_time_zone: start,
        end_date_in_account_time_zone: end,
        per_page: 1,
      }),
      listAllContacts(),
    ]);
    const clientEntry = (items.clients || [])[0];
    if (!clientEntry) return res.status(404).json({ ok: false, error: 'Nothing invoiceable for this client and period' });

    const contact = contacts.find((c) => (c.AccountNumber || '').trim() === String(clientId).trim());
    if (!contact) {
      return res.status(409).json({ ok: false, error: `No Xero contact has Account Number = ${clientId}` });
    }

    const lineItems = (clientEntry.line_items || [])
      .filter((li) => Number(li.amount) > 0)
      .map((li) => ({
        Description: li.description || li.category,
        Quantity: Number(li.quantity) || 1,
        UnitAmount: Number(li.rate) || Number(li.amount),
      }));
    if (!lineItems.length) {
      return res.status(404).json({ ok: false, error: 'No priced line items for this client and period' });
    }

    const accountCode = await getDefaultRevenueAccountCode();
    for (const li of lineItems) li.AccountCode = accountCode;

    const body = await xeroApiFetch('/Invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Invoices: [
          {
            Type: 'ACCREC',
            Contact: { ContactID: contact.ContactID },
            LineItems: lineItems,
            Date: new Date().toISOString().slice(0, 10),
            Reference: `ShiftCare client ${clientId} — ${start} to ${end}`,
            Status: 'DRAFT',
          },
        ],
      }),
    });

    const invoice = body.Invoices?.[0];
    return res.status(200).json({
      ok: true,
      invoiceId: invoice?.InvoiceID,
      invoiceNumber: invoice?.InvoiceNumber,
      status: invoice?.Status,
      total: invoice?.Total,
      xeroContact: contact.Name,
    });
  } catch (err) {
    console.error('xero-create-invoice failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Invoice creation failed', detail: err.message });
  }
};
