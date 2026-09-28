// One DRAFT sales invoice from lines given in the request — for invoices that
// aren't built from the ShiftCare roster, e.g. a one-off Support Coordination
// month. Same house style as the other drafts (api/_xero-drafts.js). Always a
// DRAFT; a person approves and sends it.
//
// POST { contactId | contactName, reference, date, dueDate?, lines: [{ description, quantity, unitAmount }], dryRun?, allowDuplicate? }
// Each line starts with its period ("01/09/2026 - 21/09/2026"). Refuses (unless
// allowDuplicate) when the contact already has a live invoice with the same
// reference covering a period that starts on the same date.
const { isConfigured, xeroApiFetch, tokenMatches } = require('../_xero');
const { findContact } = require('../_invoicing');
const { periodStart, findExisting, draftBody, saveDraft } = require('../_xero-drafts');

const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';
const ymd = /^\d{4}-\d{2}-\d{2}$/;

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
  const starts = new Set(cleanLines.map((l) => periodStart(l.description)).filter(Boolean));
  if (!starts.size && !allowDuplicate) {
    return res.status(400).json({ ok: false, error: 'each line should start with its period, e.g. "01/09/2026 - 21/09/2026"' });
  }

  try {
    const contact = contactId
      ? ((await xeroApiFetch(`/Contacts/${encodeURIComponent(contactId)}`)).Contacts || [])[0]
      : await findContact(contactName);
    if (!contact || contact.ContactStatus !== 'ACTIVE') {
      return res.status(404).json({ ok: false, error: `No active Xero contact ${contactId || `called "${contactName}"`}` });
    }
    if (!allowDuplicate) {
      const existing = await findExisting({ contactId: contact.ContactID, starts, reference });
      if (existing.length) return res.status(409).json({ ok: false, skipped: 'this period is already invoiced', existing });
    }
    const invoice = await draftBody({ contactId: contact.ContactID, reference, date, dueDate, lines: cleanLines });
    const total = Math.round(cleanLines.reduce((s, l) => s + l.quantity * l.unitAmount, 0) * 100) / 100;
    if (dryRun) return res.status(200).json({ ok: true, dryRun: true, contact: contact.Name, total, invoice });
    const saved = await saveDraft(invoice);
    return res.status(200).json({
      ok: true,
      ...saved,
      contact: contact.Name,
      link: `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${saved.invoiceId}`,
    });
  } catch (err) {
    console.error('create-draft failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Draft creation failed', detail: err.message });
  }
};
