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
//   POST /api/social?r=update              JSON: { slug, field, value }   (post_on: 'YYYY-MM-DD' or null)
//   GET  /api/social?r=file&kind=ig|tt|cover|igcover&slug=…[&dl=1]   302 to a signed link
//        (cover = TikTok cover, igcover = Instagram cover; both 1080x1920)
//   GET  /api/social?r=links&slugs=a,b[&stories=c,d][&days=120]   JSON of long-lived ig/tt video and story image links for a scheduler
//   GET  /api/social?r=file&kind=story&name=note-07                 302 to a signed story image link
//   GET  /api/social?r=calendar             calendar items other than library videos (videos come from r=status)
//   POST /api/social?r=cal-save             JSON: { id?, day, time, kind, platforms, title, story, status, notes }  (no id = new)
//   POST /api/social?r=cal-delete           JSON: { id }
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
const CAL_KINDS = ['story', 'post', 'event', 'other'];
const CAL_STATUSES = ['Planned', 'Scheduled', 'Posted', 'On hold', 'Done'];
const CAL_PLATFORMS = ['instagram', 'tiktok', 'facebook', 'other'];
// A real calendar day as YYYY-MM-DD (2026-02-31 doesn't round-trip, so it's refused).
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isId = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v);
// A calendar item as the page sends it, checked field by field; null when anything is off.
function calItem(b) {
  const item = {
    day: b.day, time: b.time || null, kind: b.kind, title: String(b.title || '').trim(),
    platforms: Array.isArray(b.platforms) ? [...new Set(b.platforms)] : [],
    story: b.story || null, status: b.status || 'Planned', notes: typeof b.notes === 'string' ? b.notes : '',
  };
  const ok = isDay(item.day) && (item.time === null || isTime(item.time)) && CAL_KINDS.includes(item.kind)
    && item.title.length >= 1 && item.title.length <= 200 && item.platforms.every((x) => CAL_PLATFORMS.includes(x))
    && (item.story === null || /^[a-z0-9-]{1,60}$/.test(item.story)) && CAL_STATUSES.includes(item.status) && item.notes.length <= 4000;
  return ok ? item : null;
}

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
const FOLDERS = { ig: 'ig', tt: 'tt', cover: 'tt-cover', igcover: 'ig-cover' };
// `rev` in library.json points a video at a re-rendered file (e.g. more-doors-v2.mp4): the bucket
// doesn't allow overwriting, so a fix is uploaded under a new name.
const objectPath = (kind, video) => {
  const isCover = kind.endsWith('cover');
  return `${FOLDERS[kind]}/${video.slug}${isCover ? '' : video.rev || ''}.${isCover ? 'jpg' : 'mp4'}`;
};

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
      const rows = await rest('/social_videos?select=slug,review_ok,ig_status,tt_status,notes,post_on,post_time,updated_at', { method: 'GET' });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, rows });
    }
    if (r === 'update' && req.method === 'POST') {
      const { slug, field, value } = req.body || {};
      if (!SLUGS.has(slug)) return res.status(400).json({ ok: false, error: 'Unknown video.' });
      const valid = (field === 'review_ok' && typeof value === 'boolean')
        || ((field === 'ig_status' || field === 'tt_status') && STATUSES.includes(value))
        || (field === 'notes' && typeof value === 'string' && value.length <= 4000)
        || (field === 'post_on' && (value === null || isDay(value)))
        || (field === 'post_time' && (value === null || isTime(value)));
      if (!valid) return res.status(400).json({ ok: false, error: 'That change isn’t allowed.' });
      await rest(`/social_videos?slug=eq.${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: value, updated_at: new Date().toISOString() }),
      });
      return res.status(200).json({ ok: true });
    }
    // Long-lived direct links for a scheduler (Buffer) that fetches the video only when the post goes
    // out. Only the videos asked for, for at most 180 days.
    if (r === 'links' && req.method === 'GET') {
      const days = Math.min(Math.max(Number(req.query.days) || 120, 1), 180);
      const wanted = String(req.query.slugs || '').split(',').filter((s) => SLUGS.has(s));
      const links = {};
      for (const slug of wanted) {
        const video = LIBRARY.find((v) => v.slug === slug);
        links[slug] = {
          ig: await storageSignedUrl(BUCKET, objectPath('ig', video), days * 86400),
          tt: await storageSignedUrl(BUCKET, objectPath('tt', video), days * 86400),
        };
      }
      // Story cards (A Note For Us Both) are images under story/ in the same bucket, asked for by name.
      const stories = {};
      for (const name of String(req.query.stories || '').split(',').filter((n) => /^[a-z0-9-]{1,60}$/.test(n))) {
        stories[name] = await storageSignedUrl(BUCKET, `story/${name}.jpg`, days * 86400);
      }
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, days, links, stories });
    }
    if (r === 'calendar' && req.method === 'GET') {
      const items = await rest('/social_calendar?select=id,day,time,kind,platforms,title,story,status,notes,updated_at&order=day,time', { method: 'GET' });
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, items });
    }
    if (r === 'cal-save' && req.method === 'POST') {
      const body = req.body || {};
      const item = calItem(body);
      if (!item || (body.id && !isId(body.id))) return res.status(400).json({ ok: false, error: 'Check the date, type and title, then try again.' });
      const saved = body.id
        ? await rest(`/social_calendar?id=eq.${body.id}`, { method: 'PATCH', body: JSON.stringify({ ...item, updated_at: new Date().toISOString() }) })
        : await rest('/social_calendar', { method: 'POST', body: JSON.stringify(item) });
      if (!saved || !saved.length) return res.status(404).json({ ok: false, error: 'That item is gone. Refresh the page.' });
      return res.status(200).json({ ok: true, item: saved[0] });
    }
    if (r === 'cal-delete' && req.method === 'POST') {
      const { id } = req.body || {};
      if (!isId(id)) return res.status(400).json({ ok: false, error: 'Unknown item.' });
      await rest(`/social_calendar?id=eq.${id}`, { method: 'DELETE' });
      return res.status(200).json({ ok: true });
    }
    if (r === 'file' && req.method === 'GET' && req.query.kind === 'story') {
      const name = String(req.query.name || '');
      if (!/^[a-z0-9-]{1,60}$/.test(name)) return res.status(404).json({ ok: false, error: 'Not found.' });
      res.setHeader('Cache-Control', 'private, max-age=600');
      res.setHeader('Location', await storageSignedUrl(BUCKET, `story/${name}.jpg`, 3600));
      return res.status(302).end();
    }
    if (r === 'file' && req.method === 'GET') {
      const { kind, slug, dl } = req.query;
      const video = LIBRARY.find((v) => v.slug === slug);
      if (!video || !Object.prototype.hasOwnProperty.call(FOLDERS, kind)) return res.status(404).json({ ok: false, error: 'Not found.' });
      const url = await storageSignedUrl(BUCKET, objectPath(kind, video), 3600, dl ? video.files[kind] : undefined);
      res.setHeader('Cache-Control', 'private, max-age=600');
      res.setHeader('Location', url);
      return res.status(302).end();
    }
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'Couldn’t reach storage. Try again.', detail: err.message });
  }
  return res.status(404).json({ ok: false, error: 'Not found.' });
};
