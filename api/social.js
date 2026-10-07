// Team social media library at /socialmedia, behind one shared team login.
//
// The username and password live only in Vercel env (SOCIAL_USERNAME,
// SOCIAL_PASSWORD); SOCIAL_SESSION_SECRET signs the login cookie. Nothing here
// is participant data: the videos, covers and captions are marketing content.
// Files sit in the private Supabase bucket `social-media` and are only ever
// handed out as short-lived signed links to a logged-in browser. Review and
// posting status is the `social_videos` table, written only through this route.
//
//   GET  /socialmedia                      login page, or the library when logged in
//   POST /api/social?r=login               form: username, password
//   POST /api/social?r=logout
//   GET  /api/social?r=status              statuses for every video
//   POST /api/social?r=update              JSON: { slug, field, value }
//   GET  /api/social?r=file&kind=ig|tt|cover&slug=…[&dl=1]   302 to a signed link
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { isConfigured, rest, storageSignedUrl } = require('./_lib/supabase');

const USERNAME = process.env.SOCIAL_USERNAME || '';
const PASSWORD = process.env.SOCIAL_PASSWORD || '';
const SECRET = process.env.SOCIAL_SESSION_SECRET || '';
const COOKIE = 'hw_social';
const MAX_AGE = 30 * 24 * 3600; // stay logged in for 30 days on that device
const BUCKET = 'social-media';
const STATUSES = ['Not posted', 'Scheduled', 'Posted'];

const dir = path.join(__dirname, '_social');
const LIBRARY = JSON.parse(fs.readFileSync(path.join(dir, 'library.json'), 'utf8'));
const SLUGS = new Set(LIBRARY.map((v) => v.slug));
const page = (name) => fs.readFileSync(path.join(dir, name), 'utf8');

const sign = (exp) => crypto.createHmac('sha256', SECRET).update(`social.${exp}`).digest('base64url');
const same = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
function loggedIn(req) {
  const raw = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw || !SECRET) return false;
  const [exp, sig] = raw.slice(COOKIE.length + 1).split('.');
  return Number(exp) > Date.now() / 1000 && Boolean(sig) && same(sig, sign(exp));
}
function cookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function html(res, status, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.status(status).send(body);
}
const redirect = (res, to) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Location', to); return res.status(303).end(); };
const objectPath = (kind, slug) => `${kind}/${slug}.${kind === 'cover' ? 'jpg' : 'mp4'}`;

module.exports = async (req, res) => {
  const r = req.query.r || 'page';
  if (!USERNAME || !PASSWORD || !SECRET) return html(res, 503, 'The social media page is not set up yet.');

  if (r === 'login' && req.method === 'POST') {
    const f = req.body || {};
    const ok = same(String(f.username || '').trim().toLowerCase(), USERNAME.toLowerCase()) && same(String(f.password || ''), PASSWORD);
    if (!ok) { await new Promise((ok2) => setTimeout(ok2, 700)); return redirect(res, '/socialmedia?e=1'); }
    const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
    res.setHeader('Set-Cookie', cookie(`${exp}.${sign(exp)}`, MAX_AGE));
    return redirect(res, '/socialmedia');
  }
  if (r === 'logout' && req.method === 'POST') {
    res.setHeader('Set-Cookie', cookie('', 0));
    return redirect(res, '/socialmedia');
  }

  if (!loggedIn(req)) {
    if (r !== 'page') return res.status(401).json({ ok: false, error: 'Please log in again.' });
    return html(res, 200, page('login.html').replace('{{ERROR}}', req.query.e ? '<p class="err" role="alert">That username or password didn’t match. Try again.</p>' : ''));
  }

  if (r === 'page') {
    return html(res, 200, page('library.html').replace('/*{{LIBRARY}}*/[]', JSON.stringify(LIBRARY).replace(/</g, '\\u003c')));
  }
  if (!isConfigured()) return res.status(503).json({ ok: false, error: 'Storage is not configured.' });

  try {
    if (r === 'status' && req.method === 'GET') {
      const rows = await rest('/social_videos?select=slug,review_ok,ig_status,tt_status,notes,updated_at', { method: 'GET' });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, rows });
    }
    if (r === 'update' && req.method === 'POST') {
      const { slug, field, value } = req.body || {};
      if (!SLUGS.has(slug)) return res.status(400).json({ ok: false, error: 'Unknown video.' });
      const valid = (field === 'review_ok' && typeof value === 'boolean')
        || ((field === 'ig_status' || field === 'tt_status') && STATUSES.includes(value))
        || (field === 'notes' && typeof value === 'string' && value.length <= 4000);
      if (!valid) return res.status(400).json({ ok: false, error: 'That change isn’t allowed.' });
      await rest(`/social_videos?slug=eq.${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value, updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ ok: true });
    }
    if (r === 'file' && req.method === 'GET') {
      const { kind, slug, dl } = req.query;
      const video = LIBRARY.find((v) => v.slug === slug);
      if (!video || !['ig', 'tt', 'cover'].includes(kind)) return res.status(404).json({ ok: false, error: 'Not found.' });
      const url = await storageSignedUrl(BUCKET, objectPath(kind, slug), 3600, dl ? video.files[kind] : undefined);
      res.setHeader('Cache-Control', 'private, max-age=600');
      res.setHeader('Location', url);
      return res.status(302).end();
    }
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'Couldn’t reach storage. Try again.', detail: err.message });
  }
  return res.status(404).json({ ok: false, error: 'Not found.' });
};
