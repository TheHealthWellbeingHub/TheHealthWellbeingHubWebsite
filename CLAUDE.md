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
| Base location | Logan Central, Queensland |
| Service lines | Support Coordination · Core Supports & Daily Living · Community Participation · Therapy Services |
| Languages spoken | English · Arabic · Somali · Dari · Amharic |
| Gender-matched workers | Available on request |
| Enquiry response time | Within **2 business hours** |
| Plan types accepted | Agency-managed · Plan-managed · Self-managed |

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

> **Repo status:** this repository started empty. Assets built before it existed live
> elsewhere and still need importing. Do not assume a file is absent because it was never
> written — check with the user before rebuilding something that may already exist.

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
- **Naming:** one scheme per directory, applied consistently. The email template library
  already drifted — display labels stopped matching filenames from item 06 onward, and one
  template sits outside the directory under a different convention. Do not add to it; fix it
  when touching that area.
- **Merge fields:** the email templates use `{{double brackets}}`. HubSpot uses its own
  token syntax. Anything intended to sync into HubSpot needs deliberate conversion — do not
  assume the two are interchangeable.
- **Stack:** not yet chosen. The user has expressed no preference. Ask before introducing a
  framework or build tooling.

## Unconfirmed — verify before publishing

Not yet supplied by the user. Do not invent values for these:

- Public domain name
- Business phone number and enquiry email address
- Full street address
- ABN
- Trading hours
- Provider Directory data source and licensing terms
- Google Analytics property ID and HubSpot portal ID
