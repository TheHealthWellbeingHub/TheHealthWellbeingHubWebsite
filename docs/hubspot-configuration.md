# HubSpot configuration spec

The exact objects, properties and pipelines to build in HubSpot, and why each exists.

Business facts are in [`../CLAUDE.md`](../CLAUDE.md). The wider operating process is in
[`maintenance-runbook.md`](maintenance-runbook.md).

**Status:** *not* greenfield. A HubSpot pipeline already exists and a live production
endpoint already writes to it. This document is therefore a reconciliation — what exists,
what is missing, and what should change — not a clean-slate design.

**Connector reachability — updated 18 Aug 2026.** The HubSpot connector *is* reachable from
Claude Code and was used to verify the pipeline and property state below. It can read schema
and read/write **records**, but it exposes **no tool for creating or editing property
definitions** — so all property creation is manual. See
[`hubspot-manual-setup.md`](hubspot-manual-setup.md).

---

## Why this is worth doing now

The portal was created on 11 August 2026 and is close to empty. Adding properties now costs
nothing. Retrofitting them across hundreds of participant records later is slow, error-prone,
and has to be done by a person who knows what each record meant.

The rule this spec follows: **attributes go in fields, story goes in notes.** Anything you
would ever filter, count, report on, automate against, or sync to ShiftCare must be a field.
Free-text notes do not survive the ShiftCare handoff, cannot trigger automation, and cannot
be counted.

---

## Tier — Starter Customer Platform

Confirmed by the user. **Starter Customer Platform, A$16/seat/month** (discounted from A$31),
with **500 HubSpot Credits** and **1,000 marketing contacts**.

What that does and does not buy, because it decides where automation can live:

| Capability | On Starter |
|---|---|
| Create contacts, deals, notes, tasks via REST API | ✅ already in use |
| Custom properties | ✅ |
| Ticket pipelines | ✅ |
| **Simple workflows** — max 10 actions, **one per form**, form-triggered only | ✅ |
| Simple-workflow actions: send marketing email · internal notification · create record or task · assign contact · add/remove from list · **send webhook** | ✅ |
| Full workflow builder with branching, delays, enrolment triggers | ❌ Professional |
| Transactional email Single-Send API | ❌ Professional **plus** a paid add-on |

Two consequences run through every workflow spec in this repo:

1. **Automated email must be triggered by a form submission.** There is no other enrolment
   trigger on Starter, and the transactional API is two paid tiers away.
2. **Simple workflows cannot branch.** Any conditional logic stays in
   `api/hubspot-submit.js`, where it is code, testable, and free.

---

## 0. What exists today, and two gaps

`api/hubspot-submit.js` is a Vercel serverless function, live in production, wired to the
site's forms via `FORM_ENDPOINT = '/api/hubspot-submit'` in `static/js/main.js`. On each
submission it upserts a Contact by email, reuses an open Deal or creates one, attaches a Note,
and raises a HIGH-priority follow-up Task.

That is a sound shape. Reusing an open deal rather than opening a parallel one is exactly
right. Two things need attention.

### Gap 1 — triage data is written to a note, not to fields

The contact form already collects the right information: `preferred_language`,
`service_needed`, `suburb`, `enquirer_role`, `preferred_contact_method`. But
`buildEnquiryNote()` concatenates all of it into free text on a Note. The referral form does
the same with `plan_type` in `buildReferralNote()`.

Consequences, in order of cost:

1. **It cannot reach ShiftCare.** The native HubSpot integration maps fields to fields. Text
   inside a note has nothing to map into, so language, plan type and gender-match preference
   are re-typed by a person on the day someone becomes a client.
2. **It cannot be counted.** "How many enquiries needed a Dari speaker last quarter" is
   unanswerable, so the recruitment signal never surfaces.
3. **It cannot drive automation.** No workflow, alert or SLA timer can read inside a note.

The fix is not to remove the note — narrative context is worth keeping — but to *also* write
each value to the contact property named in section 1. Same submission, both destinations.

### Gap 2 — the endpoint is open to the internet with no abuse protection

`Access-Control-Allow-Origin: '*'` with no origin allowlist, no rate limit, and no honeypot
or CAPTCHA. Any party can POST to it and create a Contact, Deal, Note and HIGH-priority Task
in the live CRM.

The failure mode is specific and bad: a flood of fake enquiries buries real ones in the task
queue, and the **2 business hour** response promise breaks precisely when someone cannot tell
the real enquiries from the noise. It also pollutes the CRM with records that must then be
cleaned out by hand.

Suggested mitigations, cheapest first: restrict the CORS origin to the site's own domain, add
a hidden honeypot field rejected server-side, add per-IP rate limiting, and consider Cloudflare
Turnstile if abuse actually appears. None of these change the participant's experience.

### Pipeline stages already in use

The endpoint hard-codes stage IDs, so a pipeline exists with at least these stages:

