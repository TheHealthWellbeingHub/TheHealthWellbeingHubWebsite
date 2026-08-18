# Workflow 01 — Refer an NDIS participant

What happens when the referral form at `/referrals/` is submitted.

Schema decisions marked **[confirmed]** were made by the user. Those marked **[assumed]** were
filled in by Claude where the user did not specify — override any of them.

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

| Field | Source | Property | Notes |
|---|---|---|---|
| Name | form, required | `firstname` / `lastname` | |
| **Email** | form | `email` | **split from `participant_contact`** **[assumed]** |
| **Phone** | form | `phone` | **split from `participant_contact`** **[assumed]** |
| Suburb | form | `service_suburb` | **[assumed]** — needed for the footprint check |
| Region | form | `service_region` | Logan · Brisbane · Other SEQ · NSW · VIC · WA · Other **[assumed]** |
| Preferred language | form | `primary_language` | English · Arabic · Somali · Dari · Amharic · Other **[assumed]** |
| Interpreter required | form | `interpreter_required` | No · Yes · Unknown **[assumed]** |
| Gender-matched worker | form | `gender_matched_worker` | No preference · Female required · Male required **[assumed]** |
| Plan management | form | `plan_management_type` | Agency · Plan · Self · Not sure |
| Plan status | form | `ndis_plan_status` | Active · Pending · None or unsure **[assumed]** |

**Splitting `participant_contact` is not optional.** Today it is one field holding a phone
*or* an email, and `looksLikeEmail()` guesses which. Two consequences: a mistyped address is
silently filed as a phone number, and `upsertContact` dedupes on email only — so a
phone-only referral creates a **new contact on every submission**. Two referrals for the same
person means two contacts and two deals.

### C. The referral → Deal

| Field | Source | Property | Value |
|---|---|---|---|
| **Enquiry type** | **constant** | `enquiry_type` | **always `Referral`** **[confirmed]** |
| **Referred by** | **derived** | `referral_source_detail` | **referrer's name** **[confirmed]** |
| **Received at** | **server** | `enquiry_received_at` | **server time at submission** **[confirmed]** |
| First response at | automation | `first_response_at` | see *Open question 1* below |
| Services required | form | `service_lines_required` | as selected |
| Urgency | form | `referral_urgency` | Standard · Urgent **[assumed]** |
| Deal name | derived | `dealname` | `{participant} — referred by {referrer}` |
| Stage | constant | `dealstage` | `New Enquiry` (`3607635399`) |

`enquiry_received_at` is set from **server time**, never from the client. A submitted
timestamp is attacker-controlled and would corrupt the SLA measurement.

### D. Consent

| Field | Source | Property | Value |
|---|---|---|---|
| Referrer's privacy consent | form checkbox | `privacy_consent` | must be `true` **server-side** |
| **Participant's consent to be referred** | form checkbox | `participant_consent_confirmed` | **`true` when ticked** **[confirmed]** |
| Who gave consent | form | `participant_consent_given_by` | Participant · Nominee · Guardian **[assumed]** |

Both checkboxes must be **validated server-side**. `required` in HTML is a client-side hint
only; the handler currently never reads `privacy_consent`, so a direct POST bypasses it
entirely — which matters more given the endpoint's `Access-Control-Allow-Origin: *`.

**Recommendation:** reject the submission when `participant_consent_confirmed` is not true,
rather than recording it as false. A referral without attested consent creates a record of a
person who never agreed to be in your CRM. Flagged for the user's decision — the instruction
was to record the checkbox, not necessarily to block on it.

---

## The workflow

```
Referral form submitted
      │
 1 ── Validate: origin allowlist · honeypot · rate limit · required fields
      ·          privacy_consent === true · participant_consent_confirmed === true
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
 8 ── Email → team       "New referral: {participant} from {organisation}"
 9 ── Email → referrer   template 02, Referral received
      ·   sets first_response_at
      │
10 ── Participant contact — by phone, by a person. No automated email.
      ·   sets participant_first_contacted_at
      │
11 ── SLA clock runs from enquiry_received_at. Alert at 90 minutes
      ·   if first_response_at is still empty.
```

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

The added consent checkbox weakens the earlier objection — if the referrer attests they have
the participant's consent, contacting them is the point of the referral. But consent *to be
referred* is not automatically consent to receive automated email, and a referral can be
sensitive within a household.

**Recommendation:** first participant contact is a phone call by a person. Cheap, warmer, and
it sidesteps the question entirely. Revisit once a participant-facing consent flow exists.

### 3. Sending domain — blocks steps 8 and 9

Template 02 is branded HTML. Sent from `thehealthwellbeinghub@gmail.com` it will likely land
in spam, and a Support Coordinator who gets silence does not refer again.

`thehealthwellbeinghub.com` is confirmed, so the path is open: configure SPF, DKIM and DMARC
and send through a transactional service. Until then the acknowledgement is unreliable in a
way nobody will notice, because bounces and spam-filing are invisible from the sending side.

### 4. Who receives the internal notification (step 8)?

**[assumed]** `thehealthwellbeinghub@gmail.com`, the recorded enquiry address. Replace with a
role-based address if referrals should reach someone other than the general inbox.

---

## Build order

1. Server-side consent validation and endpoint hardening — correctness and safety first.
2. Split `participant_contact`; dedupe on email **or** phone. Fixes the live duplicate bug.
3. Add the missing form fields and the matching HubSpot properties.
4. Write every value as a property, keeping the note as narrative.
5. Wire steps 8 and 9 once the sending domain is configured.
