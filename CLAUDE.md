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
| Enquiry email | officethehealthwellbeinghub@gmail.com |
| Service lines | Support Coordination · Core Supports & Daily Living · Community Participation · Therapy Services |
| Languages spoken | English · Arabic · Somali · Dari · Amharic |
| Gender-matched workers | Available on request |
| Enquiry response time | Within **2 business hours** |
| Plan types accepted | Agency-managed · Plan-managed · Self-managed |
| CRM | **Retired 21 Sep 2026 — HubSpot is no longer used.** Referrals/enquiries/leads/tasks/feedback live in Supabase (`leads`, `referrers`, `lead_notes`, `tasks`, `feedback_submissions`) — see `docs/workflow-build-notes.md`. The rows below are historical only. |
| ~~HubSpot portal ID~~ | ~~443542186~~ retired |
| ~~HubSpot tier~~ | ~~Starter Customer Platform (A$16/seat/mo)~~ retired |
| ~~HubSpot data region~~ | ~~ap1 (Asia-Pacific)~~ retired |
| GA4 Measurement ID | `G-66FG6SCSL0` |

### Referrers vs leads — two different things

- **Referrer:** someone who has actually sent us a participant, whatever happened with that
  participant.
- **Lead:** a *potential* referrer — a contact we'd like referrals from who hasn't sent anyone
  yet. A lead becomes a referrer automatically when their first referral is logged.

Both live in the Supabase `referrers` table (a referrer has `has_referred`, a count, or a linked
referral). The database's `leads` table is neither: it holds the referrals and enquiries
themselves — the name predates this distinction. In anything a person reads, say "referrals"
or "enquiries" for those rows, never "leads".

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
3. **Lead-Gen Command Centre** — now a real Next.js app, a separate repo
   (`TheHealthWellbeingHub/command_centre`, deployed on Vercel), not a claude.ai Artifact —
   the Artifact was the original prototype and is superseded. It reads Supabase directly
   (`participants`, `leads`, `referrers`, `tasks`, `lead_notes`, `feedback_submissions`, …)
   and Shiftcare live. See that repo's own `README.md`. It also has a participant-data
   workstream — bringing participant profile data in Supabase in line with source documents —
   documented in [`docs/command-centre-participant-data.md`](docs/command-centre-participant-data.md).
   Read that file before touching the `participants`/`participant_documents`/
   `document_findings`/`participant_profile_updates` tables: it sets out the staged
   propose → human sign-off → promote workflow. Live participant clinical/risk fields are
   never written directly; only `document_findings` (an append-only audit log) is.
4. **Email template library** — nine branded, responsive NDIS email templates covering the
   participant lifecycle from referral through to exit.

> **Repo status:** the site, provider directory and all nine email templates have now been
> imported (see `README-SEO.md` for the tracking/GTM/GA4 implementation status — the HubSpot
> parts of that doc are historical, HubSpot is retired). `docs/analytics/` handoff described
> below is still outstanding — nothing committed there yet. The participant-data workstream
> above is documented and underway.

## Which Claude surface can do what

Connectors are attached per session, so check what the session in front of you actually has
rather than assuming. As of 25 Sep 2026, Claude Code sessions on this repo can carry Gmail,
Google Calendar, Google Drive, Supabase, Vercel, ShiftCare and Xero alongside files, git and
GitHub, and can hold the `command_centre` repo too. HubSpot is retired (21 Sep 2026) — a
HubSpot connector may still be attached, but nothing should be written there.

| System | How Claude reaches it | Notes |
|---|---|---|
| Files, git, GitHub | direct | always available |
| Supabase, Vercel, Google Workspace | connectors | Supabase connector is the participant-data project (`azzvzegudhdgwlrinije`) — see `docs/command-centre-participant-data.md` |
| ShiftCare | custom connector, `https://mcp.au.shiftcare.com/mcp` | an org admin adds it once; each user then signs in with their own ShiftCare login |
| Google Analytics | claude.ai chat only | no GA connector in Claude Code |

