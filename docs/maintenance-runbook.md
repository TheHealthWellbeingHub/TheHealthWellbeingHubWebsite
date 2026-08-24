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

## How the live site deploys

`thehealthwellbeinghub.com` is served by the Vercel project **health-wellbeing-hub** under the
team `the-health-wellness-being-hub` (project ID `prj_xAASAtvdRe2ohkCXvcESudaRC2EE`). Four
domains point at it: the apex, `www`, and two `.vercel.app` aliases.

**The Git connection moved on 2026-08-17.** Until then, production was built from a completely
different repository — `bbangll/Tabby`, subdirectory `health-wellbeing-hub`, branch
`claude/health-wellbeing-seo-audit-7g6gwx`. This repository was not connected to Vercel at all,
so commits here did not reach the live site. The project is now connected to
`The-Health-Wellbeing-Hub/TheHealthWellbeingHubWebsite` instead, making this repo both the
source of truth and the deploy source.

Two consequences to keep in mind:

- **The default branch is the production branch.** Vercel builds production from the repo's
  default branch, which is `claude/health-wellbeing-hub-site-f84rj6`. There is no `main`. So the
  "never straight to the default branch" rule below is also the rule that keeps unreviewed work
  off the live site — a push to that branch *is* a production release, with no preview or PR
  gate in front of it. Other branches produce preview deployments only.
- **A new commit is what triggers a deploy.** Pushing a branch that merely points at a commit
  Vercel has already seen does not start a build. Verified on the switch: creating
  `claude/great-hypatia-f6nrrb` at the existing tip produced nothing, and the next real commit
  built immediately.
- **Root Directory is a project setting, not part of the Git connection**, so it is worth
  checking after any reconnection — the old project built from a `health-wellbeing-hub`
  subdirectory that does not exist in this repo. Confirmed correct on 2026-08-17: the first
  build after the switch cloned this repository at its root and completed.

Preview deployments sit behind Vercel Authentication (SSO), so a preview URL returns a 302 to
`vercel.com/sso-api` rather than the page when fetched without a session. That is deployment
protection working as intended, not a broken build — read the build logs to judge a build.

There is no build step at deploy time: `build.py` renders `templates/` into static HTML that is
committed to the repo, and Vercel serves those files directly. Run `build.py` and commit its
output as part of any content change — editing `content.py` alone changes nothing that gets
served. The one dynamic piece is `api/hubspot-submit.js`, a serverless function that reads
`HUBSPOT_TOKEN` from Vercel's production environment variables; changing that variable requires
a redeploy before the function picks it up.

To verify a deploy landed, check that the newest production deployment's commit SHA matches the
tip of the default branch, and that its `gitRepo` metadata names this repository — not `Tabby`.

### `vercel.json` takes no comments

Learned the hard way on 24 Aug 2026: a production deploy failed outright with

> ``The `vercel.json` schema validation failed: `headers[0]` should NOT have additional
> property `comment` ``

JSON has no comment syntax, and Vercel validates the file against a strict schema that
rejects any key it does not recognise — so an explanatory `"comment"` field does not sit
there harmlessly, it stops the deploy. The failure happens before the build, so there are
**no build logs**; the reason is only in the deployment's `errorMessage`. Look there first
when a deploy errors with an empty log.

The live site was never affected: a deployment that fails validation never takes the domain
aliases, so production keeps serving the previous good build. Reasoning about config
belongs here, not in the file.

### Why the noindex headers exist

`vercel.json` sets `X-Robots-Tag: noindex, nofollow` on `/email-templates/` and `/staff/`.

The email template library is committed to the repo, so Vercel serves it: every template has
been publicly readable and indexable since it was added. They are internal working files —
drafts, editorial notes sitting inside token braces, copy awaiting compliance review — and
none of it should surface in a search for the business. The staff intake form is covered for
the same reason, on top of the `noindex` meta tag it already carries, because it creates
participant records and is protected only by an unguessable address.

**Do not add a matching `Disallow` to `robots.txt`.** It looks like belt and braces and is
actually the opposite: blocking the crawl stops Google ever reading the header, and the
header is what reliably removes a page from the index. A `Disallow` alone can leave URL-only
entries in results.

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
