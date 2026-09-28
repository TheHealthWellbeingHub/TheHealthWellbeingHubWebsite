// Vercel serverless function — sends any of the 15 emails in
// email-templates/ from the H&W mailbox. HubSpot is no longer used, so this
// is the one send path for templates sent by hand (lead-submit.js sends the
// form acknowledgements 02/03/07/08 itself; the Command Centre sends 05/06).
// Four carry fixed PDF attachments: the Onboarding email (04, two fillable forms
// and the service agreement), the Welcome pack (12, four easy-read guides),
// the Service Agreement follow-up (13, the service agreement) and the new
// support worker welcome (14, the support worker agreement).
//
// One recipient per call, and only the templates listed below. Attachments
// are fixed per template and never chosen by the caller.
//
// Merge fields live in the templates as {{Key}} (required) or
// {{Key|fallback}} (optional — the fallback renders if no value is given).
// Required fields are read from the template itself, so the template stays
// the single source of truth for what an email needs.
//
// Preview: body { dryRun: true } returns the filled subject and HTML, the
// attachment list and any `missing` fields instead of sending — missing
// fields show as [Field Name] in the HTML. `to` is optional for a preview,
// and previews don't count towards the rate limit. The Command Centre uses
// this to show staff the exact email before they confirm the send.
//
// Auth: Authorization: Bearer <SEND_EMAIL_TOKEN>, or <COMMAND_CENTRE_SEND_TOKEN>
// (the Command Centre's own, so either can be rotated alone). Without a token — or
// before the SMTP env vars exist — every call fails loudly with a clear
// reason (not_configured).
const crypto = require('crypto');
const { TEMPLATES, looksLikeEmail, templateSpec, prepare, sendParticipantEmail } = require('./_lib/participant-email');

const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD || '';
const SEND_EMAIL_TOKEN = process.env.SEND_EMAIL_TOKEN || '';
const COMMAND_CENTRE_SEND_TOKEN = process.env.COMMAND_CENTRE_SEND_TOKEN || '';

// Best-effort, per-instance rate limiting: nobody legitimately sends more
// than a handful of these an hour.
const RATE_LIMIT_MAX = Number(process.env.SEND_RATE_LIMIT_MAX || 10);
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const hits = [];

function isRateLimited() {
  const now = Date.now();
  while (hits.length && now - hits[0] > RATE_LIMIT_WINDOW_MS) hits.shift();
  hits.push(now);
  return hits.length > RATE_LIMIT_MAX;
}

function tokenMatches(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7).trim());
  return [SEND_EMAIL_TOKEN, COMMAND_CENTRE_SEND_TOKEN].some((token) => {
    if (!token) return false;
    const want = Buffer.from(token);
    return given.length === want.length && crypto.timingSafeEqual(given, want);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!SMTP_USER || !SMTP_APP_PASSWORD || !(SEND_EMAIL_TOKEN || COMMAND_CENTRE_SEND_TOKEN)) {
    console.error('SEND ENDPOINT NOT CONFIGURED — missing SMTP_USER / SMTP_APP_PASSWORD / SEND_EMAIL_TOKEN');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  if (!tokenMatches(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const f = req.body || {};
  const dryRun = f.dryRun === true;
  if (!dryRun && isRateLimited()) {
    return res.status(429).json({ ok: false, error: 'Rate limited' });
  }

  if (!templateSpec(f.template)) {
    return res.status(400).json({ ok: false, error: `Unknown template — use one of: ${Object.keys(TEMPLATES).join(', ')}` });
  }
  if (!(dryRun && !f.to) && !looksLikeEmail(f.to)) {
    return res.status(400).json({ ok: false, error: 'Invalid recipient address' });
  }

  try {
    if (dryRun) {
      const p = prepare({ template: f.template, merge: f.merge, preview: true });
      return res.status(200).json({
        ok: true,
        dryRun: true,
        template: f.template,
        to: f.to || null,
        subject: p.subject,
        html: p.html,
        attachments: p.attachments,
        required: p.needed,
        missing: p.missing,
      });
    }
    const sent = await sendParticipantEmail({ template: f.template, to: f.to, merge: f.merge });
    return res.status(200).json({ ok: true, template: f.template, to: f.to, subject: sent.subject, attachments: sent.attachments });
  } catch (err) {
    if (err.missing) return res.status(400).json({ ok: false, error: 'Missing merge values', missing: err.missing });
    if (err.tokens) return res.status(500).json({ ok: false, error: 'Template has unresolved tokens', tokens: err.tokens });
    console.error('send-participant-email failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Send failed', detail: err.message });
  }
};
