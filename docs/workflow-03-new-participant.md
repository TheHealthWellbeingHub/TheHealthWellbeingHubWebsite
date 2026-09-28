# Workflow 03 — New participant

Not built the way [`workflow-01-referral.md`](workflow-01-referral.md) and
[`workflow-02-enquiry.md`](workflow-02-enquiry.md) are, and that is a decision, not a
gap. Both of those enrol through a HubSpot form and a HubSpot workflow. This one has no
form behind it — a participant agreeing to go ahead, and forms coming back, are not
things a HubSpot Starter workflow can trigger on — so there is no workflow to configure.
Everything below is a **procedure Claude follows when a worker says the trigger phrase**,
the same shape as workflow 01's outcome step, decided on purpose on 24 August 2026 rather
than left as a placeholder waiting for Starter to grow a feature.

| | |
|---|---|
| Trigger 1 | Worker says the participant is going ahead and wants the forms sent |
| Trigger 2 | Worker says the forms are back |
| Email 1 | **The Consent email** — `04-participant-welcome-onboarding.html` |
| Email 2 | **The Welcome email** — `12-welcome-pack.html` |
| Reference | Same deal as workflow 01 created — no new reference format |
| Pipeline | Participant / Lead Pipeline (`default`) |
| Deal properties touched | `dealstage` only — no new custom properties |

## Current — the Command Centre's onboarding page, updated 28 Sep 2026

HubSpot is retired and most of this file below is historical. The email this file calls
"the Consent email" is now called **the Onboarding email** (renamed 28 Sep 2026) — same
template 04, same three attachments (`template: "consent"` in the sender is only its internal
key). Workflow 03 runs from the Command Centre's onboarding page,
`/dashboard/leads/<id>/onboarding`.

### Triggers

| # | Trigger | What happens |
|---|---|---|
| 1 | Record outcome → **Going ahead**, on a referral (workflow 01) or an enquiry (workflow 02) | Stage `Service Agreement Sent`, task *Send Onboarding email & forms* due in 1 day, and staff land on the onboarding page |
| 2 | A worker opens it: the referral's card (**Open onboarding**), the *Send Onboarding email* / chase / *Send Welcome pack* task buttons, or the referrer's page | Same page |
| 3 | **A worker tells Claude to start onboarding a new participant**, and gives Claude the details | See "Trigger 3 — Claude" below |

### The three steps

1. **Onboarding email** — template 04 with all three PDFs (Referral Form, NDIS Consent form,
   Service Agreement), previewed then sent through `api/send-participant-email.js`
   (`template: "consent"`) from `/dashboard/leads/<id>/onboarding/email`. **Sent to the
   participant's email; if we only have a phone for them, the referrer's** (decided 25 Sep
   2026); staff can change the address. Records `leads.consent_email_sent_at` /
   `consent_email_to` / the H&W contact, closes the *Send Onboarding email* task and raises a
   7-day pending *Chase onboarding forms if not back*. A resend replaces the chase-up. "Sent it
   another way" records the step without sending.
2. **Forms back** — staff tick which of the Referral Form, NDIS Consent form and signed
   Service Agreement arrived (`leads.forms_received`). **Partial:** a chase for what's missing
   (3 days) replaces any earlier chase. **All three:** "Send Welcome pack" task.
3. **Welcome pack and participant** — locked until all three forms are in. **The participant
   is created automatically** (decided 25 Sep 2026) in ShiftCare — through
   `api/shiftcare-clients.js`, since the Command Centre holds no ShiftCare credentials — and in
   the Supabase `participants` table, from the details on the returned forms (first name and
   date of birth required). A participant with the same NDIS number, or the same name and date
   of birth, is linked instead of duplicated. Then template 12 with the four guides, the
   referral is linked (`leads.participant_id`), every task closes and the stage becomes
   Participant Onboarded. If ShiftCare refuses, nothing is sent; if the email fails after the
   participant was created, a retry won't create them twice.

### Trigger 3 — Claude

A worker says "start onboarding for <participant>" and gives the details. Claude:

1. **Collects what the Onboarding email needs**, asking only for what's missing: the
   participant's name and email or phone; who referred them, if anyone (name, email or phone,
   organisation, role); the service; their H&W contact and that person's role; proposed start,
   preferred schedule and location (`TBC` is fine for start and schedule).
