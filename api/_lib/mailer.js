// Shared raw-SMTP-over-TLS sender. Same mechanism as api/send-participant-email.js
// (smtp.gmail.com:465, AUTH PLAIN with a Gmail app password), factored out so
// api/lead-submit.js can send the referral/enquiry acknowledgement itself
// without an extra HTTP hop to that endpoint (which is gated by a bearer
// token meant for a human/Claude-triggered single send, not a public-facing
// intake handler). Deliberately implemented directly over TLS rather than a
// dependency — this repo has no package.json and adding one changes how
// Vercel treats the whole project. Not merged into send-participant-email.js
// itself to avoid touching an already-proven-live sender.
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const crypto = require('crypto');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD || '';

const FROM_NAME = 'The Health & Well-being Hub';

function isConfigured() {
  return Boolean(SMTP_USER && SMTP_APP_PASSWORD);
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

function buildMime({ to, subject, html, text }) {
  const alt = 'alt_' + crypto.randomBytes(12).toString('hex');
  const lines = [
    `From: ${FROM_NAME} <${SMTP_USER}>`,
    `To: <${to}>`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(16).toString('hex')}@thehealthwellbeinghub.com>`,
    'MIME-Version: 1.0',
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
    '',
  ];
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

    const authPlain = Buffer.from(`\u0000${SMTP_USER}\u0000${SMTP_APP_PASSWORD}`).toString('base64');
    const script = [
      [220, `EHLO lead-submit\r\n`],
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

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Fills a template file from email-templates/, sends it, and throws if any
// token is left unresolved (never send braces to a real inbox) rather than
// send a broken email.
async function sendTemplateEmail({ templateFile, to, subjectTemplate, values, text }) {
  if (!isConfigured()) {
    throw new Error('not_configured: SMTP_USER / SMTP_APP_PASSWORD missing');
  }
  const templatesDir = path.join(process.cwd(), 'email-templates');
  const html = fs.readFileSync(path.join(templatesDir, templateFile), 'utf-8');
  const { filled, missing } = fillTemplate(html, values);
  if (missing.length) {
    throw new Error(`Template ${templateFile} has unresolved tokens: ${missing.join(', ')}`);
  }
  const subject = subjectTemplate
    .replace(/\{\{([^}]*)\}\}/g, (m, key) =>
      typeof values[key] === 'string' ? values[key].trim() : m)
    .replace(/[\r\n]+/g, ' ');

  const message = buildMime({ to, subject, html: filled, text });
  await smtpSend({ to, message });
  return { subject };
}

module.exports = { isConfigured, sendTemplateEmail, escapeHtml, SMTP_USER };