**[verified against live HubSpot, 18 Aug 2026]** All three hard-coded IDs are correct. Full
stage list read from the live `dealstage` property:

**Participant / Lead Pipeline** — `pipeline: 'default'`, the one the endpoint writes to:

| Stage | ID | Used by code |
|---|---|---|
| New Enquiry | `3607635399` | `NEW_ENQUIRY_STAGE_ID` ✅ |
| Contact Attempted | `3607504320` | |
| Qualified | `3607504321` | |
| Initial Consultation | `3607504322` | |
| Service Fit Confirmed | `3607504323` | |
| Service Agreement Sent | `3607504324` | |
| Participant Onboarded | `3607504325` | `CLOSED_STAGE_IDS` ✅ |
| Lost / Not Suitable | `3607504326` | `CLOSED_STAGE_IDS` ✅ |

**Referral Partner Pipeline** — `2087843269`:

| Stage | ID |
|---|---|
| Identified | `3611296211` |
| Contacted | `3611296212` |
| Conversation Started | `3611296213` |
| Meeting / Introduction | `3611296214` |
| Active Referral Partner | `3611296215` |
| Referral Received | `3611296216` |

The properties API returns one flat list, so the *split* between the two pipelines is inferred
from the ID blocks and stage names. The three IDs the endpoint depends on are confirmed
directly.

The live pipeline has **eight** stages, not the nine proposed in section 2, and the names
differ. Section 2 remains a target shape — see the warning below before acting on it.

**The nine stages proposed in section 2 are a target shape, not an instruction to rebuild.**
The live pipeline must be read from HubSpot first. Stage IDs are hard-coded in production
code, so rebuilding a pipeline regenerates those IDs and breaks the endpoint silently — every
submission would fail after the change, with no error visible to the person submitting.

---

## 1. Contact properties

Custom properties to create on the Contact object. Types are HubSpot field types.

### Language and communication

| Property | Type | Options |
|---|---|---|
| `primary_language` | Dropdown | English · Arabic · Somali · Dari · Amharic · Other |
| `primary_language_other` | Single-line text | Free text, only when `primary_language` = Other |
| `interpreter_required` | Dropdown | No · Yes · Unknown |
| `gender_matched_worker` | Dropdown | No preference · Female worker required · Male worker required |

`primary_language` drives the acknowledgement email language and the worker match. It is the
single most important custom field on this list — it is the business's reason to exist
expressed as data.

### NDIS plan

| Property | Type | Options |
|---|---|---|
| `ndis_plan_status` | Dropdown | Active plan · Plan pending · No plan or unsure · Not an NDIS participant |
| `plan_management_type` | Dropdown | Agency-managed · Plan-managed · Self-managed · Unknown |
| `ndis_plan_end_date` | Date picker | — |
| `service_lines_required` | Multiple checkboxes | Support Coordination · Core Supports & Daily Living · Community Participation · Therapy Services |

Do **not** store the NDIS participant number in HubSpot unless there is a decided, documented
reason. It is a strong identifier and increases the harm if the CRM is ever exposed.

`ndis_plan_end_date` exists so plans nearing expiry can be surfaced before funding lapses.

### Who is actually enquiring

| Property | Type | Options |
|---|---|---|
| `enquirer_relationship` | Dropdown | Participant themselves · Family member · Carer · Plan nominee · Guardian or legal decision-maker · Support coordinator · LAC · Health professional · Other |
| `authority_to_act` | Dropdown | Participant · Plan nominee · Guardian or legal decision-maker · Not yet established |

These two carry real privacy weight. Correspondence frequently goes to a parent, carer or
nominee rather than the participant, and sending participant information to someone without
authority is a disclosure breach. Capturing it as a field means it is visible at a glance
rather than inferred from whoever happened to send the email.

### Location and service footprint

| Property | Type | Options |
|---|---|---|
| `service_suburb` | Single-line text | — |
| `service_region` | Dropdown | Logan · Brisbane · Other South East Queensland · NSW · VIC · WA · Other |

`service_region` guards the footprint distinction in `CLAUDE.md`: hands-on supports are
South East Queensland only, while Support Coordination reaches NSW, VIC and WA. A record with
`service_region` = VIC and `service_lines_required` including Core Supports is a
contradiction, and should be caught rather than quietly accepted.

### Enquiry handling and the response promise

| Property | Type | Options |
|---|---|---|
| `enquiry_type` | Dropdown | New enquiry · Referral · Complaint · Feedback · General question |
| `enquiry_received_at` | Date and time | Set by the form or n8n, never by hand |
| `first_response_at` | Date and time | Set when the acknowledgement sends |
| `referral_source_detail` | Single-line text | Named referrer or organisation |

`enquiry_received_at` and `first_response_at` are what make the **2 business hour** promise
measurable. Without both timestamps the claim on the website cannot be verified, only
asserted. These should be written by automation, not typed, or the measurement is worthless.

