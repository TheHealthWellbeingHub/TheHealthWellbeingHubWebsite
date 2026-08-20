# Campaign tracking on Starter

How to measure an email campaign when HubSpot's **Campaigns** tool is not available.

First campaign: **`referrer-outreach-2026-08`** — the referrer outreach email,
`email-templates/campaigns/2026-08-referrer-outreach.html`.

---

## HubSpot Campaigns is not available on this account

**Tested 20 Aug 2026.** Creating a campaign through the API returns:

```
{"errorMessage":"Not Authorized"}
```

and the account capability table reports `CAMPAIGN: read REQUIRES_ACCOUNT_MODIFICATION,
write REQUIRES_ACCOUNT_MODIFICATION`. Campaigns is a Marketing Hub Professional feature; the
portal is on **Starter Customer Platform**.

This is a tier limitation, not the connector problem that blocks marketing-email writes — those
fail with a permission/auth error while reads succeed. Two separate issues that look similar
from the outside.

> **Worth checking in the UI once.** If *Campaigns* does appear under Marketing in the portal,
> the email can be associated with a campaign by hand and this document becomes a supplement
> rather than a replacement. The API says no; the UI is the authority on what the tier includes.

---

## What replaces it

Four sources. None is a campaign dashboard, but together they answer the question the campaign
was for: *how many participant leads did hundreds of emails produce?*

### 1. The email's own analytics — automatic, nothing to set up

Marketing → Marketing Email → the email → **Performance**.

| Metric | Why it matters here |
|---|---|
| Delivered / bounced | A new sending domain's first real test |
| **Hard bounce rate** | Should stay near zero. A spike means list quality or reputation |
| **Spam report rate** | The one that actually damages deliverability |
| Unique clicks | The real engagement signal for this campaign |
| Opens | Directional only — Apple Mail pre-loads tracking images |

Opens are the least trustworthy number on the page. Clicks are what matter, because this email
has somewhere to go.

### 2. UTM attribution — built into the endpoint

Every link in the campaign email carries:

```
utm_source=hubspot&utm_medium=email&utm_campaign=referrer-outreach-2026-08&utm_content=<which-cta>
```

`utm_content` differs per link, so the two calls to action can be told apart:

| `utm_content` | Link |
|---|---|
| `cta-refer` | "Refer a participant" button |
| `directory-image` | The directory screenshot |
| `directory-button` | "Search the provider directory" |
| `footer-website` | "Visit our website" |

The site captures these on arrival and holds them for the browsing session (see
`static/js/main.js`), so a referrer who clicks through, reads two pages and *then* submits is
still attributed to the campaign. First touch wins, and it is `sessionStorage` — an unrelated
visit next month is not credited to this campaign.

The endpoint records them on every submission as a single readable line in the note:

```
Campaign: referrer-outreach-2026-08 (hubspot / email, cta-refer)
```

That works today with no further setup. It is readable, not filterable.

### 3. Four properties to make it filterable — **not yet created**

Until these exist the endpoint writes them and `filterToWritable` silently drops them. Contact
object, all four **Single-line text**:

| Internal name | Label |
|---|---|
| `latest_utm_source` | Latest UTM — source |
| `latest_utm_medium` | Latest UTM — medium |
| `latest_utm_campaign` | Latest UTM — campaign |
| `latest_utm_content` | Latest UTM — content |

Internal names must match exactly. Same caveat as every property added so far: the endpoint
caches the contact schema per serverless cold start, so values may be dropped for a minute or
two after creation before the next cold start picks them up.

### 4. The list that answers the actual question

Once the properties exist — Contacts → Lists → Create **active list**:

```
Latest UTM — campaign  is equal to  referrer-outreach-2026-08
```

That list is every person who reached the site from this campaign and submitted something. Its
size is the campaign's lead count. Cross-referenced against the deal pipeline, it is the
conversion rate.

An **active** list, not static, so it keeps updating as more arrive.

### 5. GA4 — already wired

Campaign traffic appears under *Reports → Acquisition → Traffic acquisition*, split by source
and medium. The site already pushes `enquiry_submitted`, `referral_submitted` and
`generate_lead`, so conversions attribute to the campaign without further work. See
`README-SEO.md`.

GA4 answers "how much traffic and how many conversions". HubSpot answers "who, and did they
become a client". Neither replaces the other.

---

## What to look at, and when

| When | Where | Looking for |
|---|---|---|
| First hour of each batch | Email performance | Hard bounces, spam reports. Stop and diagnose before sending the next batch if either moves |
| Day 1–2 | Email performance | Clicks, and which `utm_content` won |
| Day 2–7 | The campaign list | Referrals and enquiries actually arriving |
| Week 2+ | Deal pipeline | How many became participants |

The last row is the only one that measures the campaign's purpose. The rest are leading
indicators.

---

## The number that is not tracked

**Whether a referral that arrived weeks later came from this campaign.** Attribution is captured
at submission from the browsing session, so someone who reads the email, does nothing, and
returns organically a fortnight later is recorded as organic — correctly, arguably, but it
understates the campaign's real influence.

There is no fix for this on Starter that is worth the complexity. Worth knowing when reading the
numbers: the campaign's measured contribution is a floor, not a total.