2. **Finds the referral or enquiry** in Supabase `leads` — an open one (`stage` `new` or
   `service_agreement_sent`) for the same participant name, email or phone. If there is none,
   **logs it through `api/lead-submit.js`** — `form_name: "staff_referral"` when someone referred
   them, `"staff_enquiry"` otherwise, `referral_taken_by: "Claude"`, and
   `staff_consent_attested: "Yes"` only once the worker confirms the person was told how their
   details are used. Never a direct insert (see `CLAUDE.md`). That sends email 02 / 03 and
   saves the referrer, exactly as triggers 1–3 of workflows 01/02.
3. **Records Going ahead** if it isn't already at `service_agreement_sent` — the same writes as
   the outcome page's "Record without sending":

   ```sql
   begin;
   update tasks set status = 'done', completed_at = now()
     where lead_id = :lead_id and status in ('action_required', 'pending');
   update leads set stage = 'service_agreement_sent', stage_updated_at = now(), updated_at = now(),
     onboarding_staff_member = :staff_member, onboarding_staff_role = :staff_role
     where id = :lead_id;
   insert into tasks (subject, status, due_at, lead_id)
     values ('Send Onboarding email & forms — ' || :participant_name, 'action_required',
             now() + interval '1 day', :lead_id);
   insert into lead_notes (lead_id, body)
     values (:lead_id, 'Going ahead — recorded by Claude for <worker>. Referrer not emailed from here.');
   commit;
   ```
4. **Hands the worker one link** — the Onboarding email page, pre-filled:
   `https://hub-command-centre.vercel.app/dashboard/leads/<id>/onboarding/email?to=<address>&f:Participant First Name=…&f:Staff Member=…&f:Role=…&f:Service=…&f:Date=…&f:Schedule=…&f:Location=…`
   (URL-encoded). The worker checks the preview and presses **Send the Onboarding email** —
   Claude doesn't send it itself: the send token stays in Vercel, and a person approves every
   participant email. From there, steps 2 and 3 run on the onboarding page as normal.

---

Read workflow 01 first if the outcome step itself (the referrer notification, the initial
deal-stage move to `Service Agreement Sent`) is what's in question — that belongs there,
not here. This document starts from the moment a worker decides to send the participant
their own paperwork.

---

## Trigger 1 — "Send the Consent email"

Said after the outcome step has already recorded "going ahead." Confirm first, the same
way workflow 01's outcome step does — read back the participant's name and which deal,
and show a rendered preview of the email itself (subject, body, all three attachments listed)
— before anything leaves the building.

1. Fill the Consent email (`04-participant-welcome-onboarding.html`) with the participant
   and staff details.
