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
  return res.status(200).json({
    account_id_len: SHIFTCARE_ACCOUNT_ID.length,
    api_key_len: SHIFTCARE_API_KEY.length,
    api_key_first4: SHIFTCARE_API_KEY.slice(0, 4),
    api_key_last4: SHIFTCARE_API_KEY.slice(-4),
    shiftcare_status: scRes.status,
    shiftcare_body: text.slice(0, 500),
  });
};
