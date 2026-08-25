// Vercel serverless function — sends the two participant lifecycle emails
// that carry PDF attachments (workflow 03): the Consent email (template 04,
// two fillable forms) and the Welcome email (template 12, four easy-read
// guides). Built 25 Aug 2026 because no session-side tool can attach large
// files to outbound mail — the attachment bytes have to be read and encoded
// server-side, where the PDFs already live in the deployment bundle.
//
// Deliberately narrow: it can ONLY send these two templates, with their
// fixed attachment sets, to a single recipient per call. It is not a general
// mailer, and adding a template here should be a considered decision, not a
// convenience.
//
// Auth: Authorization: Bearer <SEND_EMAIL_TOKEN>. Without the token — or
// before the three env vars exist — every call fails loudly with a clear
// reason, the same not_configured pattern as the acknowledgement forms.
//
// SMTP is implemented directly over TLS (smtp.gmail.com:465, AUTH PLAIN with
// a Gmail app password) rather than via a dependency, because this repo has
// no package.json and adding one changes how Vercel treats the whole
// project. Every MIME part is base64-encoded, so no body line can begin
// with a dot and SMTP dot-stuffing never applies.
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const crypto = require('crypto');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD || '';
const SEND_EMAIL_TOKEN = process.env.SEND_EMAIL_TOKEN || '';

const FROM_NAME = 'The Health & Well-being Hub';
const DOCS_DIR = path.join(process.cwd(), 'participant-documents');
const TEMPLATES_DIR = path.join(process.cwd(), 'email-templates');

// The only two emails this endpoint will ever send. Attachments are fixed
// per template — the Consent email always carries both forms, never one
// (docs/workflow-03-new-participant.md), and that invariant is enforced
// here rather than trusted to every caller.
const TEMPLATES = {
  consent: {
    file: '04-participant-welcome-onboarding.html',
    // {{Participant First Name}} is filled at send time. Needed because the
    // same referrer can receive this email for several participants at once,
    // and identical subjects make those indistinguishable in their inbox.
    subject: "{{Participant First Name}}'s consent and referral forms",
    attachments: [
      'The Health & Well-being Hub - Referral Form (Fillable).pdf',
      'NDIS Consent for Your Information (Fillable).pdf',
    ],
    // Tokens the caller must supply. Constants below are filled server-side.
    required: ['Participant First Name', 'Staff Member', 'Role', 'Service', 'Date', 'Schedule', 'Location'],
  },
  welcome: {
    file: '12-welcome-pack.html',
    subject: 'Your welcome pack',
    attachments: [
      'Privacy & Confidentiality (Easy Read Guide).pdf',
      'Feedback & Complaints (Easy Read Guide).pdf',
      'Your Rights & Responsibilities (Easy Read Guide).pdf',
      'Incident Management (Easy Read Guide).pdf',
    ],
    required: ['Participant First Name', 'Staff Member', 'Role'],
  },
};

// H&W's own contact details render in both templates and are not the
// caller's to vary. The unsubscribe link is a mailto because these are
// one-to-one operational sends from the mailbox, not HubSpot marketing
// sends — there is no subscription-preference page behind them.
const CONSTANT_TOKENS = {
  'Phone Number': '0433 604 507',
  'Email Address': 'thehealthwellbeinghub@gmail.com',
  'unsubscribe_url': 'mailto:thehealthwellbeinghub@gmail.com?subject=Unsubscribe',
};

// Same best-effort, per-instance rate limiting as hubspot-submit.js, sized
// tighter: nobody legitimately sends more than a handful of these an hour.
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

function fillTemplate(html, values) {
  const missing = [];
  const filled = html.replace(/\{\{([^}]*)\}\}/g, (m, key) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
    missing.push(key);
    return m;
  });
  return { filled, missing };
}

function b64lines(buf) {
  return buf.toString('base64').replace(/(.{76})/g, '$1\r\n');
}

function buildMime({ to, subject, html, text, attachments }) {
  const mixed = 'mix_' + crypto.randomBytes(12).toString('hex');
  const alt = 'alt_' + crypto.randomBytes(12).toString('hex');
  const lines = [
    `From: ${FROM_NAME} <${SMTP_USER}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(16).toString('hex')}@thehealthwellbeinghub.com>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64lines(Buffer.from(text, 'utf-8')),
    `--${alt}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64lines(Buffer.from(html, 'utf-8')),
    `--${alt}--`,
  ];
  for (const name of attachments) {
    const buf = fs.readFileSync(path.join(DOCS_DIR, name));
    lines.push(
      `--${mixed}`,
      `Content-Type: application/pdf; name="${name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${name}"`,
      '',
      b64lines(buf)
    );
  }
  lines.push(`--${mixed}--`, '');
  return lines.join('\r\n');
}

