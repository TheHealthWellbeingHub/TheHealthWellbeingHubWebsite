// Weekly invoicing automation — step 1 of 2. Pulls what ShiftCare says is
// invoiceable for the period, applies the business-rule layer, matches
// each client to a Xero contact, and emails a draft for human review.
//
// Deliberately does NOT create or touch any Xero invoice. That is a
// separate, later function requiring its own explicit per-batch
// confirmation — the same bar ShiftCare's own create_invoice tool holds
// itself to. This function only ever reads (ShiftCare, Xero contacts) and
// sends one internal email; nothing external-facing happens here.
//
// Auth: Authorization: Bearer <CRON_SECRET> (set automatically by Vercel
// Cron when CRON_SECRET is configured) or <XERO_STATUS_TOKEN> for a manual
// trigger while testing. Same not_configured pattern as the other
// endpoints in this repo when required env vars are missing.
const { isConfigured: shiftcareConfigured, shiftcareApiFetch } = require('./_shiftcare');
const { isConfigured: xeroConfigured, listAllContacts } = require('./_xero');
const { isConfigured: mailConfigured, sendEmail } = require('./_mail');
const crypto = require('crypto');

const CRON_SECRET = process.env.CRON_SECRET || '';
const XERO_STATUS_TOKEN = process.env.XERO_STATUS_TOKEN || '';
const ADMIN_EMAIL = process.env.INVOICE_DRAFT_EMAIL || 'officethehealthwellbeinghub@gmail.com';
// Comma-separated ShiftCare client IDs to never auto-draft (funding
// exhausted, on hold, etc.) — kept in Vercel env vars, never in git, per
// this repo's rule that participant-identifying data never lives in the
// repository. IDs are not identifying on their own without ShiftCare
// access, unlike a name would be.
const SKIP_CLIENT_IDS = new Set(
  (process.env.INVOICE_DRAFT_SKIP_CLIENT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

function tokenMatches(given, want) {
  if (typeof given !== 'string' || !want) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Calendar date (YYYY-MM-DD) math done against Brisbane local time — QLD
// does not observe daylight saving, so a fixed +10h offset from UTC holds
// year-round. Defaults to the most recent complete Monday-Sunday week.
function defaultPeriod() {
  const nowBrisbane = new Date(Date.now() + 10 * 60 * 60 * 1000);
  const dow = nowBrisbane.getUTCDay(); // 0 = Sunday
  const daysSinceLastSunday = dow === 0 ? 7 : dow; // always land on a PAST Sunday
  const end = new Date(nowBrisbane);
  end.setUTCDate(end.getUTCDate() - daysSinceLastSunday);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

async function fetchAllInvoiceableItems(start, end) {
  const clients = [];
  let cursor;
  do {
    const body = await shiftcareApiFetch('/api/v3/invoiceable_items', {
      start_date_in_account_time_zone: start,
      end_date_in_account_time_zone: end,
      per_page: 100,
      cursor,
    });
    clients.push(...(body.clients || []));
    cursor = body.pagination && body.pagination.has_more ? body.pagination.next_cursor : null;
  } while (cursor);
  return clients;
}

// Xero invoices go to the participant's plan manager organisation, not the
// participant by name — confirmed against real ShiftCare records, where
// the plan manager is (inconsistently, if at all) buried in free-text
// notes alongside unrelated clinical content this code must never parse.
// The reliable fix: each Xero contact's AccountNumber field is set, once,
// to the matching ShiftCare client_id — an exact key, not a name guess.
function findContactMatch(clientId, contacts) {
  const target = String(clientId).trim();
  const matches = contacts.filter((c) => (c.AccountNumber || '').trim() === target);
  if (matches.length === 1) return { status: 'matched', contact: matches[0] };
  if (matches.length > 1) return { status: 'ambiguous', count: matches.length };
  return { status: 'unmatched' };
}

function money(n) {
  return `$${Number(n).toFixed(2)}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!shiftcareConfigured() || !xeroConfigured() || !mailConfigured() || !XERO_STATUS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const authorized = tokenMatches(bearer, CRON_SECRET) || tokenMatches(bearer, XERO_STATUS_TOKEN);
  if (!authorized) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const { start, end } = req.query.start && req.query.end
    ? { start: req.query.start, end: req.query.end }
    : defaultPeriod();

  try {
    const [clients, contacts] = await Promise.all([
      fetchAllInvoiceableItems(start, end),
      listAllContacts(),
    ]);

    const draft = [];
    const skipped = [];
    for (const c of clients) {
      if (SKIP_CLIENT_IDS.has(String(c.client_id))) {
        skipped.push({ client_id: c.client_id, client_name: c.client_name, reason: 'on skip list' });
        continue;
      }
      const subTotal = Number(c.totals?.sub_total || 0);
      if (subTotal <= 0) {
        skipped.push({ client_id: c.client_id, client_name: c.client_name, reason: 'nothing to invoice' });
        continue;
      }
      const match = findContactMatch(c.client_id, contacts);
      const warnings = [];
      if (c.excluded_count > 0) warnings.push(`${c.excluded_count} item(s) excluded by ShiftCare — check before invoicing`);
      if (match.status === 'unmatched') warnings.push(`No Xero contact has Account Number = ${c.client_id} — set it on the right contact, then re-run`);
      if (match.status === 'ambiguous') warnings.push(`${match.count} Xero contacts share Account Number ${c.client_id} — fix the duplicate, then re-run`);

      draft.push({
        client_id: c.client_id,
        client_name: c.client_name,
        fund_name: c.fund_name,
        payment_type: c.payment_type,
        subTotal,
        estimatedTotal: Number(c.totals?.estimated_total || subTotal),
        xeroContact: match.status === 'matched' ? { id: match.contact.ContactID, name: match.contact.Name } : null,
        warnings,
      });
    }

    const totalEstimated = draft.reduce((sum, d) => sum + d.estimatedTotal, 0);
    const needsAttention = draft.filter((d) => d.warnings.length);

    const lines = [
      `Weekly invoice draft — ${start} to ${end}`,
      '',
      `${draft.length} participant(s), ${money(totalEstimated)} total (estimated, tax-inclusive).`,
      needsAttention.length ? `${needsAttention.length} need attention before invoicing.` : 'No issues flagged.',
      '',
      'No invoices have been created. This is a draft for review only.',
      '',
      ...draft.map((d) =>
        `${d.client_name} — ${money(d.estimatedTotal)} — ${d.xeroContact ? `Xero: ${d.xeroContact.name}` : 'Xero: NOT MATCHED'}` +
        (d.warnings.length ? `\n  ⚠ ${d.warnings.join('; ')}` : '')
      ),
      ...(skipped.length ? ['', `Skipped (${skipped.length}):`, ...skipped.map((s) => `  ${s.client_name} — ${s.reason}`)] : []),
    ];
    const text = lines.join('\n');
    const html = `<pre style="font:14px/1.5 monospace">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`;

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Weekly invoice draft ${start} to ${end} — ${draft.length} participants, ${money(totalEstimated)}`,
      text,
      html,
    });

    return res.status(200).json({
      ok: true,
      period: { start, end },
      participantCount: draft.length,
      totalEstimated,
      needsAttentionCount: needsAttention.length,
      skippedCount: skipped.length,
      emailedTo: ADMIN_EMAIL,
      draft,
      skipped,
    });
  } catch (err) {
    console.error('weekly-invoice-draft failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Draft build failed', detail: err.message });
  }
};
