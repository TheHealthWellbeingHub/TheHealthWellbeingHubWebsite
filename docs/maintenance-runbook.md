# Maintenance runbook

How The Health & Well-being Hub's web presence stays maintained through Claude, without
things quietly rotting between sessions.

Business facts and guardrails live in [`../CLAUDE.md`](../CLAUDE.md). This file is about
process: what happens, how often, and on which surface.

---

## The problem this solves

Assets currently live in several places at once — a website, a provider directory, a
dashboard artifact, nine email templates, and HubSpot. Nothing reconciles them, so they drift
apart.

This is not hypothetical. The email template library index already shows it:

- Display labels stopped matching filenames from item 06 onward — `TEMPLATE 06` links to
  `07-support-worker-introduction.html`, and so on through `TEMPLATE 09` →
  `10-service-cancellation-exit.html`.
- There is no `06-*.html`, and the set runs to `10`.
- `TEMPLATE 01` points up a directory to `../hw-ndis-referral-email.html`, under a different
  naming convention from its eight siblings.

Two numbering schemes emerged across nine files. The website and the directory will drift
faster, because they are larger and change more often.

---

## The five parts

### 1. One repository is the source of truth

Everything Claude maintains lives here in git: site, provider directory, all nine email
templates, and `docs/`.

HubSpot and the Command Centre artifact are **rendering targets, not masters**. If the only
copy of a template lives in HubSpot's editor, Claude cannot see it, cannot review it, and
cannot tell you when it contradicts the site.

*Status: outstanding.* The repository started empty; the existing assets still need importing.

### 2. `CLAUDE.md` carries the context

So every session begins knowing the registration number, the four service lines, the five
languages, the response SLA and the two service footprints — instead of being re-briefed each
time, and instead of drifting when it isn't.

It also means Claude can flag copy that contradicts the canonical facts, which is only
possible when there is a recorded version to contradict.

*Status: done.*

### 3. Split the loop by surface

Neither surface can do the whole job (see the table in `CLAUDE.md`). So run two halves with a
deliberate handoff:

**In claude.ai**, with the HubSpot and GA connectors:
- Pull the period's numbers.
- Render the Command Centre dashboard as usual.
- **Also** write a short summary and commit it to `docs/analytics/YYYY-MM-DD.md`.

**In Claude Code**, working from that committed summary:
- "Traffic to the Arabic-language page tripled — expand it."
- "The Support Coordination page draws visits but no enquiries — fix the CTA."
- "Three location pages get no impressions — either improve or remove them."

The handoff is a file in git: dated, diffable, and reviewable in six months when someone asks
why a page changed.

Keep the summary aggregate only. Sessions, pageviews, sources, enquiry counts, conversion
rates — never individual records. See the participant-data guardrail in `CLAUDE.md`.

Suggested shape for `docs/analytics/`:

```markdown
# Analytics summary — YYYY-MM-DD (period covered)

## Traffic
Sessions, top landing pages, top queries, notable changes vs previous period.

## Enquiries
Count, source breakdown, service line breakdown. Aggregate only.

## Observations
What changed and the likely reason.

## Actions for the repo
A short list, specific enough to act on without re-reading the numbers.
```

### 4. Automate the drift checks

Cheap checks, run in CI, that catch mechanically what nobody catches by reading:

- **Internal links resolve** — would have caught the email template numbering immediately.
- **Canonical facts appear correctly** wherever they are cited — registration number, the
  four service line names, the five languages, the 2-business-hour response.
- **Merge-field syntax is consistent** — templates use `{{double brackets}}`; HubSpot uses
  its own tokens. A mismatch here sends a participant an email with a raw placeholder in it.
- **Service footprint is not overstated** — flag pages implying the full service range is
  available outside South East Queensland.

*Status: outstanding — depends on part 1.*

### 5. Scheduled routines for the recurring beats

Recurring obligations that depend on someone remembering eventually get missed. These can be
set up as scheduled Claude routines:

| Cadence | What it does |
|---|---|
| **Weekly** | Review the latest analytics summary; propose content and SEO changes. |
| **Monthly** | Compliance pass — check operational and compliance wording against approved policies, the service agreement and current NDIS requirements. Produces a list for human review; never publishes on its own. |
| **Quarterly** | Refresh the provider directory dataset; report how many providers were added, removed or changed. |

The monthly pass matters most. The email template library already carries the note that its
wording *"should be reviewed against H&W's approved policies, service agreement and current
NDIS requirements before production use"* — that is a standing obligation with no owner
until it is scheduled.

---

## Working agreement

- Claude drafts; a human approves anything participant-facing or compliance-related.
- Changes go to `claude/health-wellbeing-hub-site-f84rj6`, never straight to the default
  branch.
- When a canonical fact needs to change, update `CLAUDE.md` in the same change as the copy.
  One source of truth, updated once.
- If something is unknown, it stays on the "Unconfirmed" list in `CLAUDE.md` rather than
  being invented.

## Next steps

1. **Import the existing assets** into this repository — the blocker for parts 1, 4 and 5.
   Requires knowing where the current site, directory and email templates live.
2. Decide the stack, if the site is being rebuilt rather than imported.
3. Add the CI checks once there are files to check.
4. Set up the three scheduled routines.
5. Fix the email template numbering and relocate template 01 into the library directory.
