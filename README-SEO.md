# The Health & Well-being Hub — static site

This repository is a self-contained, statically generated NDIS provider
website (SEO/local-lead-gen rebuild — see below for the full tracking
audit). It can be deployed as-is to any static host (Netlify, GitHub
Pages, Cloudflare Pages, an S3+CDN bucket, or served by any web server
pointed at this repository's root).

See [`CLAUDE.md`](CLAUDE.md) for the business facts and conventions this
project works by, and [`docs/maintenance-runbook.md`](docs/maintenance-runbook.md)
for the maintenance process.

## Rebuilding the site

All page content lives in `content.py` (services/locations/blog/FAQ
copy) and `pages.py` (per-page titles/meta/schema wiring). Templates are
in `templates/`, shared CSS/JS in `static/`. After editing either file,
regenerate the static HTML:

```
python3 build.py
```

This rewrites every `*/index.html` file, `sitemap.xml` and `robots.txt`
from scratch (see `clean_generated_dirs()` in `build.py` — it only ever
touches generated output directories, never `templates/`, `static/`,
or the Python source files).

Requires Python 3 + Jinja2 (`pip install jinja2`).

## Tracking status (last updated during the pre-launch tracking audit)

### 1. Google Tag Manager (GTM) — ✅ done
Real container `GTM-NKMLMGDT` is live in `templates/base.html`
(`site.gtm_id` in `build.py`). Verified: the published container (fetched
directly from googletagmanager.com) contains the real GA4 Measurement ID,
and dataLayer events fire correctly for every tracked interaction.

### 2. GA4 — ✅ done
Measurement ID `G-66FG6SCSL0`, configured entirely inside GTM (a "Google
Tag" base tag + 5 "GA4 Event" tags), not hardcoded anywhere in this repo.
Verified live in GA4 Realtime. The site pushes these to `window.dataLayer`
for every trackable interaction (see `static/js/main.js`):

| Event | Fires on |
|---|---|
| `phone_click` | any `tel:` link click |
| `whatsapp_click` | any WhatsApp link click |
| `email_click` | any `mailto:` link click |
| `enquiry_cta_click` | any "Make an enquiry" / "Get started" link click |
| `referral_click` | any "Refer a participant" link click |
| `enquiry_submitted` | successful enquiry form submit only (never on click/validation-fail) |
| `referral_submitted` | successful referral form submit only |
| `generate_lead` | pushed alongside enquiry/referral submit, with `lead_type` — not yet wired to a GTM trigger, reserved for a future Google Ads "import from GA4" conversion |

Every trackable element also carries `data-track-location` (e.g.
`nav`, `sticky_mobile_bar`, `service_hero`) so GA4 can show which part of
the site is driving conversions. None of these payloads ever include
visitor-entered form data (name/phone/email/message) — verified by
submitting the enquiry form with realistic PII and confirming the
dataLayer payload only ever contains `event`/`form_name`/
`delivery_method`/`lead_type`/`link_location`/`link_url`.

GTM triggers are Custom Event triggers matching the event names above
exactly (case-sensitive). GA4 Event tags map `enquiry_submitted` and
`referral_submitted` to GA4's standard `generate_lead` event name.

### 3. Google Search Console — ✅ done
Verified via DNS TXT record on a **Domain property** for
`thehealthwellbeinghub.com` (covers both the apex and `www` automatically —
DNS-level verification, not the HTML meta tag method, so there's nothing
in the code to configure). Sitemap submitted.

### 4. Google Ads conversion tracking — not started
No Ads account/conversion actions exist yet. Once ads are running, create
conversion actions in Google Ads and link them to the same GTM triggers
above (or import directly from the GA4 `generate_lead`/`click_phone`/
`click_whatsapp`/`click_email` events once GA4 has enough data) — no code
changes needed, same pattern as GA4.

### 5. Enquiry & referral forms — ✅ wired to HubSpot
`FORM_ENDPOINT` in `static/js/main.js` points at `/api/hubspot-submit`
(`api/hubspot-submit.js`), a Vercel serverless function. On a real
submission it:
1. Finds-or-creates the Contact in HubSpot (search by email first, to
   avoid duplicates on repeat enquiries).
2. Creates a Deal at **New Enquiry** in the Participant / Lead Pipeline,
   associated to the contact.
3. Attaches a Note with the full enquiry/referral details (service
   needed, suburb, preferred language, referrer info, etc. — kept out of
   structured custom properties to avoid enum-mismatch write failures).
4. Creates a `CALL` follow-up Task due immediately, associated to both,
   so it surfaces in the next daily brief straight away.

The `HUBSPOT_TOKEN` Private App token lives only as an encrypted,
server-side Vercel environment variable (Production) — never in this
repo, never sent to the browser. If the token is ever rotated in
HubSpot, update it with:
```
vercel env rm HUBSPOT_TOKEN production
echo '<new-token>' | vercel env add HUBSPOT_TOKEN production
vercel deploy --prod
```
(a redeploy is required for the function to pick up a changed env var).

On submit, `main.js` still always:
1. Pushes the `enquiry_submitted` / `referral_submitted` dataLayer event.
2. POSTs JSON to `FORM_ENDPOINT`.
3. Falls back to opening a pre-filled `mailto:` to
   `thehealthwellbeinghub@gmail.com` if that call fails, so an enquiry is
   never silently lost even if HubSpot is briefly unavailable.

The `NEW_ENQUIRY_STAGE_ID` constant at the top of `hubspot-submit.js` is
fixed to the "New Enquiry" stage of the current pipeline — update it if
the pipeline is ever rebuilt (e.g. when the Referral Partner Pipeline
gets its own slot after a plan upgrade and Pipeline A's stage IDs change).

### 6. Domain / canonical URL
All canonical URLs, Open Graph tags and JSON-LD assume
`https://www.thehealthwellbeinghub.com`. Both the apex and `www` are live
on Vercel with valid SSL; page-route requests to the apex don't yet
redirect to `www` (only static files do, e.g. `/robots.txt`) — a Vercel
routing quirk with implicit `index.html` resolution taking priority over
the `vercel.json` redirect. Fix via Vercel dashboard → Domains → set one
domain to redirect to the other, rather than fighting `vercel.json` further.