Analytics findings are still committed as dated summaries under `docs/analytics/`, so that a
session without a GA connector can work from them.

---

## Guardrails

**Participant data lives in the source systems, not in git.** ShiftCare and HubSpot hold
real people's health and disability information, and Claude is authorised to work with it
there. Reading a participant record, creating one, updating a plan or a shift, closing a
record — all of that is expected work through the ShiftCare and HubSpot connectors, and does
not need separate approval each time.

What does not change is where that data comes to rest. It stays in ShiftCare, HubSpot and the
participant-data Supabase project — never in this git repository. Only aggregate,
non-identifying counts are committed here — no names, contact details, NDIS numbers, plan
details or case notes in source files, fixtures, sample data, logs, commit messages or
documentation. Git history here is permanent and mirrored to every org member and to GitHub;
a participant's record committed once cannot meaningfully be withdrawn. If a task appears to
need real participant data in a file, use invented data or a count instead, and say which was
used.

The Supabase project mirrors ShiftCare documents into structured profiles that staff read
directly, so edits there carry the same weight as editing ShiftCare itself — reading and
logging findings is unrestricted, but changes to a live profile's clinical/risk fields go
through the staged propose → human sign-off → promote workflow in
`docs/command-centre-participant-data.md` rather than being written straight to the field.

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

## Guiding a worker through a workflow, live

**Decided 25 August 2026, standing instruction.** When a worker is mid-workflow — any of
the eight documented in `docs/workflows-overview.html` — tell them only the next concrete
step. Nothing else.

- Concise, active voice. State what they should do next, directly.
- No explaining why, no restating what already happened, no describing the workflow to
  them — they are doing it, not reading about it.
- No passive waiting language ("say the word", "let me know if...", open-ended offers).
  Where a step genuinely requires their confirmation before Claude acts (a send, a write),
  say so as the next step itself — not as something they have to separately ask for.

The worker is trying to complete a task. Get them to the next action and stop.

---

## Conventions

- **Branch:** develop on `claude/health-wellbeing-hub-site-f84rj6`. Never push elsewhere
  without explicit permission.
- **Naming:** one scheme per directory, applied consistently. The email template library's
  drift (display labels not matching filenames, one template living outside the directory
  under a different convention) has been fixed — all templates live in `email-templates/` as
  `01-`-prefixed files with labels matching filenames, now numbered `01-`–`11-`. Keep it that
  way. The templates are **hand-authored HTML and are the source of truth**: the old
  `generate.py`, which wrote them from Python, was removed on 24 Aug 2026 when the designs were
  supplied as finished HTML, because a generator holding a superseded design silently overwrites
  approved work the next time anyone runs it. `build_index.py` only reads the templates and
  rebuilds `index.html` from them.
- **Merge fields:** the email templates use `{{Title Case}}` — `{{Key}}` is required,
  `{{Key|fallback}}` renders the fallback when no value is given. HubSpot is no longer used.
  The form acknowledgements (02/03/07/08) are sent by `api/lead-submit.js`, and 05/06 by the
  Command Centre — both fill the templates with their own field names, so **don't rename a
  field in those templates without changing its sender too**. Everything else sends through
  `api/send-participant-email.js`, which reads the required fields from the template itself
  and fills `{{Phone Number}}`, `{{Email Address}}` and the unsubscribe link itself.
  Field list per template: `docs/email-merge-fields.md`.
- **Creating a referral or an enquiry:** always through `api/lead-submit.js`
  (`form_name: "staff_referral"` / `"staff_enquiry"`), never a direct insert into `leads` —
  that is what sends email 02 / 03 and raises the call task. Details:
  `docs/workflow-01-referral.md` and `docs/workflow-02-enquiry.md`, "Current triggers".
- **Git hooks:** `.githooks/pre-commit` blocks commits authored on the production branch,
  which is also the default branch, so a push to it is a live release. Claude Code enables it
  automatically via `SessionStart` in `.claude/settings.json`; otherwise run
  `git config core.hooksPath .githooks` once. Deploys pass `ALLOW_PROD_COMMIT=1`.
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
