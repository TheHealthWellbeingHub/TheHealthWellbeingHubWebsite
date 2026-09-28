// Draft sales invoices built from lines we already have — used by monthly
// Support Coordination (api/_sc-invoicing.js) and the create-draft action.
// Not a route (Vercel skips "_" files). Same house style as the weekly
// invoices: Standard theme, account 201, GST Free Income, tax exclusive, no
// invoice number (Xero gives the next), always DRAFT.
const { xeroApiFetch } = require('./_xero');
const { xeroSetup, ACCOUNT_CODE } = require('./_invoicing');

/** "1/9/2026 - 21/09/2026\n…" -> "2026-09-01" (null when the text has no date first). */
function periodStart(description) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(description || '');
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

/**
 * Live invoices to this contact that already cover a period starting on one
 * of `starts` (YYYY-MM-DD) — matched by the same reference (any case), or by
 * a line naming one of `names`, since references drift ("Htoo SC"/"Htwoo SC").
 */
async function findExisting({ contactId, starts, reference, names = [] }) {
  const earliest = [...starts].sort()[0];
  const from = new Date(Date.parse(`${earliest}T00:00:00Z`) - 120 * 86400000).toISOString().slice(0, 10).split('-');
  const where = `Type=="ACCREC" AND Contact.ContactID==guid("${contactId}") AND Date>=DateTime(${from.join(',')})`;
  const found = [];
  for (let page = 1; page < 10; page += 1) {
    const batch = (await xeroApiFetch(`/Invoices?where=${encodeURIComponent(where)}&page=${page}`)).Invoices || [];
    found.push(...batch);
    if (batch.length < 100) break;
  }
  const ref = String(reference || '').trim().toLowerCase();
  const lowerNames = names.map((n) => String(n).trim().toLowerCase()).filter(Boolean);
  return found
    .filter((i) => i.Status !== 'DELETED' && i.Status !== 'VOIDED')
    .filter((i) => (i.LineItems || []).some((l) => {
      if (!starts.has(periodStart(l.Description))) return false;
      const desc = String(l.Description || '').toLowerCase();
      return String(i.Reference || '').trim().toLowerCase() === ref || lowerNames.some((n) => desc.includes(n));
    }))
    .map((i) => ({ id: i.InvoiceID, number: i.InvoiceNumber, status: i.Status, date: i.DateString, total: i.Total }));
}

/** The Xero invoice body. lines: [{ description, quantity, unitAmount }]. */
async function draftBody({ contactId, reference, date, dueDate, lines }) {
  const { brandingThemeId, taxType } = await xeroSetup();
  return {
    Type: 'ACCREC',
    Contact: { ContactID: contactId },
    Date: date,
    DueDate: dueDate || date,
    Reference: reference,
    LineAmountTypes: 'Exclusive',
    Status: 'DRAFT',
    ...(brandingThemeId ? { BrandingThemeID: brandingThemeId } : {}),
    LineItems: lines.map((l) => ({
      Description: l.description,
      Quantity: l.quantity,
      UnitAmount: l.unitAmount,
      AccountCode: ACCOUNT_CODE,
      TaxType: taxType,
    })),
  };
}

async function saveDraft(invoice) {
  const body = await xeroApiFetch('/Invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Invoices: [invoice] }),
  });
  const saved = body.Invoices && body.Invoices[0];
  if (!saved || saved.HasErrors) {
    const errors = ((saved && saved.ValidationErrors) || []).map((e) => e.Message).join('; ');
    throw new Error(`Xero didn't create the invoice${errors ? `: ${errors}` : ''}`);
  }
  return { invoiceId: saved.InvoiceID, invoiceNumber: saved.InvoiceNumber, status: saved.Status, total: saved.Total };
}

module.exports = { periodStart, findExisting, draftBody, saveDraft };
