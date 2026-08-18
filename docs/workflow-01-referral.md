# Workflow 01 — Refer an NDIS participant

What happens when the referral form at `/referrals/` is submitted.

Schema decisions marked **[confirmed]** were made by the user. Fields marked **[blank]** are
deliberately undecided — they are known gaps, held open until the user specifies them. Claude
should not invent values for them.

Business facts: [`../CLAUDE.md`](../CLAUDE.md). Property definitions:
[`hubspot-configuration.md`](hubspot-configuration.md).

**Status:** specification. Not yet built.

---

## Trigger

`referrals/index.html` → `<form data-form-name="referral">` → `static/js/main.js`
(`FORM_ENDPOINT = '/api/hubspot-submit'`) → `api/hubspot-submit.js`.

Because this form is only ever used by a third party referring someone else, several values
are **constants, not inputs**. They are set server-side from `form_name === 'referral'` and
are never read from the request body — a client cannot override them.

---

## Schema

### A. Referrer → Contact

| Field | Source | Property | Value |
|---|---|---|---|
| Name | form, required | `firstname` / `lastname` | as entered |
| Organisation | form | `company` | as entered |
| Phone | form, required | `phone` | as entered |
| Email | form, required | `email` | as entered |
| Role | form | `referrer_role` | Support Coordinator · Plan Manager · GP · Allied health professional · NDIA planner / LAC · Other |
| **Contact type** | **constant** | `contact_type` | **always `Referral partner`** **[confirmed]** |
| **Keep updated** | **constant** | `referrer_wants_updates` | **always `false`** **[confirmed]** |

Both constants are hard-coded for this form. Anyone submitting it is by definition a referral
partner, and no update subscription is implied — a promise not made cannot be broken.

The referrer is upserted **every time**, not merely linked when they already exist. Without
this, a new referrer disappears and "who refers us the most" stays unanswerable.

### B. Participant → Contact

| Field | Source | Property | Status |
|---|---|---|---|
| Name | form, required | `firstname` / `lastname` | in use |
| Contact detail | form | `email` **or** `phone` | one field, type guessed — see below |
| Split email / phone into two fields | — | — | **[blank]** |
| Suburb | — | `service_suburb` | **[blank]** |
| Region | — | `service_region` | **[blank]** |
| Preferred language | — | `primary_language` | **[blank]** |
| Interpreter required | — | `interpreter_required` | **[blank]** |
| Gender-matched worker | — | `gender_matched_worker` | **[blank]** |
| Plan management | form | `plan_management_type` | in use |
| Plan status | — | `ndis_plan_status` | **[blank]** |

Two separate things are tangled in `participant_contact` today, and only one of them is a
blank:

- **Splitting the field is a schema change** — held open as **[blank]**.
- **The duplicate-contact bug is not.** `upsertContact` dedupes on email only, so when
  `participant_contact` holds a phone number `findContactByEmail` receives `undefined`,
  returns `null`, and **a new contact is created on every submission**. Two referrals for the
  same person produce two contacts and two deals. This is fixable without touching the form:
  search by email when the value looks like an email, otherwise search by phone. Treat it as a
  bug fix, not part of the blank.

**Note on the language field.** Its absence means the channel professionals use captures
nothing on the dimension the business is built around. Recorded here as a known gap, not
filled in.

### C. The referral → Deal

| Field | Source | Property | Value |
|---|---|---|---|
| **Enquiry type** | **constant** | `enquiry_type` | **always `Referral`** **[confirmed]** |
| **Referred by** | **derived** | `referral_source_detail` | **referrer's name** **[confirmed]** |
| **Received at** | **server** | `enquiry_received_at` | **server time at submission** **[confirmed]** |
| First response at | automation | `first_response_at` | see *Open question 1* below |
| Services required | form | `service_lines_required` | as selected |
| Urgency | — | `referral_urgency` | **[blank]** |
| Deal name | derived | `dealname` | `{participant} — referred by {referrer}` |
| Stage | constant | `dealstage` | `New Enquiry` (`3607635399`) |

`enquiry_received_at` is set from **server time**, never from the client. A submitted
timestamp is attacker-controlled and would corrupt the SLA measurement.

### D. Consent

