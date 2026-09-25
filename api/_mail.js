// Low-level SMTP-over-TLS sender, shared between send-participant-email.js
// and weekly-invoice-draft.js. Implemented directly rather than via a
// dependency because this repo has no package.json (see
// send-participant-email.js for the fuller rationale).
const fs = require('fs');
const tls = require('tls');
const crypto = require('crypto');

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_APP_PASSWORD = process.env.SMTP_APP_PASSWORD || '';

function b64lines(buf) {
  return buf.toString('base64').replace(/(.{76})/g, '$1\r\n');
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
      [220, `EHLO thehealthwellbeinghub.com\r\n`],
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

// attachments: [{ path, filename }] — PDFs read from the deployment bundle.
// Every MIME part is base64-encoded, so no body line can begin with a dot
// and SMTP dot-stuffing never applies.
function buildMime({ to, subject, text, html, attachments = [] }) {
  const mixed = 'mix_' + crypto.randomBytes(12).toString('hex');
  const alt = 'alt_' + crypto.randomBytes(12).toString('hex');
  const lines = [
    `From: The Health & Well-being Hub <${SMTP_USER}>`,
    `To: <${to}>`,
    `Subject: ${subject.replace(/[\r\n]+/g, ' ')}`,
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
    b64lines(Buffer.from(html || `<pre>${text}</pre>`, 'utf-8')),
    `--${alt}--`,
  ];
  for (const { path: filePath, filename } of attachments) {
    lines.push(
      `--${mixed}`,
      `Content-Type: application/pdf; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${filename}"`,
      '',
      b64lines(fs.readFileSync(filePath))
    );
  }
  lines.push(`--${mixed}--`, '');
  return lines.join('\r\n');
}

function isConfigured() {
  return Boolean(SMTP_USER && SMTP_APP_PASSWORD);
}

async function sendEmail({ to, subject, text, html, attachments }) {
  return smtpSend({ to, message: buildMime({ to, subject, text, html, attachments }) });
}

module.exports = { isConfigured, sendEmail, buildMime, smtpSend };