// Minimal SMTP-over-TLS conversation. Reads until the final line of each
// response (three digits followed by a space) and fails on any code other
// than the one expected — no retries here, the caller decides what a
// failure means.
function smtpSend({ to, message }) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: SMTP_HOST, port: SMTP_PORT, servername: SMTP_HOST });
    let buffer = '';
    let step = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err);
    };

    socket.setTimeout(30000, () => fail(new Error('SMTP timeout')));
    socket.on('error', fail);

    // AUTH PLAIN is NUL-separated: \0 authzid \0 authcid \0 password.
    const authPlain = Buffer.from(`\u0000${SMTP_USER}\u0000${SMTP_APP_PASSWORD}`).toString('base64');
    // [expected reply code, what to send next]
    const script = [
      [220, `EHLO send-participant-email\r\n`],
      [250, `AUTH PLAIN ${authPlain}\r\n`],
      [235, `MAIL FROM:<${SMTP_USER}>\r\n`],
      [250, `RCPT TO:<${to}>\r\n`],
      [250, `DATA\r\n`],
      [354, message + '\r\n.\r\n'],
      [250, `QUIT\r\n`],
      [221, null],
    ];

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf-8');
      // Consume complete responses; the last line of one is "NNN text".
      while (true) {
        const match = buffer.match(/^(\d{3})[ ](.*)\r\n/m);
        if (!match) return;
        const upTo = buffer.indexOf(match[0]) + match[0].length;
        buffer = buffer.slice(upTo);
        const code = Number(match[1]);
        const [expected, next] = script[step];
        if (code !== expected) {
          return fail(new Error(`SMTP step ${step}: expected ${expected}, got ${code} ${match[2]}`));
        }
        step += 1;
        if (next === null) {
          settled = true;
          socket.end();
          return resolve(true);
        }
        socket.write(next);
      }
    });
  });
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
  const spec = TEMPLATES[f.template];
  if (!spec) {
    return res.status(400).json({ ok: false, error: `Unknown template — use one of: ${Object.keys(TEMPLATES).join(', ')}` });
  }
  if (!looksLikeEmail(f.to)) {
    return res.status(400).json({ ok: false, error: 'Invalid recipient address' });
  }

  const merge = f.merge && typeof f.merge === 'object' ? f.merge : {};
  const values = { ...CONSTANT_TOKENS };
  const missingInput = [];
  for (const key of spec.required) {
    const v = merge[key];
    if (typeof v !== 'string' || !v.trim()) missingInput.push(key);
    else values[key] = escapeHtml(v.trim());
  }
  if (missingInput.length) {
    return res.status(400).json({ ok: false, error: 'Missing merge values', missing: missingInput });
  }

  try {
    const html = fs.readFileSync(path.join(TEMPLATES_DIR, spec.file), 'utf-8');
    const { filled, missing } = fillTemplate(html, values);
    // A token the map doesn't know about means the template changed and this
    // endpoint didn't — refuse rather than send braces to a participant.
    if (missing.length) {
      console.error('unresolved template tokens:', missing);
      return res.status(500).json({ ok: false, error: 'Template has unresolved tokens', tokens: missing });
    }

    const text = [
      `Hi ${merge['Participant First Name']},`,
      '',
      spec.file.startsWith('04')
        ? 'Before we can start supporting you, we need two quick forms — both are attached to this email. Your primary contact is ' +
          `${merge['Staff Member']} (${merge['Role']}).`
        : 'Welcome to The Health & Well-being Hub — your welcome pack of four short guides is attached. Your primary contact is ' +
          `${merge['Staff Member']} (${merge['Role']}).`,
      '',
      'Contact: 0433 604 507 · thehealthwellbeinghub@gmail.com',
      '',
      'Kind regards,',
      'The Health & Well-being Hub',
    ].join('\n');

    // Subject tokens fill from the RAW merge values, not the HTML-escaped
    // ones — "&amp;" must never reach an inbox subject line. Newlines are
    // stripped so a merge value can never smuggle in an extra MIME header.
    const subject = spec.subject
      .replace(/\{\{([^}]*)\}\}/g, (m, key) =>
        typeof merge[key] === 'string' ? merge[key].trim() : m)
      .replace(/[\r\n]+/g, ' ');

    const message = buildMime({
      to: f.to,
      subject,
      html: filled,
      text,
      attachments: spec.attachments,
    });

    await smtpSend({ to: f.to, message });
    return res.status(200).json({ ok: true, template: f.template, to: f.to, attachments: spec.attachments });
  } catch (err) {
    console.error('send-participant-email failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Send failed', detail: err.message });
  }
};
