# Workflow 07 — Feedback and complaint acknowledgement

Built the same way workflows 01 and 02 are: a real form on the public site, posting through
the shared `api/hubspot-submit.js` endpoint, registering a genuine Forms API submission so a
HubSpot Starter simple workflow can enrol the contact and send the acknowledgement
automatically. No Claude-in-the-loop moment here — like 02 and 03's outcome-independent
sends, this fires the instant someone submits the form. It does **not** carry the
"rendered preview before every send" standard documented at the top of
[`workflow-build-notes.md`](workflow-build-notes.md); that standard is for emails Claude
composes and a worker confirms, and nobody is in that loop here.

| | |
|---|---|
| Page | `/complaints-feedback/` — previously informational only, now also carries the form |
| Form | `templates/partials/complaint_form.html`, one shared form, `submission_type` field picks Feedback or Complaint |
| `form_name` | `feedback_complaint` |
| Email — feedback | `07-feedback-acknowledgement.html` |
| Email — complaint | `08-complaint-acknowledgement.html` |
| Reference | `FB-<year>-<contactId>` or `CMP-<year>-<contactId>` — see "Why no deal" below |
| Pipeline | None — this workflow does not touch the Participant / Lead Pipeline |
| Built | 24 August 2026 |

---

## Why no deal

