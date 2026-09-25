// Vercel serverless function — sends any of the 13 lifecycle emails in
// email-templates/ from the H&W mailbox. HubSpot is no longer used, so this
// is the one send path for every template. Two carry fixed PDF attachments:
// the Consent email (04, two fillable forms and the service agreement) and
// the Welcome pack (12, four easy-read guides).
//
// One recipient per call, and only the templates listed below. Attachments
// are fixed per template and never chosen by the caller.
//
// Merge fields live in the templates as {{Key}} (required) or
// {{Key|fallback}} (optional — the fallback renders if no value is given).
// Required fields are read from the template itself, so the template stays
// the single source of truth for what an email needs.
//
// Auth: Authorization: Bearer <SEND_EMAIL_TOKEN>. Without the token — or
// before the SMTP env vars exist — every call fails loudly with a clear
// reason (not_configured).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { sendEmail } = require('./_mail');

const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD || '';
const SEND_EMAIL_TOKEN = process.env.SEND_EMAIL_TOKEN || '';

const DOCS_DIR = path.join(process.cwd(), 'participant-documents');
const TEMPLATES_DIR = path.join(process.cwd(), 'email-templates');

// A mailto because these are one-to-one operational sends from the mailbox —
// there is no subscription-preference page behind them.
const UNSUBSCRIBE_URL = 'mailto:thehealthwellbeinghub@gmail.com?subject=Unsubscribe';

// Subject defaults to the template's own <title>. Attachments are enforced
// here rather than trusted to callers — the Consent email always carries
// all three documents, never a subset (docs/workflow-03-new-participant.md). `required`
// adds keys whose template fallback would read wrongly in that email, e.g.
// "Welcome to the family, the participant".
const TEMPLATES = {
  'referrer-introduction': { file: '01-referrer-introduction.html' },
  'referral-received': { file: '02-referral-received.html' },
  'enquiry-acknowledgement': { file: '03-new-enquiry-acknowledgement.html' },
  consent: {
    file: '04-participant-welcome-onboarding.html',
    // Names the participant because one referrer can receive this for
    // several participants, and identical subjects are indistinguishable.
    subject: "{{Participant First Name}}'s forms and service agreement",
    attachments: [
      'The Health & Well-being Hub - Referral Form (Fillable).pdf',
      'NDIS Consent for Your Information (Fillable).pdf',
      'The Health & Well-being Hub - Service Agreement (Fillable).pdf',
    ],
    required: ['Participant First Name', 'Staff Member', 'Role', 'Service'],
  },
  'appointment-confirmation': { file: '05-appointment-confirmation.html' },
  'support-worker-introduction': { file: '06-support-worker-introduction.html' },
  'feedback-acknowledgement': { file: '07-feedback-acknowledgement.html' },
  'complaint-acknowledgement': { file: '08-complaint-acknowledgement.html' },
  'service-exit': { file: '09-service-cancellation-exit.html' },
  'referral-considering': { file: '10-referral-outcome-considering.html' },
  'referral-declined': { file: '11-referral-outcome-declined.html' },
  welcome: {
    file: '12-welcome-pack.html',
    attachments: [
      'Privacy & Confidentiality (Easy Read Guide).pdf',
      'Feedback & Complaints (Easy Read Guide).pdf',
      'Your Rights & Responsibilities (Easy Read Guide).pdf',
      'Incident Management (Easy Read Guide).pdf',
    ],
    required: ['Participant First Name', 'Staff Member', 'Role'],
  },
  'referral-going-ahead': { file: '13-referral-outcome-going-ahead.html' },
};

const TOKEN_RE = /\{\{\s*([^{}|]+?)\s*(?:\|([^{}]*))?\}\}/g;
const SERVER_TOKENS = { 'Unsubscribe Link': UNSUBSCRIBE_URL };

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
  const want = Buffer.from(SEND_EMAIL_TOKEN);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function looksLikeEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && !/[\r\n]/.test(s);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&rsquo;|&lsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&middot;/g, '·')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// Keys a template needs from the caller: every token without a fallback.