2. Attach all three PDFs from `participant-documents/` — **always all three, never a subset**
   (the sender enforces this):
   - `The Health & Well-being Hub - Referral Form (Fillable).pdf` (53 fields)
   - `NDIS Consent for Your Information (Fillable).pdf` (20 fields, overlaid on the
     NDIA's own unaltered form — nothing in its content is ours to edit)
   - `The Health & Well-being Hub - Service Agreement (Fillable).pdf` (239 fields — the
     25 Sep 2026 wording, rebuilt as a branded fillable PDF on 25 Sep 2026)
3. Send from the H&W mailbox.
4. Leave a note on the deal: sent, date, and a reminder to follow up if nothing comes
   back. This is the only system response to "what if the forms never come back" — see
   workflow-build-notes.md §03 for why nothing more automatic was built.

Deal stage is already `Service Agreement Sent` from the outcome step and does not move
again here — it holds at that stage for as long as the forms are outstanding.

### Merge fields — the Consent email

| Template token | Source |
|---|---|
| `{{Participant First Name}}` | The participant |
| `{{Staff Member}}` | Whoever is named as the primary contact |
| `{{Role}}` | Their role, e.g. Support Coordinator |
| `{{Service}}` | The requested service from the referral |
| `{{Date}}` | Proposed start — `TBC` if not yet set |
| `{{Schedule}}` | Preferred schedule — `TBC` if not yet set |
| `{{Location}}` | Where support happens |

`{{Phone Number}}`, `{{Email Address}}` and the unsubscribe link are filled by
`api/send-participant-email` itself. Full field list for every template:
`docs/email-merge-fields.md`.

---

## Trigger 2 — "The forms are back"

Said once **all three** documents have actually returned — see "Edge cases" below for what
happens when only one has. One event, three things happen:

1. **Read the returned forms and write a note.** Everything on them — NDIS number, date
   of birth, plan management type, emergency contacts, nominee details, all of it — goes
   onto the **participant's** own contact record as a note. Nothing is mapped onto
   individual HubSpot properties; that was considered and deliberately not built. If
   anything on the forms concerns the referrer specifically, it goes as a note on the
   referrer's contact instead, not the participant's.
2. **Send the Welcome email** (`12-welcome-pack.html`), attaching the four easy-read
   guides from `participant-documents/` — Privacy & Confidentiality, Feedback &
   Complaints, Rights & Responsibilities, Incident Management — unchanged from what was
   supplied, because they were already on-brand and plain-language as received.
3. **Move the deal to `Participant Onboarded`.**

Confirm before sending, same as every other step here — read back who, which deal, and
that both documents are actually in hand, plus a rendered preview of the email and its
four attachments.

### Merge fields — the Welcome email

| Template token | Source |
|---|---|
| `{{Participant First Name}}` | The participant |
| `{{Staff Member}}` | Same primary contact as the Consent email |
| `{{Role}}` | Their role |

---

## Deal stage, start to finish

| Stage | `dealstage` ID | When |
|---|---|---|
| Service Agreement Sent | `3607504324` | Set by workflow 01's outcome step on "going ahead"; holds while forms are outstanding |
| Participant Onboarded | `3607504325` | Set here, the moment the forms come back |
| Lost / Not Suitable | `3607504326` | A decline at the outcome call, a change of mind before onboarding, or a service cancelled later (workflow 08) — never for a yes |

---

## Edge cases, decided 24 August 2026

**A partial return.** Only some of the three documents come back. Not a system case — staff
reply to the participant and ask for the rest before telling Claude the forms are
back. "Forms are back" only ever means all three; there is no partial version of trigger 2.

**A change of mind after going ahead.** The participant backs out after the Consent
email has gone but before the Welcome email. Treated exactly like a decline at the
outcome call: deal to `Lost / Not Suitable`, referrer told. No new template —
`11-referral-outcome-declined.html` already says the right thing regardless of when the
decline happens, so it is reused rather than duplicated.

**Nothing chasing outstanding forms.** No reminder, no timeout — the note left in
trigger 1 is the only system assist, and following it up is a person's job.

---

## Verification

**Live run, 25 August 2026 — proven end to end with a real send.** A test participant
(Bambang Durrani) went through the whole journey for real: outcome recorded as going
ahead, Consent email sent from `hello@` with both fillable PDFs attached (via
`api/send-participant-email`, built the same day precisely because attachments could
not be carried session-side), both forms returned and their full contents written as
a note on the participant's contact, Welcome email sent with all four guides
attached, deal moved to `Participant Onboarded`, referrer notified with template 13.
The run also exercised the safety checks for real: returned forms in a *different
person's name* were caught and refused before anything touched the record, and a
participant email misfiled on the referrer's contact was found and corrected. The
dry-run record below stands as the design history.

**Dry run only, 24 August 2026.** A fictional referral — Jacob, a GP, referring a
participant named Sabrina by text — walked all the way through: staff intake link,
outcome step, Consent email (confirm, then send, both attachments), forms marked back,
Welcome email (confirm, then send). No HubSpot writes and no real email sent, because
neither Jacob nor Sabrina is a CRM record. The mechanics match workflow 01's proven,
live-sent outcome step exactly, so the confirm-before-send behaviour here is the existing
pattern reused, not new code — but "matches a proven pattern" is not the same claim as
"has been proven." Nothing in this document has gone to a real participant yet.

---

## Open

- ~~**Compliance review.**~~ **Approved 25 August 2026.** Kholoud has reviewed 04
  (the Consent email) and 12 (the Welcome email) alongside 10, 11 and 13 — all five
  are now approved wording, not drafts. The one item this workflow's spec flagged
  for a human is closed.
- ~~**A live send.**~~ **Done, 25 August 2026** — see Verification above. Nothing on
  this workflow remains open.