| Field | Source | Property | Value |
|---|---|---|---|
| Referrer's privacy consent | form checkbox | `privacy_consent` | must be `true` **server-side** |
| **Participant's consent to be referred** | form checkbox | `participant_consent_confirmed` | **`true` when ticked, `false` when not** **[confirmed]** |
| Who gave consent | — | `participant_consent_given_by` | **[blank]** |

**Consent is recorded, never a barrier to submitting.** **[confirmed]** A referrer may know
someone who would benefit and not yet have raised it with them — a GP thinking a family could
use support before that conversation has happened. Blocking that submission loses a real
referral and teaches referrers the form is hostile.

`privacy_consent` covers the referrer's *own* details and must still be validated
server-side. `required` in HTML is a client-side hint only; the handler does not currently
read it at all, which matters more given the endpoint's `Access-Control-Allow-Origin: *`.

**What consent gates instead: outreach, not intake.** This is the substantive consequence of
recording rather than blocking.

| `participant_consent_confirmed` | Next action |
|---|---|
| `true` | Contact the participant. |
| `false` | **Do not contact the participant.** Contact the *referrer* to confirm they will raise it first. |

Without that branch, recording consent as `false` achieves nothing — someone eventually opens
the deal, sees a name and a phone number, and calls a person who never agreed to hear from
you. The flag has to change behaviour or it is decoration.

## The workflow

```
Referral form submitted
      │
 1 ── Validate: origin allowlist · honeypot · rate limit · required fields
      ·          privacy_consent === true
      ·          participant_consent_confirmed recorded as true/false — never blocks
      │
 2 ── Upsert REFERRER contact
      ·   contact_type = "Referral partner"      (constant)
      ·   referrer_wants_updates = false          (constant)
      │
 3 ── Upsert PARTICIPANT contact — match on email OR phone
      ·   all triage values written as PROPERTIES, not only into a note
      │
 4 ── Associate participant ↔ referrer
      │
 5 ── Reuse open deal, else create at "New Enquiry"
      ·   enquiry_type = "Referral"               (constant)
      ·   referral_source_detail = referrer name  (derived)
      ·   enquiry_received_at = server now        (server)
      ·   associate both contacts
      │
 6 ── Note — referral_details narrative, kept as written
 7 ── Task — HIGH priority, due within 2 business hours
      │
 8 ── POST to HubSpot Forms API (portalId / formGuid)
      ·   registers a real form submission — the only enrolment
      ·   trigger available on Starter
      │
 9 ── HubSpot simple workflow fires (one per form, max 10 actions):
      ·   → internal notification email to the team
      ·   → marketing email to the referrer, template 02
      ·   → endpoint stamps first_response_at
      │
10 ── Branch on participant_consent_confirmed:
      ·   true  → contact the participant, by phone, by a person.
      ·           sets participant_first_contacted_at
      ·   false → DO NOT contact the participant.
      ·           Task is to contact the referrer to confirm they will raise it first.
      │
11 ── SLA clock runs from enquiry_received_at. Alert at 90 minutes
      ·   if first_response_at is still empty.
```

---

## Sending email through HubSpot

**[confirmed]** HubSpot is the sender. On **Starter** that constrains the design in four ways.

### 1. The email must be triggered by a HubSpot form

Starter's only enrolment trigger is a form submission, and the transactional Single-Send API
needs Marketing Hub Professional plus a paid add-on. The site form is custom HTML posting to
`/api/hubspot-submit`, so it creates CRM records but triggers **no** HubSpot automation.

**Bridge:** after the CRM writes, the endpoint also POSTs to the HubSpot Forms API
(`/submissions/v3/integration/submit/{portalId}/{formGuid}`). That registers a genuine form
submission and enrols the contact, so the simple workflow fires.

This keeps both halves: the endpoint retains the referrer upsert, deal reuse, server-side
constants and consent handling; HubSpot gains a trigger it can act on. Replacing the site form
with an embedded HubSpot form would also work, but would discard all of that logic — a bad
trade for one email.

*To verify once the connector is reachable:* that a Forms API submission does fire the
follow-up email, not only the internal notification.

### 2. Template tokens must be rewritten in HubSpot syntax

Neither existing copy of template 02 will merge as written. The repo uses
`{{referrer_first_name}}`; the uploaded version uses `{{Referrer First Name}}`. HubSpot uses
its own personalisation tokens referencing real properties.

