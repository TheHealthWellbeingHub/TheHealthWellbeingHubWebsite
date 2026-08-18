# The Health & Well-being Hub — project brief

Read this first in every session. It carries the business facts that must not drift,
and the conventions this repo works by.

For *how* to maintain things on a recurring basis, see
[`docs/maintenance-runbook.md`](docs/maintenance-runbook.md).

---

## What the business is

The Health & Well-being Hub is a **registered NDIS and allied health provider** based in
Logan Central, Queensland, Australia. It was founded by **Kholoud Abdalla** specifically to
serve Brisbane's Arabic-speaking, Somali, Afghan and Ethiopian communities — families who
often struggle to find NDIS providers who understand their language, faith and culture.

That origin is the **core positioning, not a footnote**. It is the reason a family chooses
this provider over a generic one. It should lead in copy, not sit in an "About us" paragraph.

## Canonical facts — never contradict these

These appear across the site, email templates, the directory and the CRM. If a change would
alter any of them, stop and confirm with the user rather than guessing.

| Fact | Value |
|---|---|
| NDIS registration number | **4050045262** |
| ABN | **91 643 237 045** |
| Base location | Logan Central, Queensland |
| Street address | 73 Jacaranda Avenue, Logan QLD 4114 |
| Public domain | thehealthwellbeinghub.com |
| Phone | 0433 604 507 |
| Enquiry email | thehealthwellbeinghub@gmail.com |
| Service lines | Support Coordination · Core Supports & Daily Living · Community Participation · Therapy Services |
| Languages spoken | English · Arabic · Somali · Dari · Amharic |
| Gender-matched workers | Available on request |
| Enquiry response time | Within **2 business hours** |
| Plan types accepted | Agency-managed · Plan-managed · Self-managed |
| HubSpot portal ID | **443542186** |
| HubSpot tier | Starter Customer Platform (A$16/seat/mo) |
| GA4 Measurement ID | `G-66FG6SCSL0` |

### Two different service footprints

This is easy to get wrong, and getting it wrong misleads participants:

- **Hands-on supports** (Core Supports & Daily Living, Community Participation, Therapy
  Services) — Logan, Brisbane and South East Queensland.
- **Support Coordination** — reaches further, with clients in NSW, VIC and WA.

Location pages must not imply the full service range is available nationally.

## Claims that need care

Two claims are concrete and externally checkable. Do not soften them into vagueness, and do
not restate them more strongly than the table above:

- The **2 business hour** response — a specific, measurable promise.
- **All plan types accepted** — the point is that no participant is turned away over plan
  management type.

Anything asserting clinical outcomes, NDIS funding eligibility, or what a participant's plan
will cover is a compliance matter. Draft it, flag it, and leave it for human review before
publishing.

---

## What lives in this project

1. **Marketing / lead-gen website** — static, SEO-optimised. Service pages, location pages,
   blog, trust and compliance pages.
2. **Provider Directory** — searchable database of ~47,848 real NDIS providers across
   Australia. Strategically this is a traffic and positioning play: being the helpful hub
   that lists competitors, rather than only selling.
3. **Lead-Gen Command Centre** — an internal Claude Artifact pulling live Google Analytics
   and HubSpot data, to track the site as a lead source.
4. **Email template library** — nine branded, responsive NDIS email templates covering the
   participant lifecycle from referral through to exit.

> **Repo status:** the site, provider directory and all nine email templates have now been
> imported (see `README-SEO.md` for the tracking/GTM/GA4/HubSpot implementation status). The
> Command Centre artifact and the `docs/analytics/` handoff described below are still
> outstanding — nothing has been committed there yet.

## Which Claude surface can do what

No single session sees both the live data and the code. Verified by checking connectors in
this environment:

| Surface | Can reach | Cannot reach |
|---|---|---|
| **Claude Code** (this repo) | files, git, GitHub | HubSpot, Google Analytics |
| **claude.ai chat** (Command Centre artifact) | HubSpot, GA via connectors | this git repo |

Do not design a process that assumes one session has both. The repo is the meeting point:
analytics findings are committed as dated summaries under `docs/analytics/`, and work in
Claude Code proceeds from those committed files.

---

## Guardrails

**Participant data never enters this repository.** HubSpot holds real people's health and
disability information. Only aggregate, non-identifying counts cross into git — no names,
contact details, NDIS numbers, plan details, case notes or anything traceable to an
individual. This is not a style preference; it is the line that matters most here.

**Compliance wording is reviewed, not generated.** Operational and compliance language must
be checked against H&W's approved policies, service agreement and current NDIS requirements
before production use. Claude drafts; a human approves.

**Cultural and community claims are the founder's to make.** Do not invent detail about
religious observance, cultural practice, or which communities are served beyond what is
recorded above.

**Write plainly.** The audience includes participants, families and carers reading in a
second language. Short sentences, plain words, no marketing throat-clearing. Avoid idiom
that does not translate.

---

## Conventions

- **Branch:** develop on `claude/health-wellbeing-hub-site-f84rj6`. Never push elsewhere
  without explicit permission.
- **Naming:** one scheme per directory, applied consistently. The email template library's
  drift (display labels not matching filenames, one template living outside the directory
  under a different convention) has been fixed — all nine now live in `email-templates/` as
  `01-`–`09-` prefixed files with labels matching filenames. Keep it that way.
- **Merge fields:** the email templates use `{{double brackets}}`. HubSpot uses its own
  token syntax. Anything intended to sync into HubSpot needs deliberate conversion — do not
  assume the two are interchangeable.
- **Stack:** static Python + Jinja2 site generator (`build.py` renders `templates/` using
  content from `content.py`/`pages.py` into committed static HTML — no build step at serve
  time, no framework). Deployed on Vercel. Don't introduce a different framework or build
  tool without asking first — this was a deliberate choice, not a placeholder.

## Unconfirmed — verify before publishing

Domain, phone, enquiry email, street address and ABN were confirmed directly by the user and
are now in the canonical facts table above. Trading hours are also confirmed: **Mon–Fri
8:00am–5:00pm, support available 7 days**.

Still not verified — do not invent values for these:

- **Provider Directory licensing terms.** The ~47,848-row dataset's source and how it was
  cleaned is known (see `README-SEO.md` / the load scripts), but the formal licence/terms
  under which it can be redistributed on this site has not been confirmed. Don't represent it
  as clear until someone checks.
(HubSpot's portal ID is now confirmed as **443542186** and recorded in the canonical facts
table above.)
