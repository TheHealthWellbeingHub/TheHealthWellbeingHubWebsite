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

/** Xero answers 502/503/504 under load and 429 past 60 calls a minute;
 * wait and try again (twice) before giving up. */
async function withRetry(fn) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const busy = /failed: 429\b/.test(err.message);
      if (attempt >= 3 || !(busy || /failed: 50[234]\b/.test(err.message))) throw err;
      await new Promise((r) => setTimeout(r, (busy ? 8000 : 1500) * attempt));
    }
  }
}

/**
 * Live invoices to this contact that already cover a period starting on one
 * of `starts` (YYYY-MM-DD) — matched by the same reference (any case), or by
 * a line naming one of `names`, since references drift ("Htoo SC"/"Htwoo SC").
 * An invoice whose reference is in `otherReferences` belongs to another
 * client of the same plan manager, so a name alone never matches it — one
 * person can have two clients ("Ismail SC" and "Ismail Training").
 */
async function findExisting({ contactId, starts, reference, names = [], otherReferences = [], cache = null }) {
  const earliest = [...starts].sort()[0];
  // A period is invoiced after it starts, so invoices dated from shortly
  // before its start are enough (a wider window times out on big contacts).
  const from = new Date(Date.parse(`${earliest}T00:00:00Z`) - 10 * 86400000).toISOString().slice(0, 10).split('-');
  const where = `Type=="ACCREC" AND Contact.ContactID==guid("${contactId}") AND Date>=DateTime(${from.join(',')})`;
  // One read per plan manager per run: many clients share one (pass a Map as cache).
  let found = cache && cache.get(where);
  if (!found) {
    found = [];
    for (let page = 1; page < 10; page += 1) {
      const batch = (await withRetry(() => xeroApiFetch(`/Invoices?where=${encodeURIComponent(where)}&page=${page}`))).Invoices || [];
      found.push(...batch);
      if (batch.length < 100) break;
    }
    if (cache) cache.set(where, found);
  }
  const ref = String(reference || '').trim().toLowerCase();
  const lowerNames = names.map((n) => String(n).trim().toLowerCase()).filter(Boolean);
  const others = new Set(otherReferences.map((r) => String(r).trim().toLowerCase()).filter((r) => r && r !== ref));
  return found
    .filter((i) => i.Status !== 'DELETED' && i.Status !== 'VOIDED')
    .filter((i) => (i.LineItems || []).some((l) => {
      if (!starts.has(periodStart(l.Description))) return false;
      const invRef = String(i.Reference || '').trim().toLowerCase();
      if (invRef === ref) return true;
      if (others.has(invRef)) return false;
      const desc = String(l.Description || '').toLowerCase();
      return lowerNames.some((n) => desc.includes(n));
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
  const body = await withRetry(() => xeroApiFetch('/Invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Invoices: [invoice] }),
  }));
  const saved = body.Invoices && body.Invoices[0];
  if (!saved || saved.HasErrors) {
    const errors = ((saved && saved.ValidationErrors) || []).map((e) => e.Message).join('; ');
    throw new Error(`Xero didn't create the invoice${errors ? `: ${errors}` : ''}`);
  }
  return { invoiceId: saved.InvoiceID, invoiceNumber: saved.InvoiceNumber, status: saved.Status, total: saved.Total };
}

module.exports = { periodStart, findExisting, draftBody, saveDraft, withRetry };