function requiredKeys(...sources) {
  const keys = new Set();
  for (const src of sources) {
    for (const [, key, fallback] of src.matchAll(TOKEN_RE)) {
      if (fallback === undefined && !(key in SERVER_TOKENS)) keys.add(key);
    }
  }
  return [...keys];
}

// `values` holds caller input already in the target form (HTML-escaped for
// the body, raw for the subject). Fallbacks are template HTML, so the
// subject decodes them.
function fill(src, values, { html }) {
  return src.replace(TOKEN_RE, (m, key, fallback) => {
    if (key in SERVER_TOKENS) return SERVER_TOKENS[key];
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
    if (fallback !== undefined) return html ? fallback : decodeEntities(fallback);
    return m;
  });
}

function htmlToText(html) {
  const body = html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<div style="display:none[\s\S]*?<\/div>/i, '');
  return decodeEntities(
    body
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, label) =>
        href.startsWith('mailto:') || href === '#' ? label : `${label} (${href})`)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h1|h2|h3|tr|li|table)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  if (!SMTP_USER || !SMTP_APP_PASSWORD || !SEND_EMAIL_TOKEN) {
    console.error('SEND ENDPOINT NOT CONFIGURED — missing SMTP_USER / SMTP_APP_PASSWORD / SEND_EMAIL_TOKEN');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  if (!tokenMatches(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (isRateLimited()) {
    return res.status(429).json({ ok: false, error: 'Rate limited' });
  }

  const f = req.body || {};
  const spec = Object.prototype.hasOwnProperty.call(TEMPLATES, f.template) ? TEMPLATES[f.template] : null;
  if (!spec) {
    return res.status(400).json({ ok: false, error: `Unknown template — use one of: ${Object.keys(TEMPLATES).join(', ')}` });
  }
  if (!looksLikeEmail(f.to)) {
    return res.status(400).json({ ok: false, error: 'Invalid recipient address' });
  }

  try {
    const html = fs.readFileSync(path.join(TEMPLATES_DIR, spec.file), 'utf-8');
    const title = html.match(/<title>([\s\S]*?)<\/title>/i);
    const subjectSrc = spec.subject || (title ? title[1].trim() : '');
    const attachments = spec.attachments || [];

    const merge = f.merge && typeof f.merge === 'object' ? f.merge : {};
    const raw = {};
    for (const [key, v] of Object.entries(merge)) {
      if (typeof v === 'string' && v.trim()) raw[key] = v.trim();
    }
    const needed = new Set([...requiredKeys(html, subjectSrc), ...(spec.required || [])]);
    const missing = [...needed].filter((k) => !(k in raw));
    if (missing.length) {
      return res.status(400).json({ ok: false, error: 'Missing merge values', missing });
    }

    const escaped = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, escapeHtml(v)]));
    const filled = fill(html, escaped, { html: true });
    // Newlines stripped so a merge value can never smuggle in a MIME header.
    const subject = decodeEntities(fill(subjectSrc, raw, { html: false })).replace(/[\r\n]+/g, ' ');

    // Anything still in braces means the template changed in a way this
    // endpoint doesn't understand — refuse rather than send braces.
    const leftover = [...filled.matchAll(TOKEN_RE), ...subject.matchAll(TOKEN_RE)].map((m) => m[0]);
    if (leftover.length) {
      console.error('unresolved template tokens:', leftover);
      return res.status(500).json({ ok: false, error: 'Template has unresolved tokens', tokens: leftover });
    }

    await sendEmail({
      to: f.to,
      subject,
      html: filled,
      text: htmlToText(filled),
      attachments: attachments.map((name) => ({ path: path.join(DOCS_DIR, name), filename: name })),
    });
    return res.status(200).json({ ok: true, template: f.template, to: f.to, subject, attachments });
  } catch (err) {
    console.error('send-participant-email failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Send failed', detail: err.message });
  }
};
