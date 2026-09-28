// Vercel serverless function — the automatic parts of workflow 03
// (api/_lib/onboarding.js). One route for both, to stay inside Vercel's
// function limit.
//
// POST { action: "send", lead_id }
//   Sends the Onboarding email for a referral that's going ahead. Called by
//   the Command Centre when an outcome is recorded as going ahead.
//   Auth: Authorization: Bearer <SEND_EMAIL_TOKEN> or <COMMAND_CENTRE_SEND_TOKEN>.
//
// POST { action: "forms-attach", id, file: { filename, form, content_base64, drive_file_id? } }
//   Stores one returned form's file (≤3MB, one per call to stay under
//   Vercel's body limit) against a queued return, before it's processed.
//   Same rule as below: only for a row that's queued and still pending.
//
// POST { action: "forms-process", id? }
//   Processes forms the hourly email agent queued in onboarding_form_returns
//   (one row by id, or up to 10 pending). No token: it only ever acts on rows
//   already in that table, which the public can't write to.
const crypto = require('crypto');
const { sendOnboardingEmail, processFormReturns, attachFormFile } = require('./_lib/onboarding');

const TOKENS = [process.env.SEND_EMAIL_TOKEN || '', process.env.COMMAND_CENTRE_SEND_TOKEN || ''];

function tokenMatches(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7).trim());
  return TOKENS.some((token) => {
    if (!token) return false;
    const want = Buffer.from(token);
    return given.length === want.length && crypto.timingSafeEqual(given, want);
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const body = req.body || {};
  try {
    if (body.action === 'send') {
      if (!tokenMatches(req.headers.authorization)) return res.status(401).json({ ok: false, error: 'Unauthorized' });
      if (!UUID_RE.test(String(body.lead_id || ''))) return res.status(400).json({ ok: false, error: 'lead_id is required' });
      const result = await sendOnboardingEmail(body.lead_id);
      return res.status(200).json({ ok: true, ...result });
    }
    if (body.action === 'forms-attach') {
      if (!UUID_RE.test(String(body.id || ''))) return res.status(400).json({ ok: false, error: 'id is required' });
      const stored = await attachFormFile({ id: body.id, file: body.file });
      return res.status(200).json({ ok: true, stored });
    }
    if (body.action === 'forms-process') {
      if (body.id && !UUID_RE.test(String(body.id))) return res.status(400).json({ ok: false, error: 'Invalid id' });
      const results = await processFormReturns({ id: body.id || undefined });
      return res.status(200).json({ ok: true, processed: results.length, results });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action — use "send", "forms-attach" or "forms-process"' });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ ok: false, error: err.message });
    console.error('onboarding endpoint failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Failed', detail: err.message });
  }
};
