// Xero redirects here after the admin approves (or denies) the consent
// screen. Must match XERO_REDIRECT_URI exactly, and that same URL must be
// registered as the app's redirect URI in the Xero Developer Portal
// (My Apps -> this app -> Configuration) or Xero will reject the exchange
// with a redirect_uri mismatch before this code ever runs.
const { isConfigured, verifyState, exchangeCodeForTokens, getConnections, canPersistToVercel, persistEnvVar } = require('./_xero');

function page(title, bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font:15px/1.5 -apple-system,sans-serif;max-width:640px;margin:48px auto;padding:0 20px;color:#1a1a1a}
code{background:#f3f3f3;padding:2px 6px;border-radius:4px;word-break:break-all}</style></head>
<body><h2>${title}</h2>${bodyHtml}</body></html>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  if (!isConfigured()) {
    return res.status(503).send(page('Not configured', '<p>XERO_CLIENT_ID / XERO_CLIENT_SECRET are not set.</p>'));
  }

  const { code, state, error, error_description: errorDescription } = req.query;

  if (error) {
    return res.status(400).send(page('Xero declined', `<p>${error}: ${errorDescription || ''}</p>`));
  }
  if (!verifyState(state)) {
    return res.status(400).send(page('Could not verify request', '<p>The state parameter was missing, expired, or invalid. Start again from /api/xero-connect.</p>'));
  }
  if (!code) {
    return res.status(400).send(page('Missing code', '<p>Xero did not return an authorization code.</p>'));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const connections = await getConnections(tokens.access_token);
    const org = connections[0];

    if (await canPersistToVercel()) {
      await persistEnvVar('XERO_REFRESH_TOKEN', tokens.refresh_token);
      if (org) await persistEnvVar('XERO_TENANT_ID', org.tenantId);
      return res.status(200).send(page('Connected to Xero',
        `<p>Connected to <strong>${org ? org.tenantName : 'Xero'}</strong>.</p>
         <p>The refresh token was saved automatically. This connection will keep itself alive.</p>`));
    }

    // Bootstrap path: no Vercel API token configured yet, so there's
    // nowhere to auto-save the refresh token. Show it once so it can be
    // added to Vercel env vars by hand — this is the only time it should
    // ever appear on screen.
    return res.status(200).send(page('Connected to Xero — one manual step left',
      `<p>Connected to <strong>${org ? org.tenantName : 'Xero'}</strong>, but automatic saving isn't set up yet
       (no VERCEL_API_TOKEN configured), so add these two values to the Vercel project's env vars manually,
       then this page never needs to be visited again:</p>
       <p><code>XERO_REFRESH_TOKEN=${tokens.refresh_token}</code></p>
       ${org ? `<p><code>XERO_TENANT_ID=${org.tenantId}</code></p>` : ''}
       <p>Once VERCEL_API_TOKEN + VERCEL_PROJECT_ID are set, reconnecting will save future rotations automatically.</p>`));
  } catch (err) {
    console.error('xero-callback failed:', err.message);
    return res.status(502).send(page('Connection failed', `<p>${err.message}</p>`));
  }
};
