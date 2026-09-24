// TEMPORARY diagnostic — isolates whether the ShiftCare account_id/api_key
// pair authenticates at all, independent of the upload endpoint's multipart
// construction. Deleted once the upload endpoint is confirmed working.
const SHIFTCARE_ACCOUNT_ID = process.env.SHIFTCARE_ACCOUNT_ID || '291708';
const SHIFTCARE_API_KEY = process.env.SHIFTCARE_API_KEY || '';
const SHIFTCARE_UPLOAD_TOKEN = process.env.SHIFTCARE_UPLOAD_TOKEN || '';

module.exports = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${SHIFTCARE_UPLOAD_TOKEN}`) {
    return res.status(401).json({ ok: false });
  }
  const basic = Buffer.from(`${SHIFTCARE_ACCOUNT_ID}:${SHIFTCARE_API_KEY}`).toString('base64');
  const scRes = await fetch('https://api.shiftcare.com/api/v3/clients/1170019', {
    headers: { Authorization: `Basic ${basic}` },
  });
  const text = await scRes.text();

  // Now the same POST the real endpoint attempts, with a tiny sample file,
  // so we can see ShiftCare's exact response to the multipart request.
  const boundary = '----debug' + require('crypto').randomBytes(8).toString('hex');
  const fileContent = Buffer.from('diagnostic test file');
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="diagnostic.txt"\r\nContent-Type: text/plain\r\n\r\n`,
      'utf-8'
    ),
    fileContent,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
  ]);
  const postRes = await fetch('https://api.shiftcare.com/api/v3/clients/1170019/documents', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });
  const postText = await postRes.text();

  return res.status(200).json({
    account_id_len: SHIFTCARE_ACCOUNT_ID.length,
    api_key_len: SHIFTCARE_API_KEY.length,
    shiftcare_get_status: scRes.status,
    shiftcare_get_body: text.slice(0, 200),
    shiftcare_post_status: postRes.status,
    shiftcare_post_body: postText.slice(0, 500),
    post_url_tried: 'https://api.shiftcare.com/api/v3/clients/1170019/documents',
  });
};
