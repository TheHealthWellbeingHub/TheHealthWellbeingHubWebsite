# Workflow build notes

The technical half of the workflow register, moved here on 24 Aug 2026.

`docs/workflows-overview.html` is read by the team, so it now carries plain language
only — what a workflow does, how it starts, and what to be careful about. Filenames,
property names, reference formats, endpoint behaviour and outstanding build tasks are
all real and all still needed; they just are not the team's problem, and leaving them
on a page written for support workers made it harder to read for no gain.

Statuses live on the register, not here — one source, so they cannot disagree.

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

**Next:** decide the trigger mechanism once, for all four. Then write the spec.

## 04 — Maintaining participants

No template, no spec, no trigger — the only one with nothing behind it, and the only
recurring one. Plan review reminders, periodic check-ins, agreement renewals and
re-contacting quiet participants are all plausible readings needing different data.

**Next:** define what it means before building anything.

## 05 — Support worker introduction

Email `06-support-worker-introduction.html`, which expects a worker's name and
details. **There are no support worker records in the CRM**, so the merge fields have
nothing to read.

**Next:** decide how support workers are represented in HubSpot first.

## 06 — Appointment confirmation

Email `05-appointment-confirmation.html`. No trigger. Google Calendar is connected, so
a calendar event is the natural source rather than a form.

**Next:** confirm where appointments are actually booked today before assuming that.

## 07 — Complaint acknowledgement

Email `08-complaint-acknowledgement.html`. `/complaints-feedback/` is a static page
with **no form**, so nothing captures a complaint. Of the not-started workflows this is
the one that is genuinely ready to build — it mirrors the enquiry path exactly.

**Next:** build the form and route it through the existing endpoint as a third
`form_name`. Feedback acknowledgement (`07-feedback-acknowledgement.html`) comes
almost free once the form exists.

## 08 — Service cancellation and exit

Email `09-service-cancellation-exit.html`. Same deal-stage problem as 03.

**Next:** decide automated versus prompted, then follow whatever 03 settles.

---

## The constraint behind most of these

HubSpot Starter allows **one simple workflow per form**, triggered by form submission
only — ten actions, no branching, no webhooks. Four of the eight have no form behind
them, so each needs either a new form or automation outside HubSpot. Workflow 01's
outcome step took the second route: it sends from the H&W mailbox, because no HubSpot
workflow can fire on a deal reaching a closed stage.