Unconverted tokens do not error — they render as literal text. A Support Coordinator receives
an email addressed to `{{Referrer First Name}}`.

### 3. Merge values must live on the **Contact**

HubSpot marketing email personalisation reads from the enrolled record. A contact-enrolled
email cannot reach deal properties.

So anything appearing in the email — referral reference, requested service, referral date —
must be written to the **contact**, not only the deal. This is not duplication for its own
sake; it is the only way the token resolves.

### 4. These send as *marketing* email, not transactional

Two consequences:

- **`{{unsubscribe_url}}` now resolves.** The dead-link problem disappears.
- **But subscription logic applies.** A referrer who unsubscribes stops receiving referral
  acknowledgements — including for referrals they make later. They would get silence and no
  indication why.

That sits awkwardly beside `referrer_wants_updates = false`. Being sent marketing email means
being subscribed to something. **Open for the user:** either treat the acknowledgement as a
subscription the referrer is opted into, or accept that unsubscribes silently disable it.

### 5. Domain authentication is still required

HubSpot will not send from `@thehealthwellbeinghub.com` until the domain is connected and
authenticated in HubSpot (SPF, DKIM, DMARC). Same work as before, different console.

### What HubSpot cannot do here

The **consent branch at step 10** stays in `api/hubspot-submit.js`. Simple workflows have no
branching, so the `participant_consent_confirmed` decision cannot live in HubSpot on this
tier. That is fine — as code it is testable and costs nothing.

---

## Open questions

### 1. `first_response_at` cannot be driven by an email to the participant

The instruction was to set it from *"the first email that gets sent to the participant."*
That breaks in two ways:

- **The participant often has no email.** `participant_contact` is optional and frequently a
  phone number. No email can be sent, so the field never populates and the SLA becomes
  unmeasurable for exactly those referrals.
- **The promise is to the enquirer.** On a referral, the person who contacted you is the
  *referrer*. Responding to them within 2 business hours is the commitment; reaching the
  participant may reasonably take longer and depends on them answering the phone.

**Implemented above as:** `first_response_at` is set by the referrer acknowledgement (step 9),
which always sends because `referrer_email` is required. A separate
`participant_first_contacted_at` records when the participant was actually reached.

That keeps the published 2-hour claim measurable and honest, and still tracks participant
contact. Say the word if you want it the other way.

### 2. Should the participant be emailed at all?

Separate from the consent flag. Even where consent *is* attested, consent to be referred is
not automatically consent to receive automated email, and a referral can be sensitive within a
household.

**Recommendation:** first participant contact is a phone call by a person. Cheap, warmer, and
it sidesteps the question. Revisit once a participant-facing consent flow exists.

### 3. Sending domain — still blocks steps 8 and 9

Now HubSpot's domain authentication rather than a third-party service, but the requirement is
unchanged: `thehealthwellbeinghub.com` must be connected and authenticated in HubSpot before
branded mail can send from it. Until then the acknowledgement is unreliable in a way nobody
notices, because spam-filing is invisible from the sending side.

### 4. Who receives the internal notification (step 8)?

**[blank]** Not yet decided. `thehealthwellbeinghub@gmail.com` is the recorded enquiry
address and the obvious candidate, but a role-based address may be preferable. Step 8 cannot
be built until this is set.

---

## Build order

Buildable now, no blanks required:

1. Endpoint hardening — CORS origin allowlist, honeypot, rate limiting.
2. Server-side validation of `privacy_consent`; record
   `participant_consent_confirmed` as a boolean.
3. Fix the duplicate-contact bug — dedupe on email **or** phone.
4. Write the values already collected (`referrer_role`, `plan_type`, `service_needed`) as
   HubSpot properties as well as into the note.
5. Set the constants: `contact_type`, `referrer_wants_updates`, `enquiry_type`,
   `referral_source_detail`, `enquiry_received_at`.

Blocked until the blanks are filled:

6. New form fields and their properties (language, suburb, region, interpreter,
   gender-matched worker, plan status, urgency, consent giver).
7. Steps 8 and 9 — need the notification recipient, HubSpot domain authentication, the
   HubSpot form (portalId and formGuid), and template 02 rewritten in HubSpot token syntax
   with its merge values written to the contact.
8. The consent branch at step 10 — needs an agreed script for the referrer conversation.
