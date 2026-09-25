// Vercel serverless function — emails the current set of H&W documents
// (every PDF in participant-documents/ and staff-documents/) to an H&W
// inbox, so staff can review or forward the latest versions. It can only
// send to the addresses below: the pack includes contractor pay rates and
// blank agreements, which should never go to an outside address from here.
//
// Auth: Authorization: Bearer <SEND_DOCUMENTS_TOKEN>. POST body: { to }.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isConfigured, sendEmail } = require('./_mail');

const SEND_DOCUMENTS_TOKEN = process.env.SEND_DOCUMENTS_TOKEN || '';
const ALLOWED_RECIPIENTS = ['officethehealthwellbeinghub@gmail.com', 'thehealthwellbeinghub@gmail.com'];

// Literal paths, not built from a variable: Vercel's bundler traces
// path.join(process.cwd(), <variable>) as "anything under the project" and
// the build fails.
const FOLDERS = [
  { dir: path.join(process.cwd(), 'participant-documents'), label: 'Sent to participants' },
  { dir: path.join(process.cwd(), 'staff-documents'), label: 'For staff and contractors' },
];

function tokenMatches(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7).trim());
  const want = Buffer.from(SEND_DOCUMENTS_TOKEN);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!isConfigured() || !SEND_DOCUMENTS_TOKEN) {
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  if (!tokenMatches(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const to = String((req.body || {}).to || '').trim().toLowerCase();
  if (!ALLOWED_RECIPIENTS.includes(to)) {
    return res.status(400).json({ ok: false, error: `Recipient must be one of: ${ALLOWED_RECIPIENTS.join(', ')}` });
  }

  const groups = FOLDERS.map(({ dir, label }) => {
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort() : [];
    return { label, files: files.map((f) => ({ path: path.join(dir, f), filename: f })) };
  });
  const attachments = groups.flatMap((g) => g.files);
  if (!attachments.length) return res.status(500).json({ ok: false, error: 'No documents found' });

  const text = [
    'The current H&W document pack is attached — the latest version of every document.',
    '',
    ...groups.flatMap((g) => g.files.length ? [`${g.label}:`, ...g.files.map((f) => `  - ${f.filename}`), ''] : []),
    'The Health & Well-being Hub',
  ].join('\n');
  const html = `<div style="font:15px/1.6 Arial,sans-serif;color:#273963">
<p>The current H&amp;W document pack is attached — the latest version of every document.</p>
${groups.filter((g) => g.files.length).map((g) => `<p style="margin-bottom:4px"><b>${escapeHtml(g.label)}</b></p><ul style="margin-top:0">${g.files.map((f) => `<li>${escapeHtml(f.filename)}</li>`).join('')}</ul>`).join('')}
<p>The Health &amp; Well-being Hub</p></div>`;

  try {
    await sendEmail({ to, subject: `H&W document pack — ${attachments.length} documents`, text, html, attachments });
    return res.status(200).json({ ok: true, to, documents: attachments.map((a) => a.filename) });
  } catch (err) {
    console.error('send-document-pack failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Send failed', detail: err.message });
  }
};
