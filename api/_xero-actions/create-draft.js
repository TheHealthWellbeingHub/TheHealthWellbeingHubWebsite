// One DRAFT sales invoice from lines given in the request — for invoices that
// aren't built from the ShiftCare roster, e.g. monthly Support Coordination.
// Same house style as the weekly invoices: Standard branding theme, account
// 201, GST Free Income, amounts tax exclusive, invoice number left to Xero.
// Always a DRAFT; a person approves and sends it.
//
// POST { contactId | contactName, reference, date, dueDate?, lines: [{ description, quantity, unitAmount }], dryRun?, allowDuplicate? }
// Each line starts with its period ("01/09/2026 - 21/09/2026"). Refuses (unless
// allowDuplicate) when the contact already has a live invoice with the same
// reference covering a period that starts on the same date.
const { isConfigured, xeroApiFetch, tokenMatches } = require('../_xero');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';
const ACCOUNT_CODE = process.env.INVOICE_ACCOUNT_CODE || '201';
const TAX_RATE_NAME = process.env.INVOICE_TAX_RATE_NAME || 'GST Free Income';
const BRANDING_THEME_NAME = process.env.INVOICE_BRANDING_THEME || 'Standard';
const ymd = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "1/9/2026 - 21/09/2026\n…" -> "2026-09-01" (null when the line has no date). */
function periodStart(description) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(description || '');
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

async function findContact({ contactId, contactName }) {
  if (contactId) {
    const body = await xeroApiFetch(`/Contacts/${encodeURIComponent(contactId)}`);
    return (body.Contacts || [])[0] || null;
  }
  const where = `Name=="${String(contactName).replace(/"/g, '\\"')}"`;
  const body = await xeroApiFetch(`/Contacts?where=${encodeURIComponent(where)}`);
  return (body.Contacts || []).filter((c) => c.ContactStatus === 'ACTIVE')[0] || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!isConfigured() || !XERO_STATUS_TOKEN) return res.status(503).json({ ok: false, error: 'not_configured' });
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!tokenMatches(bearer, XERO_STATUS_TOKEN)) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { contactId, contactName, reference, date, dueDate, lines, dryRun, allowDuplicate } = req.body || {};
  if ((!contactId && !contactName) || !reference || !ymd.test(date || '') || (dueDate && !ymd.test(dueDate))) {
    return res.status(400).json({ ok: false, error: 'contactId or contactName, reference and date (YYYY-MM-DD) are required' });
  }
  const cleanLines = Array.isArray(lines)
    ? lines.map((l) => ({ description: String(l.description || ''), quantity: Number(l.quantity), unitAmount: Number(l.unitAmount) }))
    : [];
  if (!cleanLines.length || cleanLines.some((l) => !l.description || !(l.quantity > 0) || !(l.unitAmount >= 0))) {
    return res.status(400).json({ ok: false, error: 'lines need a description, a quantity above 0 and a unit amount' });
  }

  try {
    const contact = await findContact({ contactId, contactName });
    if (!contact || contact.ContactStatus !== 'ACTIVE') {
      return res.status(404).json({ ok: false, error: `No active Xero contact ${contactId || `called "${contactName}"`}` });
    }

    // Already invoiced = a live invoice to this contact with the same
    // reference whose line covers a period starting on the same date (the
    // first date in the description, e.g. "01/09/2026 - 21/09/2026").
    const earlier = new Date(Date.parse(`${date}T00:00:00Z`) - 200 * 86400000).toISOString().slice(0, 10).split('-');
    const where = `Type=="ACCREC" AND Contact.ContactID==guid("${contact.ContactID}") AND Reference=="${String(reference).replace(/"/g, '')}" AND Date>=DateTime(${earlier.join(',')})`;
    const starts = new Set(cleanLines.map((l) => periodStart(l.description)).filter(Boolean));
    const found = [];
    for (let page = 1; page < 5; page += 1) {
      const batch = (await xeroApiFetch(`/Invoices?where=${encodeURIComponent(where)}&page=${page}`)).Invoices || [];
      found.push(...batch);
      if (batch.length < 100) break;
    }
    const dupes = found
      .filter((i) => i.Status !== 'DELETED' && i.Status !== 'VOIDED')
      .filter((i) => (i.LineItems || []).some((l) => starts.has(periodStart(l.Description))))
      .map((i) => ({ id: i.InvoiceID, number: i.InvoiceNumber, status: i.Status, date: i.DateString, total: i.Total }));
    if (!starts.size && !allowDuplicate) {
      return res.status(400).json({ ok: false, error: 'each line should start with its period, e.g. "01/09/2026 - 21/09/2026"' });
    }
    if (dupes.length && !allowDuplicate) {
      return res.status(409).json({ ok: false, skipped: 'this period is already invoiced', existing: dupes });
    }

    const [themes, taxRates] = await Promise.all([xeroApiFetch('/BrandingThemes'), xeroApiFetch('/TaxRates')]);
    const theme = (themes.BrandingThemes || []).find((t) => t.Name === BRANDING_THEME_NAME);
    const tax = (taxRates.TaxRates || []).find((t) => t.Name === TAX_RATE_NAME && t.Status === 'ACTIVE');
    if (!tax) throw new Error(`No active Xero tax rate called "${TAX_RATE_NAME}"`);

    const invoice = {
      Type: 'ACCREC',
      Contact: { ContactID: contact.ContactID },
      Date: date,
      DueDate: dueDate || date,
      Reference: reference,
      LineAmountTypes: 'Exclusive',
      Status: 'DRAFT',
      ...(theme ? { BrandingThemeID: theme.BrandingThemeID } : {}),
      LineItems: cleanLines.map((l) => ({
        Description: l.description,
        Quantity: l.quantity,
        UnitAmount: l.unitAmount,
        AccountCode: ACCOUNT_CODE,
        TaxType: tax.TaxType,
      })),
    };
    const total = Math.round(cleanLines.reduce((s, l) => s + l.quantity * l.unitAmount, 0) * 100) / 100;
    if (dryRun) return res.status(200).json({ ok: true, dryRun: true, contact: contact.Name, total, invoice });

    const body = await xeroApiFetch('/Invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Invoices: [invoice] }),
    });
    const saved = (body.Invoices || [])[0];
    return res.status(200).json({
      ok: true,
      invoiceId: saved.InvoiceID,
      invoiceNumber: saved.InvoiceNumber,
      status: saved.Status,
      contact: contact.Name,
      total: saved.Total,
      link: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${saved.InvoiceID}`,
    });
  } catch (err) {
    console.error('create-draft failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Draft creation failed', detail: err.message });
  }
};