Business-hours elapsed time is a calculation, not a stored field — compute it at report time
against Queensland business hours and public holidays. Do not store a "response time" number
that will silently go stale.

---

## 2. Deal pipeline — NDIS Participant Intake

One pipeline, nine stages, mirroring the enquiry-to-signature journey.

| # | Stage | Exit condition |
|---|---|---|
| 1 | New enquiry | Logged with source captured |
| 2 | Acknowledged | Reply sent, `first_response_at` set |
| 3 | Triage and capacity check | Can we actually serve this person? |
| 4 | Intake conversation booked | Date confirmed |
| 5 | Intake conversation held | Goals and supports understood |
| 6 | Schedule of supports proposed | Offer sent in writing |
| 7 | Service agreement sent | Awaiting signature |
| 8 | **Signed** | Agreement and consents executed |
| 9 | Activated | Worker introduced, first shift booked (closed won) |

**Stage 8 is the integration trigger.** ShiftCare's native HubSpot integration creates the
client record when a deal reaches a nominated stage. Fire it on *Signed*, not earlier —
ShiftCare is the service and clinical record, and prospects who never sign do not belong in
it. The welcome pack automation hangs off the same stage change.

### Lost reasons

A structured dropdown, not free text. This is a management report disguised as a form field.

- Outside service area
- No capacity
- **No language match available**
- **No gender-matched worker available**
- No active NDIS plan
- Plan funding insufficient or exhausted
- Chose another provider
- Participant withdrew
- Referred elsewhere as more appropriate
- No response after follow-up

The two bolded reasons are recruitment signals. "No Dari-speaking worker available" appearing
eleven times in a quarter is a hiring decision, and it is invisible unless it is a field.

---

## 3. Ticket pipelines

Complaints and feedback are **not** deals. They need their own pipelines, their own clocks,
and in the case of complaints, their own evidence trail.

### 3a. Complaints

| Stage | Meaning |
|---|---|
| Received | Logged |
| Acknowledged | Receipt confirmed to the complainant |
| Under investigation | Being worked |
| Resolution proposed | Outcome offered |
| Closed | Resolved and recorded |

Suggested properties: `complaint_category`, `complaint_severity`,
`complaint_received_at`, `acknowledgement_due`, `resolution_due`,
`ndis_commission_reportable` (Yes / No / Under review), `advocate_involved`.

> **Compliance gate.** The acknowledgement and resolution timeframes, the severity
> definitions, and the criteria for what is reportable to the NDIS Commission must come from
> H&W's approved complaints policy and current NDIS requirements. They are deliberately left
> blank here. Per `CLAUDE.md`, compliance wording is reviewed by a human, not generated.

This pipeline carries the most regulatory weight of anything in this spec. It is also the one
currently living in Gmail labels, which is a fragile home for evidence you may need to
produce at audit.

### 3b. Feedback

| Stage | Meaning |
|---|---|
| Received | Logged |
| Acknowledged | Thanked |
| Actioned or noted | Fed into improvement work |
| Closed | — |

Keep feedback separate from complaints. Merging them makes both numbers meaningless, and a
complaint mislabelled as feedback loses its clock.

---

## 4. What must not go in HubSpot

- **No clinical detail** beyond what service matching genuinely requires. HubSpot is a sales
  and communication record. Care documentation belongs in ShiftCare.
- **No NDIS participant numbers** without a documented decision to hold them.
- **Nothing from HubSpot goes into the git repository.** The repo is public — anything
  committed is world-readable and permanent in git history. Only aggregate, non-identifying
  counts may cross, as recorded in `CLAUDE.md`.

---

## 5. Build order

1. **Read the live pipelines from HubSpot** before proposing any stage change. Stage IDs are
   hard-coded in `api/hubspot-submit.js`; rebuilding a pipeline breaks it silently.
2. **Lock down the endpoint** (Gap 2). It is live and unprotected today, and this is the only
   item on the list that gets worse the longer it waits.
3. Create the contact properties in section 1.
4. Update `api/hubspot-submit.js` to write those properties alongside the note (Gap 1).
5. Deal pipeline reconciliation, including structured lost reasons.
6. Ticket pipelines. Complaints first; it carries the compliance obligation.
7. Confirm the ShiftCare integration fires on the signed stage and that the field mapping
   covers language, gender-match, plan type, region and authority to act.
8. Only then extend into the wider n8n automations.

Step 4 is the one most likely to be skipped and most expensive to skip. An unmapped field is
re-typed by a person on the day someone becomes a client — which is exactly the day nobody
has spare time.

---

## Open questions

Not yet answered, and each changes part of this spec:

- Whether transactional email will send from the confirmed domain rather than the Gmail
  address; without SPF/DKIM/DMARC on `thehealthwellbeinghub.com`, acknowledgements can land in
  spam and the 2-hour promise breaks invisibly
- Team size — decides whether any per-seat pricing is affordable
- Whether NDIS participant numbers are to be stored at all
- Approved complaint timeframes and Commission reportability criteria
