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

Read workflow 01 first if the outcome step itself (the referrer notification, the initial
deal-stage move to `Service Agreement Sent`) is what's in question — that belongs there,
not here. This document starts from the moment a worker decides to send the participant
their own paperwork.

---

## Trigger 1 — "Send the Consent email"

Said after the outcome step has already recorded "going ahead." Confirm first, the same
way workflow 01's outcome step does — read back the participant's name and which deal,
and show a rendered preview of the email itself (subject, body, both attachments listed)
— before anything leaves the building.

1. Fill the Consent email (`04-participant-welcome-onboarding.html`) with the participant
   and staff details.
2. Attach both PDFs — **always both, never one**:
   - `The Health & Well-being Hub - Referral Form (Fillable).pdf` (53 fields)
   - `NDIS Consent for Your Information (Fillable).pdf` (20 fields, overlaid on the
     NDIA's own unaltered form — nothing in its content is ours to edit)
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
| `{{Phone Number}}` / `{{Email Address}}` | H&W's own contact details, not the participant's |
| `{{unsubscribe_url}}` | Resolved by HubSpot when this is actually sent through it; a literal `#` in a dry run |

---

## Trigger 2 — "The forms are back"

Said once **both** documents have actually returned — see "Edge cases" below for what
happens when only one has. One event, three things happen:

1. **Read the returned forms and write a note.** Everything on them — NDIS number, date
   of birth, plan management type, emergency contacts, nominee details, all of it — goes
   onto the **participant's** own contact record as a note. Nothing is mapped onto
   individual HubSpot properties; that was considered and deliberately not built. If
   anything on the forms concerns the referrer specifically, it goes as a note on the
   referrer's contact instead, not the participant's.
2. **Send the Welcome email** (`12-welcome-pack.html`), attaching the four easy-read
   guides — Privacy & Confidentiality, Feedback & Complaints, Rights & Responsibilities,
   Incident Management — unchanged from what was supplied, because they were already
   on-brand and plain-language as received.
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
| `{{Phone Number}}` / `{{Email Address}}` | H&W's own contact details |
| `{{unsubscribe_url}}` | As above |

---

## Deal stage, start to finish

| Stage | `dealstage` ID | When |
|---|---|---|
| Service Agreement Sent | `3607504324` | Set by workflow 01's outcome step on "going ahead"; holds while forms are outstanding |
| Participant Onboarded | `3607504325` | Set here, the moment the forms come back |
| Lost / Not Suitable | `3607504326` | A decline at the outcome call, a change of mind before onboarding, or a service cancelled later (workflow 08) — never for a yes |

---

## Edge cases, decided 24 August 2026

**A partial return.** Only one of the two forms comes back. Not a system case — staff
reply to the participant and ask for the other one before telling Claude the forms are
back. "Forms are back" only ever means both; there is no partial version of trigger 2.

**A change of mind after going ahead.** The participant backs out after the Consent
email has gone but before the Welcome email. Treated exactly like a decline at the
outcome call: deal to `Lost / Not Suitable`, referrer told. No new template —
`11-referral-outcome-declined.html` already says the right thing regardless of when the
decline happens, so it is reused rather than duplicated.

**Nothing chasing outstanding forms.** No reminder, no timeout — the note left in
trigger 1 is the only system assist, and following it up is a person's job.

---

## Verification

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

- **Compliance review.** Templates 10 and 11 carry a note that their wording is approved.
  04, 12 and 13 do not — they are drafted, not reviewed. Per `CLAUDE.md`, "Compliance
  wording is reviewed, not generated." This is the one item on this workflow that only a
  human can close.
- **A live send.** Everything here is proven by dry run and by workflow 01's precedent,
  not by an actual send to an actual participant. Worth doing once, deliberately, before
  trusting this at volume.
