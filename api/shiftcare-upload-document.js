// Vercel serverless function — uploads a file to a client's ShiftCare
// profile. Built because the ShiftCare MCP connector this project talks to
// exposes list/update/archive/restore/download for client documents but no
// create — checked directly against ShiftCare's own public API spec
// (https://app.shiftcare.com/api/v3/swagger_doc.json) rather than assuming
// the connector's tool surface is the whole API: it isn't. The real
// endpoint, `POST /v3/clients/{client_id}/documents`, exists and is what
// this relays to.
//
// Auth to ShiftCare is HTTP Basic — `AccountID:APIKey` — a self-serve key
// generated in ShiftCare under Integrations > API, not the same credential
// the MCP connector uses.
//
// Files arrive here as base64 in a JSON body rather than a real multipart
// upload, because the caller is Claude relaying a file it was handed in
// conversation, not a browser form. This function re-encodes it as the
// multipart/form-data ShiftCare's endpoint actually requires.
const crypto = require('crypto');

const SHIFTCARE_ACCOUNT_ID = process.env.SHIFTCARE_ACCOUNT_ID || '291708';
const SHIFTCARE_API_KEY = process.env.SHIFTCARE_API_KEY || '';
const SHIFTCARE_UPLOAD_TOKEN = process.env.SHIFTCARE_UPLOAD_TOKEN || '';
// api.shiftcare.com is the real API host, confirmed from ShiftCare's own
// public spec (host: "api.shiftcare.com", basePath: "/api/") — NOT
// app.shiftcare.com, which is the login-gated web app. Using the wrong host
// was the first bug found here: it returned a plausible-looking JSON
// {"error":"Not Found"} for every client_id, real or fake, which passed an
// earlier safety test (a deliberately nonexistent id) without proving
// anything — the endpoint was 404ing regardless of which client it asked
// for. Caught by re-testing against a client just confirmed to exist.
const SHIFTCARE_BASE = 'https://api.shiftcare.com/api';

// Exactly ShiftCare's own accepted list (their API spec, verified 24 Sep
// 2026) — images are explicitly NOT accepted, so a photo of a document has
// to be converted to PDF first, not sent as-is.
const ALLOWED_EXTENSIONS = {
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  pdf: 'application/pdf',
  txt: 'text/plain',
  zip: 'application/zip',
  msg: 'application/vnd.ms-outlook',
  email: 'message/rfc822',
  eml: 'message/rfc822',
};

// Base64 inflates by ~4/3, and this function's JSON body has to fit inside
// Vercel's request size limit for a standard Serverless Function (~4.5MB).
// Capped well under that rather than against it exactly, so the error a
// worker sees is "too large, ask Claude" rather than an opaque platform
// rejection.
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3MB

function tokenMatches(header) {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
  const given = Buffer.from(header.slice(7).trim());
  const want = Buffer.from(SHIFTCARE_UPLOAD_TOKEN);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function extensionOf(fileName) {
  const i = fileName.lastIndexOf('.');
  return i === -1 ? '' : fileName.slice(i + 1).toLowerCase();
}

// Hand-built multipart/form-data — this repo has no package.json, so no
// form-data dependency, same reasoning as the hand-rolled MIME builder in
// send-participant-email.js.
function buildMultipart(fields, fileField) {
  const boundary = '----shiftcareUpload' + crypto.randomBytes(16).toString('hex');
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') continue;
    parts.push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
        `${value}\r\n`
    );
  }
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileField.fileName}"\r\n` +
    `Content-Type: ${fileField.contentType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(parts.join(''), 'utf-8'),
    Buffer.from(head, 'utf-8'),
    fileField.buffer,
    Buffer.from(tail, 'utf-8'),
  ]);
  return { boundary, body };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!SHIFTCARE_UPLOAD_TOKEN || !tokenMatches(req.headers.authorization)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (!SHIFTCARE_API_KEY) {
    console.error('SHIFTCARE ENDPOINT NOT CONFIGURED — missing SHIFTCARE_API_KEY');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  const f = req.body || {};
  const { client_id, file_name, file_base64 } = f;

  if (!client_id || !Number.isInteger(Number(client_id))) {
    return res.status(400).json({ ok: false, error: 'client_id (integer) is required' });
  }
  if (!file_name || typeof file_name !== 'string') {
    return res.status(400).json({ ok: false, error: 'file_name is required' });
  }
  if (!file_base64 || typeof file_base64 !== 'string') {
    return res.status(400).json({ ok: false, error: 'file_base64 is required' });
  }

  const ext = extensionOf(file_name);
  const contentType = ALLOWED_EXTENSIONS[ext];
  if (!contentType) {
    return res.status(400).json({
      ok: false,
      error: `Unsupported file type ".${ext || '(none)'}"`,
      allowed: Object.keys(ALLOWED_EXTENSIONS),
    });
  }

  let buffer;
  try {
    buffer = Buffer.from(file_base64, 'base64');
  } catch {
    return res.status(400).json({ ok: false, error: 'file_base64 is not valid base64' });
  }
  if (!buffer.length) {
    return res.status(400).json({ ok: false, error: 'Decoded file is empty' });
  }
  if (buffer.length > MAX_FILE_BYTES) {
    return res.status(413).json({
      ok: false,
      error: `File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB) — this endpoint caps uploads at ${MAX_FILE_BYTES / 1024 / 1024}MB`,
    });
  }

  // Optional filing details — same fields the update tool already exposes,
  // so a caller can file the document correctly on the way in rather than
  // upload-then-refile.
  const fields = {
    document_type_id: f.document_type_id,
    staff_visible: typeof f.staff_visible === 'boolean' ? String(f.staff_visible) : undefined,
    expires_at: f.expires_at,
    no_expiration: typeof f.no_expiration === 'boolean' ? String(f.no_expiration) : undefined,
    time_zone: 'Australia/Brisbane',
  };

  const { boundary, body } = buildMultipart(fields, { fileName: file_name, contentType, buffer });
  const basic = Buffer.from(`${SHIFTCARE_ACCOUNT_ID}:${SHIFTCARE_API_KEY}`).toString('base64');

  try {
    const scRes = await fetch(
      `${SHIFTCARE_BASE}/v3/clients/${Number(client_id)}/documents`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      }
    );
    const text = await scRes.text();
    const data = text ? JSON.parse(text) : null;
    if (!scRes.ok) {
      return res.status(scRes.status).json({ ok: false, error: 'ShiftCare rejected the upload', detail: data });
    }
    return res.status(201).json({ ok: true, document: data });
  } catch (err) {
    console.error('shiftcare-upload-document failed:', err.message);
    return res.status(502).json({ ok: false, error: 'Upload failed', detail: err.message });
  }
};
