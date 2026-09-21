// Minimal Supabase REST (PostgREST) client over fetch — no @supabase/supabase-js
// dependency, same reasoning as mailer.js: this repo has no package.json and
// adding one changes how Vercel treats the whole project. Server-side only;
// SUPABASE_SERVICE_ROLE_KEY bypasses RLS, so this file must never be
// imported by anything that runs in the browser.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://azzvzegudhdgwlrinije.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

async function rest(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(
      (data && (data.message || data.error_description || data.hint)) || `Supabase REST ${res.status}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function insertOne(table, row) {
  const rows = await rest(`/${table}`, { method: 'POST', body: JSON.stringify(row) });
  return rows[0];
}

async function updateOne(table, id, patch) {
  const rows = await rest(`/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return rows[0];
}

// Simple single-column-equality lookup, e.g. selectOne('referrers', 'email', 'x@y.com').
async function selectOne(table, column, value, select = '*') {
  const rows = await rest(
    `/${table}?${column}=eq.${encodeURIComponent(value)}&select=${encodeURIComponent(select)}&limit=1`,
    { method: 'GET' }
  );
  return rows[0] || null;
}

async function selectMany(table, query, select = '*') {
  return rest(`/${table}?${query}&select=${encodeURIComponent(select)}`, { method: 'GET' });
}

module.exports = { isConfigured, rest, insertOne, updateOne, selectOne, selectMany };
