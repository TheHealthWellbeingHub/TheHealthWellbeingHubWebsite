# Workflow build notes

The technical half of the workflow register, moved here on 24 Aug 2026.

`docs/workflows-overview.html` is read by the team, so it now carries plain language
only — what a workflow does, how it starts, and what to be careful about. Filenames,
property names, reference formats, endpoint behaviour and outstanding build tasks are
all real and all still needed; they just are not the team's problem, and leaving them
on a page written for support workers made it harder to read for no gain.

Statuses live on the register, not here — one source, so they cannot disagree.

---

## Standard: a rendered preview before every Claude-sent email

**Decided 24 August 2026, applies everywhere, not just to one workflow.** "Claude
confirms before it sends" used to mean a text read-back — participant, referrer,
reference. From here on it also means a **rendered preview image** of the actual
email: subject line, body as it will actually look, and every attachment — shown to
the worker before the send happens, not described in words.

Applies to every email Claude sends itself, from the H&W mailbox, on request: workflow
01's outcome step (templates 10, 11, 13), workflow 03 (the Consent and Welcome
emails), workflow 05 (support worker introduction), workflow 06 (appointment
confirmation), and workflow 08 once it exists. Does **not** apply to templates 02 and
03 — those send automatically from a live HubSpot workflow the moment a form is
submitted, with no Claude-in-the-loop moment to show anything before it goes.

Individual workflow sections below don't repeat this in full — they note "preview,
then send" and mean this.

---

## 01 — Referral received

| | |
|---|---|
| Channels | Website form · direct email · phone, text and in person |
| Endpoint | `api/hubspot-submit.js`, `form_name: "referral"` / `"staff_referral"` |
| Staff form | `/staff/<token>/`, unlisted and noindexed |
| Email | `02-referral-received.html` — sending |
| Outcome emails | `10-referral-outcome-considering.html`, `11-referral-outcome-declined.html`, `13-referral-outcome-going-ahead.html` |
| Reference | `REF-<year>-<dealId>` |
| Spec | `docs/workflow-01-referral.md` |
| Deal properties | `referral_outcome`, `referral_outcome_date`, `dealstage` (branches by outcome — see below) |
| Contact properties | `referral_channel`, `referral_taken_by`, `consent_capture_method` |

**Deal stage by outcome, decided 24 August 2026** — Participant / Lead Pipeline (`default`):

| Outcome | `dealstage` |
|---|---|
| Going ahead | `Service Agreement Sent` (`3607504324`) — active, not yet onboarded |
| Wants time to think | unchanged — nothing has been decided |
| Said no | `Lost / Not Suitable` (`3607504326`) |

`Lost / Not Suitable` is reserved for that one outcome and for a service being
cancelled later (workflow 08) — never for a yes. Replaces an earlier version of this
spec that moved every outcome to `Lost / Not Suitable`, going ahead included; that was
wrong and is corrected here and in `docs/workflow-01-referral-journey.html`. The deal
stays at `Service Agreement Sent` until the forms come back — see workflow 03 for the
next stage, `Participant Onboarded`.

**Still open:**

- **Endpoint hardening** — CORS origin allowlist, honeypot and rate limiting were
  specified in the build order and only partly landed. Rate limiting is in (5 per 10
  minutes public, 40 for staff); the allowlist and honeypot need checking against the
  spec.
- **Duplicate-contact behaviour.** `upsertContact` dedupes on email *or* phone. The
  referrer-detail guard fixed the case where one person's detail was written onto
  another, but a participant referred with no contact detail at all still creates a
  fresh contact on every submission. Worth deciding whether that matters.

## 02 — New enquiry acknowledgement

| | |
|---|---|
| Trigger | Enquiry form on `/` and `/contact/` |
| Email | `03-new-enquiry-acknowledgement.html` · HubSpot object `709156560372` |
| Reference | `ENQ-<year>-<dealId>` |
| Spec | `docs/workflow-02-enquiry.md` |

**Still open:** copy has never been reviewed; inbox placement unconfirmed;
`first_response_at` is not stamped, because the webhook action that would report an
actual send does not exist on Starter.

## 03 — New participant

Spec: [`docs/workflow-03-new-participant.md`](workflow-03-new-participant.md).

Two emails now, not one — named for what each one does, not for the order they fire in:

| | |
|---|---|
| The Consent email | `04-participant-welcome-onboarding.html` — attaches `The Health & Well-being Hub - Referral Form (Fillable).pdf` (53 fields) and `NDIS Consent for Your Information (Fillable).pdf` (20 fields, overlaid on the NDIA's own unaltered form) |
| The Welcome email | `12-welcome-pack.html` — attaches the four easy-read policy guides (privacy, feedback, rights, incident management), unchanged from what was supplied |

**The two attachments on the Consent email are fixed, not optional.** Every send carries
both the referral form and the consent form — there is no version of this email that goes
out with only one, or with neither. Recorded here because it is a decision, not an
accident of how the first draft happened to be built.

No trigger for either. A participant becomes a participant when a service agreement is
signed, which is a **deal stage change**, and Starter cannot trigger on those; stage 2
starts when the forms come back, which isn't a HubSpot event at all. Both can run the
way workflow 01's outcome step does — sent from the H&W mailbox on request rather than
through a HubSpot workflow.

**Dry-run walkthrough, 24 August 2026.** A fictional referral (Jacob, a GP, referring a
participant by text) run end to end: staff intake link → outcome step (confirm, then
write) → Consent email (confirm, then send, both attachments) → forms marked back →
Welcome email (confirm, then send). No HubSpot writes and no real email sent — Sabrina
was never a CRM record — but the mechanics match workflow 01's proven pattern exactly,
so the confirm-before-send behaviour is not new code, just the existing pattern reused.

**Two things this surfaced — both resolved 24 August 2026:**

1. **No referrer notification for "going ahead."** Confirmed against the actual template
   library: 10 and 11 existed, there was no third. Fixed by building
   `13-referral-outcome-going-ahead.html`, matching 10 and 11's structure exactly. Now
   part of workflow 01's outcome step, not workflow 03 — the referrer hears about it the
   same day as the call, before either of workflow 03's two emails go anywhere.
2. **The deal-stage question.** Was a real bug, not a documentation error: the spec had
   every outcome moving the deal to *Lost / Not Suitable*, going ahead included. Checked
   the actual pipeline (`Participant / Lead Pipeline`) and corrected it — see workflow
   01's deal-stage table above. A yes now moves the deal to *Service Agreement Sent*;
   *Lost / Not Suitable* is reserved for a no or a later cancellation.

**The rest of the deal-stage path, decided 24 August 2026:** `Service Agreement Sent`
holds for as long as the forms are outstanding. The moment they come back — the same
moment that triggers the Welcome email — the deal moves to `Participant Onboarded`
(`3607504325`). One event, two things happen: the email sends and the stage advances.
Not automatic yet, same as everything else in this workflow — whoever tells Claude the
forms are back is telling it both things at once.

**What the forms add to HubSpot, decided 24 August 2026.** The referral and consent
forms carry roughly 70 fields between them, and none of it was mapped onto individual
HubSpot properties — that was never built and is not planned. Instead, when the forms
come back, Claude reads what is on them and writes it as a note: the participant's
details (NDIS number, DOB, plan information, emergency contacts, all of it) on the
participant's own contact record, and anything specific to the referrer on theirs. Same
habit as the outcome step's note, just fuller, and on whichever contact the information
actually belongs to.

**Three more edges, decided 24 August 2026 — all handled by a person, not a feature:**

1. **A partial return** — only one of the two forms comes back. No system handling for
   this and none is planned. Staff reply to the participant's email and get the missing
   one before telling Claude the forms are back. "Forms are back" stays a single event
   that only ever means both.
2. **A change of mind after going ahead.** If a participant backs out after the Consent
   email has gone out but before the Welcome email, it is treated exactly like a decline
   at the first call: the deal moves to `Lost / Not Suitable`, and the referrer is told.
   No new template — `11-referral-outcome-declined.html` already says the right thing
   regardless of when the decline happens, so it is reused rather than duplicated.
3. **No automatic follow-up if the forms never come back.** Also not a system feature.
   Instead, when the Consent email sends, Claude leaves a note on the deal as a reminder
   for staff to follow up — the same record-keeping habit as the outcome step's note,
   applied one step earlier.

**The trigger mechanism, decided 24 August 2026: stays "tell Claude," permanently.**
Not a placeholder waiting on HubSpot Starter to grow a feature — the same deliberate
design as workflow 01's outcome step, chosen on purpose rather than defaulted into.
Applies to 04, 05 and 08 too; none of them need this question asked again.

**Next:** get 04, 12 and 13 through compliance review, then run it once for real.

## 04 — Maintaining participants

**Redefined 24 August 2026 — on-request CRM maintenance, not a scheduled campaign.**
Every earlier reading (plan review reminders, periodic check-ins, agreement renewals,
re-contacting quiet participants) assumed a recurring, calendar-driven workflow. Dropped
in favour of something simpler: a worker asks Claude to create, look up, or update a
participant's or referrer's HubSpot record, and Claude does it — the same "tell Claude"
trigger as workflow 03, on request rather than on a schedule. No template, no email,
nothing to build in HubSpot — this workflow *is* the ask.

**What's actually available, checked against the real tools:**

| Operation | Possible? |
|---|---|
| Create | Yes — `manage_crm_objects`, create request |
| Get / search | Yes — `search_crm_objects` / `get_crm_objects` |
| Update | Yes — `manage_crm_objects`, update request |
| Delete | **No delete or archive tool exists.** Handled as a soft delete instead: a participant's deal moves to `Lost / Not Suitable`; a referrer's contact is marked inactive. |

Every create and update carries HubSpot's own mandatory confirmation — a table of what's
changing, old value to new, before anything writes. Not built for this workflow
specifically; it's how the tool already behaves, and it happens to match the
confirm-before-write habit used everywhere else in this document.

**Proof so far:** a real search has already run this session — `CONTACT`/`DEAL` for
"Sabrina," correctly returning nothing, since she was never a real record. Create and
update have not been exercised for real yet.

**Next:** none, design-wise. Use it, and see what comes up.

## 05 — Support worker introduction

**Redefined 24 August 2026 — asked fresh each time, not stored.** The original blocker
was "no support worker records in the CRM." Rather than deciding how to model support
workers in HubSpot, that question is dropped: nothing is stored, and nothing needs to
be. Email `06-support-worker-introduction.html` is filled from what the worker tells
Claude in the moment, the same "tell Claude" pattern as 03 and 04.

**Trigger:** *"Send the support worker introduction email to [Participant]."*

**Step 1 — Claude asks for exactly what the template needs, nothing more.** Of the
template's merge fields, `{{Participant First Name}}` is already known from the trigger
itself, and `{{Phone Number}}` / `{{unsubscribe_url}}` are constants, not questions. What
actually gets asked:

| Asked | Template token |
|---|---|
| Worker's first name | `{{Worker First Name}}` |
| Worker's full name | `{{Worker Full Name}}` |
| Support type | `{{Support Type}}` |
| Role | `{{Role}}` |
| Relevant experience | `{{Experience}}` |
| Languages | `{{Languages}}` |
| Interests or skills | `{{Interests or Skills}}` |
| First scheduled support — date | `{{Date}}` |
| First scheduled support — start / end time | `{{Start Time}}` / `{{End Time}}` |
| First scheduled support — location | `{{Location}}` |
| Planned support details | `{{Support Details}}` |
| Coordinator or manager to contact | `{{Coordinator or Manager}}` |

**Step 2 — confirm, then send.** Same habit as every other trigger in this document:
Claude reads back what it collected — worker, participant, first appointment — and
shows a rendered preview of the actual email before it leaves the building.

**Step 3 — a note on the participant's contact**, recording who was introduced and
when, the same reasoning as workflow 03's forms-back note: nothing here is stored as
structured data, so the note is the only record that this introduction happened at
all. Confirmed with the user 24 August 2026 — keep doing this by default going forward
wherever a workflow writes nothing structured but something still happened.

**Next:** none, design-wise. Build status: content exists (email 06), nothing else to
build — same shape as workflow 04.

## 06 — Appointment confirmation

**Redefined 24 August 2026 — asked fresh each time, not read from a calendar.** The
original assumption was that Google Calendar, since it's connected, is the natural
source. Dropped, without confirming where appointments are actually booked today — same
move as 04 and 05: don't build a dependency on a system when asking directly is simpler
and needs no answer about where bookings currently live.

**Trigger:** *"Set an appointment with [Participant]."*

**Step 1 — Claude asks for exactly what the template needs.** `{{First Name}}` is
already known from the trigger; `{{Email Address}}` and `{{unsubscribe_url}}` are
constants. What actually gets asked:

| Asked | Template token |
|---|---|
| Service | `{{Service}}` |
| Appointment date | `{{Appointment Date}}` |
| Start / end time | `{{Start Time}}` / `{{End Time}}` |
| Duration | `{{Duration}}` |
| Worker or practitioner | `{{Staff Member}}` |
| Address or online meeting details | `{{Address / Online Meeting Details}}` |
| Preparation instructions, if any | `{{Preparation Instructions}}` |

**Step 2 — preview, then send.** See the standard above: a rendered preview of the
actual email, shown before it goes.

**Step 3 — a note on the participant's contact**, same default as workflow 05: nothing
here is stored as structured data, so the note is the record that the appointment was
confirmed and what was in the email.

**Next:** none, design-wise. Build status: content exists (email 05), nothing else to
build — same shape as 04 and 05.

## 07 — Complaint acknowledgement

Email `08-complaint-acknowledgement.html`. `/complaints-feedback/` is a static page
with **no form**, so nothing captures a complaint. Of the not-started workflows this is
the one that is genuinely ready to build — it mirrors the enquiry path exactly.

**Next:** build the form and route it through the existing endpoint as a third
`form_name`. Feedback acknowledgement (`07-feedback-acknowledgement.html`) comes
almost free once the form exists.

## 08 — Service cancellation and exit

Email `09-service-cancellation-exit.html`. The trigger question is answered — prompted,
not automated, per workflow 03's decision — and the deal-stage side of a cancellation
is also already settled there: `Lost / Not Suitable`, the same as a participant who
never went ahead. What is still open is the email itself: sensitive wording that needs
compliance review before it goes near a participant who is leaving.

**Next:** write the spec, then get the wording reviewed.

---

## The constraint behind most of these

HubSpot Starter allows **one simple workflow per form**, triggered by form submission
only — ten actions, no branching, no webhooks. Three of the eight (03, 05, 08) have no
form behind the email they need to send, so each needs either a new form or automation
outside HubSpot. Workflow 01's outcome step took the second route: it sends from the
H&W mailbox, because no HubSpot workflow can fire on a deal reaching a closed stage.
Workflow 04 no longer belongs on this list — redefined 24 August 2026 as on-request CRM
maintenance, it sends nothing and has no form to be missing.