Every other form-triggered workflow (01, 02, and 03's own procedures) is a step toward someone
becoming, or already being, a participant, and each creates or reuses a deal in the
Participant / Lead Pipeline to represent that. Feedback and complaints are not that journey —
an existing participant, a family member, or someone with no relationship to H&W at all can
submit one, and none of those cases is "a new sales opportunity." Recording one as a pipeline
deal would misrepresent it in every pipeline report that counts deals.

So this path is deliberately narrower than 01/02: **Contact, Note, and follow-up Task only.**
The reference number is minted from the contact ID rather than a deal ID, because there is no
deal ID to use.

---

## The form

One page, one form, a `submission_type` select (`Feedback` / `Complaint`) decides everything
downstream — which HubSpot form GUID the Forms API submission targets, which merge properties
get written, and which template (07 or 08) the participant receives.

| Field | Required? | Notes |
|---|---|---|
| `submission_type` | Yes | `Feedback` or `Complaint` |
| `name` | Yes | |
| `phone` | No | |
| `email` | No | See "Anonymous submissions" below |
| `relates_to` | No | Feedback only, in practice — free-text category |
| `details` | Yes | What happened, in their own words |
| `response_wanted` | No, defaults to "Yes" in wording | Drives `{{Response Line}}` on the feedback email |
| `preferred_language` | No | Recorded, not yet acted on automatically |

## Anonymous submissions

Both `phone` and `email` are optional — an NDIS participant can raise a concern without
identifying themselves, which the NDIS Practice Standards expect to be possible. When neither
is given, the contact record is still created (name only) and the note says explicitly that
there is no way to reply. `acknowledgementStatus` comes back `"no_email"`, the same normal,
non-error outcome a phone-only enquiry already produces on workflow 02.

---

## What happens on submission

1. **Consent, honeypot, rate-limit, origin checks** — identical to every other form on this
   endpoint. `privacy_consent` is required.
2. **Contact upserted** — by email if given, else by phone, else a new contact is created.
   Nothing else in the endpoint's dedupe logic changes.
3. **Note written** on the contact — submission type, what it relates to, whether a reply was
   wanted, preferred language, and the full text of what they said. Flagged in the note if the
   submission is anonymous.
4. **Follow-up task raised** — `Reply to feedback: <name>` when a reply was requested,
   `Review feedback (no reply requested): <name>` when not, or `Investigate complaint: <name>`
   for a complaint. Complaints always raise a task; NDIS Practice Standards require every
   complaint to be looked into, whether or not the person wants a reply.
5. **Reference minted** — `FB-2026-<contactId>` or `CMP-2026-<contactId>`.
6. **Merge properties written**, then the **Forms API submission** registered — see
   `docs/hubspot-manual-setup.md` §"Workflow 07" for exactly which properties and which two
   HubSpot forms this depends on. Both are unbuilt as of this document; every submission today
   records correctly and raises an `ACKNOWLEDGE MANUALLY` task instead of silently doing
   nothing.

---

## Merge fields — the Feedback email (07)

| Template token | Source |
|---|---|
| `{{First Name}}` | The submitter |
| `{{Feedback Reference}}` | Minted reference |
| `{{Date Received}}` | Submission date, Brisbane |
| `{{Service / General Feedback}}` | `relates_to`, or "your feedback" if left blank |
| `{{Response Line}}` | Computed — see "Draft compliance sentence" below. Replaces the bracketed "Choose One" editorial note this template previously carried |
| `{{Staff Member}}` | Static text at HubSpot template-build time, not written by the endpoint — see `hubspot-manual-setup.md` |

## Merge fields — the Complaint email (08)

| Template token | Source |
|---|---|
| `{{First Name}}` | The submitter |
| `{{Brief Neutral Description}}` | The submitter's own words (`details`), capped to 300 characters — not paraphrased, so nothing is invented |
| `{{Complaint Reference}}` | Minted reference |
| `{{Date Received}}` | Submission date, Brisbane |
| `{{Update Date}}` | Computed — see "Draft compliance sentence" below |
| `{{Complaints Officer}}` / `{{Escalation Contact}}` | Static text at HubSpot template-build time — see `hubspot-manual-setup.md` |
| `{{Phone Number}}` | H&W's own number, bound the same way every other template's phone token is |

---

## Compliance sentence — approved 25 August 2026

Both `{{Response Line}}` and `{{Update Date}}` are computed as 5 Brisbane business days from
receipt. Kholoud has reviewed this alongside the rest of templates 07 and 08's wording and
confirmed it — it is now a real operational promise, not a placeholder, the same status as the
confirmed **2 business hour** enquiry response time in `CLAUDE.md`'s canonical facts table.
If the actual turnaround policy ever changes, `addBusinessDaysBrisbane`'s call site in
`api/hubspot-submit.js` (currently `5`) is the one place to update it.

---

## Edge cases, decided 24 August 2026

**No response requested on a complaint.** The form still asks `response_wanted`, but a
complaint always raises a follow-up task regardless of the answer — see step 4 above.
`response_wanted` only changes the wording used, never whether it gets looked into.

**The same person submits twice.** Unlike referral/enquiry, there is no deal to reuse, so
there is nothing to detect "is this a returning submission" against — each submission is its
own contact-note-task-reference, even from the same contact. Considered building
returning-submission detection and deliberately not: a second complaint from the same person is
not obviously the same complaint continuing, so guessing would risk merging two unrelated
concerns into one thread.

**A truly anonymous submission with no name.** The form requires a name, so this cannot happen
through the site today. The endpoint does not reject a blank name if it somehow arrived another
way — `upsertContact` degrades gracefully to a bare contact record — but this is currently
endpoint-reachable, not form-reachable, and not a case anyone has tested.

---

## Verification

**Live, proven end to end — 25 August 2026.** The full HubSpot side was built in a guided
session (both forms, all eight properties, the subscription type, both marketing emails, both
simple workflows) and both chains were then fired for real through the live site endpoint
with throwaway `@hwtest.example.com` contacts:

- **Feedback:** `FB-2026-347567754737` — contact + note + task created, all four
  `latest_feedback_*` properties written (response line quoted `01/09/2026`, correctly
  5 Brisbane business days from a Tuesday), Forms API enrolment
  (`hs_marketable_reason_type: FORM_SUBMISSION`), workflow fired, email 07 **SENT**
  (per-recipient analytics timeline).
- **Complaint:** `CMP-2026-347569619440` — same chain, all four `latest_complaint_*`
  properties written including the next-update-by date, email 08 **SENT**.

Delivery shows as bounced/pending only because the probe domain is fictional — the send is
the thing under test. One earlier diagnosis mirrored workflow 02's history exactly: a first
probe produced a correct record and `recipient: false` because the simple workflow's Send
email action had not been saved/turned on yet; the form's "Update" button publishes the
form, not the workflow.

Marketing-email writes through the connector are **still** refused (same lost scope as
19 Aug 2026) — both emails were built by cloning email 02 in the HubSpot UI and pasting the
paste-ready HTML blocks, the process workflow 02's doc records. Reads (`GET_CONTENT`,
`GET_EMAIL_DETAILS`, per-recipient analytics) worked throughout and were how every step was
verified.

---

## Open

- ~~**HubSpot side entirely unbuilt**~~ **Built and live, 25 August 2026** — see
  Verification above. Both form GUIDs are set in Vercel
  (`HUBSPOT_FEEDBACK_FORM_GUID`, `HUBSPOT_COMPLAINT_FORM_GUID`).
- ~~**Compliance review**~~ **Approved 25 August 2026** — see above.
- **A dedicated `complaints@` mailbox** — flagged in `hubspot-manual-setup.md` under "Naming
  convention" as the one address that should not share `hello@`'s mailbox, for retention and
  audit reasons. Not yet created.
- ~~**A live send**~~ **Done, 25 August 2026** — both emails sent for real (to test
  contacts). The next real participant submission is the first to a genuine inbox.
- **Cosmetic only:** email 07's body block sits inside the grey footer band rather than its
  own white section (the two colours are near-identical); email 08 is structured correctly.
  Fix whenever the email is next edited.
