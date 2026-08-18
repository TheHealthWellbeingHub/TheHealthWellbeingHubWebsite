# Workflow 01 — Refer an NDIS participant

What happens when the referral form at `/referrals/` is submitted.

Schema decisions marked **[confirmed]** were made by the user. Fields marked **[blank]** are
deliberately undecided — they are known gaps, held open until the user specifies them. Claude
should not invent values for them.

Business facts: [`../CLAUDE.md`](../CLAUDE.md). Property definitions:
[`hubspot-configuration.md`](hubspot-configuration.md).

**Status:** partly built. Decisions below marked **[decided 18 Aug 2026]** were confirmed by
the user in a live HubSpot session. Contact properties for the acknowledgement email exist;
the marketing email and the simple workflow are not yet built.

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
constants and consent handling; HubSpot gains a trigger it can act on.

### Why an embedded HubSpot form cannot replace the endpoint

Worth stating plainly, because "just use a HubSpot form" is the obvious simplification and it
does not work for *this* form.

**A HubSpot form submission creates one contact.** The referral form describes **two people** —
the referrer and the participant — who must both exist as contacts and be associated with each
other and with the deal. A single form maps to a single enrolled contact, and the fields for
the other person become properties on the wrong record.

Losing that would undo the point of the workflow: no referral-partner record, so "who refers us
the most" stays unanswerable, and the participant's details end up attached to their referrer.

Everything else an embedded form would give — fields landing as properties, native spam
protection, no CORS surface — the endpoint can do too. The two-contact requirement is the one
thing it cannot.

The enquiry form is a different case: one submitter, one contact. If a pure-HubSpot form is
wanted anywhere, that is where it fits, and it is worth deciding separately rather than by
analogy with this one.

### What is and is not still Vercel

| Concern | Where it runs | Why |
|---|---|---|
| Site hosting | Vercel | unchanged |
| Form endpoint, CRM writes, consent branch | Vercel function | two associated contacts; branching |
| **Email sending** | **HubSpot** | **[confirmed]** |
| Storage | **Supabase not used** | HubSpot is the record for this workflow |

Postmark and the other transactional services are out. Supabase plays no part in this
workflow — it was raised earlier as an alternative architecture and is not in use here.

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

## Template 02 — token decisions

**`{{Staff Member}}` is removed.** **[confirmed]** Both occurrences go: the *Assigned contact*
row in the details panel, and the sign-off, which becomes **The Health & Well-being Hub**
alone. This also removes the need for owner-assignment logic, which was previously a blocker.

**`{{Expected Timeframe}}` = "2 business hours".** **[confirmed]**

One precision point. The canonical fact is *"Enquiry response time: within **2 business
hours**"*. Rendering this token as a bare "2 hours" would be a **stronger** claim than the
table supports — a referral at 6pm Friday would promise contact by 8pm Friday. `CLAUDE.md`
says not to restate these more strongly, so the token renders as **2 business hours**, and
trading hours are Mon–Fri 8:00am–5:00pm.

Note also that this sentence promises contact with the **participant** within that window,
whereas the canonical promise is about answering the **enquirer**. Recorded as the user's
decision, not a drafting slip.

**Which template these apply to. [resolved 18 Aug 2026]** A revised upload was supplied that
contains **neither** `{{Staff Member}}` nor `{{Expected Timeframe}}` — both had already been
removed, so those two instructions are no-ops against it. The uploaded structure wins: it has
the corrected sign-off, an `{{unsubscribe_url}}`, the NDIS registration number, and
consent-aware wording the repo copy lacks.

The token *style* question (Title Case vs snake_case) is moot — every token is replaced with
HubSpot personalisation syntax bound to a contact property, so neither scheme survives the
build.

Two changes made to the uploaded copy:

- **`{{Participant First Name / their nominated representative}}` removed.** It is an editorial
  note left inside token braces. It maps to no property and would render literally in every
  acknowledgement. Rewritten as prose.
- **The 2-business-hour promise added back. [decided 18 Aug 2026]** The uploaded copy made no
  timing commitment at all. It now reads *"be in touch with you within 2 business hours"* —
  addressed to the **referrer**, which is both the canonical promise in `CLAUDE.md` (response
  to the *enquirer*) and consistent with `first_response_at` being stamped by this email. A
  trading-hours clarifier was drafted and **rejected by the user** — the line stays as plain
  "2 business hours".

---

## Behind the scenes — the full sequence

Every call the system makes, in order. Timings are for a warm function.

### Browser — T+0

`referrals/index.html` carries `<form data-form-name="referral" novalidate>`. `novalidate`
means the browser runs no validation; `static/js/main.js` owns it, serialises the fields to
JSON, and `fetch`es `POST /api/hubspot-submit`.

**Nothing here is trustworthy.** Every value arrives from a client that can be scripted.

### Vercel function — T+0 to ~2s

#### 1. Gate

| Check | On failure |
|---|---|
| `Origin` header against allowlist | `403` |
| Honeypot field empty | **`200 OK`, discard silently** — never tell a bot it failed |
| Per-IP rate limit | `429` |
| Required fields present | `400` |
| `privacy_consent === true` | `400` |
| `participant_consent_confirmed` cast to boolean | never blocks |

`receivedAt = new Date().toISOString()` is captured here, from **server** time.

#### 2. Upsert the referrer

```
POST /crm/v3/objects/contacts/search      filter: email EQ referrer_email
→ found:  PATCH /crm/v3/objects/contacts/{id}
→ absent: POST  /crm/v3/objects/contacts
```

Properties: `firstname`, `lastname`, `company`, `phone`, `email`, `referrer_role`,
`contact_type = "Referral partner"`, `referrer_wants_updates = false`.

#### 3. Upsert the participant — the duplicate fix

```
looksLikeEmail(participant_contact)
  ? search filter: email EQ value
  : search filter: phone EQ value        ← the fix
```

Today the phone branch does not exist, so `findContactByEmail(undefined)` returns `null` and
**a new contact is created on every submission**.

> **[corrected 18 Aug 2026] Merge values do NOT belong here.** This step upserts the
> *participant*. The acknowledgement is sent to the **referrer**, and enrolment is decided by
> the `email` field in the Forms API submission. HubSpot personalisation resolves tokens
> against the **enrolled** contact — so values stored on the participant render **blank**.
> The email sends, the system reports success, and the referrer receives empty fields.
>
> Merge values are written on the **referrer** (step 2), as `latest_referral_*` properties.
> See [`hubspot-manual-setup.md`](hubspot-manual-setup.md).

It remains true that a contact-enrolled email cannot reach deal properties — the merge values
must live on a contact either way. The correction is *which* contact.

#### 4. Associate the two people

```
PUT /crm/v4/objects/contacts/{participantId}/associations/default/contacts/{referrerId}
```

#### 5. Find or create the deal

```
GET /crm/v3/objects/contacts/{participantId}/associations/deals
GET /crm/v3/objects/deals/{id}?properties=dealstage       (per associated deal)
```

A deal whose stage is **not** in `CLOSED_STAGE_IDS` is reused — the same journey continuing,
not a parallel one. Otherwise:

```
POST /crm/v3/objects/deals
  dealstage = 3607635399  ("New Enquiry")
  enquiry_type = "Referral"                (constant)
  referral_source_detail = referrer name   (derived)
  enquiry_received_at = receivedAt         (server)
```

Then associate the deal to both contacts.

#### 6. Mint the reference

The reference needs the deal ID, so it cannot be minted earlier: `REF-{YYYY}-{dealId}`.
Written to **both** the deal and the participant contact — the contact copy is what the email
token reads.

#### 7. Note and task

```
POST /crm/v3/objects/notes    hs_note_body = referral_details narrative
POST /crm/v3/objects/tasks    priority HIGH, type CALL
```

The task's due time is `receivedAt` **+ 2 business hours**, computed against
Australia/Brisbane and Mon–Fri 8:00am–5:00pm. A 4:30pm Friday referral is due 9:30am Monday,
not 6:30pm Friday.

The task subject branches on consent:

| Consent | Subject |
|---|---|
| `true` | `Contact participant: {name}` |
| `false` | `Contact REFERRER — participant consent not confirmed: {name}` |

That branch lives here because Starter's simple workflows cannot branch.

#### 8. Trigger the email

```
POST https://api-ap1.hsforms.com/submissions/v3/integration/submit/443542186/98d9dea9-840e-42f5-864a-747f97456bb1
```

Different host, and **no Bearer token** — form submissions authenticate by portal and form ID
alone. This registers a genuine form submission, which is the only enrolment trigger Starter
offers.

**The portal is in the `ap1` region**, confirmed by the embed code
(`js-ap1.hsforms.net`, `data-region="ap1"`). HubSpot serves regional accounts from
region-specific hosts — the EU equivalent is documented as `api-eu1.hsforms.com` — so the
plain `api.hsforms.com` host used elsewhere in HubSpot's docs was assumed **probably wrong for
this account**. **That assumption was tested and is incorrect — see below.**

*Must be verified before go-live.* The failure mode is quiet: a submission to the wrong
regional host returns an error the endpoint would log but nobody would read, the CRM record
would still be created correctly, and no acknowledgement would ever send.

**[tested 18 Aug 2026 — resolved]** Both hosts were submitted against live, with form
`98d9dea9-840e-42f5-864a-747f97456bb1`:

| Host | Result | Contact created |
|---|---|---|
| `api.hsforms.com` | `200` | yes, source `FORM` |
| `api-ap1.hsforms.com` | `200` | yes, source `FORM` |

Two corrections to the guidance above:

1. **Both hosts work.** They resolve to the same anycast IPs, and the portal and form are
   identified by the URL path, not the hostname. Region routing is not a factor here.
2. **Neither returns `204`.** The v3 integration endpoint returns `200 {"inlineMessage":""}`.
   `204` is the *legacy v2* endpoint's response. "Keep whichever returns 204" would have
   discarded both working hosts.

`api-ap1.hsforms.com` remains the host to use — it matches the embed code and is explicit
about region — but this is a preference, not the silent-failure risk it was thought to be.

**Ordering matters.** CRM writes happen first, the form submission last. If the sequence
breaks midway the failure mode is *"record exists, email missing"* — recoverable by hand.
The reverse order risks *"email sent, no record"*, where a referrer is told you have their
referral and nothing exists.

#### 9. Respond

`200 {ok: true, reference}`. Total ~1–2s warm, ~3s cold.

### HubSpot — asynchronous, seconds to minutes later

The simple workflow fires on the form submission. Ten actions maximum, one workflow per form:

1. Internal notification email → the team
2. Marketing email → the referrer, template 02
3. **Webhook** → `POST /api/hubspot-sent`

> **[tested 18 Aug 2026 — not available] The webhook action does not exist on Starter.** The
> simple-workflow action list offers internal notification, send email, list membership,
> contact assignment and record/task creation — no webhook. The capability table in
> `hubspot-configuration.md` lists "send webhook" as a Starter simple-workflow action; that is
> wrong and has been corrected there.
>
> **Consequence, accepted:** `first_response_at` is stamped by the endpoint at submission —
> the moment the acknowledgement is *queued*, not sent. In practice the gap is seconds to
> minutes, so it does not change whether the 2-business-hour promise is met. It does mean the
> timestamp is evidence of dispatch, not of delivery. If the timing ever has to be *proven*
> rather than monitored, that distinction matters.

The reasoning for wanting it stands, and applies if the portal is ever upgraded: the Vercel
function cannot know when HubSpot actually sent, so without it `first_response_at` is an
approximation stamped at submission time.

### Vercel Cron — every 15 minutes

Queries deals at *New Enquiry* where `enquiry_received_at` is more than **90 business
minutes** old and `first_response_at` is still empty, and alerts. Ninety minutes leaves half
an hour to act before the promise is broken, rather than reporting it afterwards.

---

## Failure modes

What breaks, and what it looks like.

| Failure | Consequence | Handling |
|---|---|---|
| HubSpot `429` | Writes fail mid-sequence | Exponential backoff, up to 3 attempts |
| Forms API fails, CRM writes succeeded | Record exists, **referrer hears nothing** | Log and alert — silence is invisible to you and reads as being ignored |
| Deal created, association fails | Orphaned deal | Retry association; alert if it still fails |
| Double submit | Two submissions | Deal reuse absorbs it; contact upsert is idempotent |
| Referrer previously unsubscribed | Marketing email **silently suppressed** | See open question 5 |
| Token unconverted | Renders literally: `Hi {{Referrer First Name}},` | Caught by the template check, not at runtime |

The two worth designing against are the silent ones — the suppressed send and the failed form
submission. Both leave a correct-looking CRM record and a referrer who was never contacted.

---

## Designing against the silent failures

Both silent failures — a failed form submission, and a suppressed email to an unsubscribed
referrer — end the same way: a CRM record that looks correct, and a referrer nobody contacted.
Neither raises an error. Both are invisible from your side and read as being ignored from
theirs.

One mechanism covers both: **make the acknowledgement's state explicit, reconcile it, and put
the fallback in front of a human.**

### The mechanism

A single deal property, `acknowledgement_status`, with four states:

| State | Set when | Meaning |
|---|---|---|
| `pending` | endpoint submits to the Forms API | queued, not confirmed |
| `sent` | HubSpot's webhook arrives | actually sent |
| `failed` | Forms API errors after retries | no email will arrive |
| `suppressed` | referrer is unsubscribed | HubSpot will drop it silently |

Nothing is assumed. `pending` means *we do not yet know*, which is the honest state between
submission and confirmation — and an unresolved `pending` is itself the alarm.

### Failure A — the form submission fails

1. **Retry** with exponential backoff, three attempts. Most failures are transient.
2. **Still failing:** set `acknowledgement_status = failed`.
3. **Rewrite the task** that already exists — subject becomes
   `ACKNOWLEDGE MANUALLY — automated email failed: {referrer}`, due immediately.
4. **Return `200` to the browser regardless.** The referrer submitted successfully and the
   record exists; a failed acknowledgement is your problem to fix, not an error to show them.

The task is the safety net. It is already in the workflow, a person already works that queue,
and it converts a silent system failure into a visible human one.

### Failure B — the referrer is unsubscribed

You cannot and should not override an unsubscribe. The design detects it and routes around it.

**Prevention first: a dedicated subscription type.** Create *Referral acknowledgements* as its
own subscription type in HubSpot, separate from any newsletter or marketing list. Then a
referrer unsubscribing from marketing keeps their acknowledgements, and only someone who
explicitly opts out of referral acknowledgements loses them — which is a legitimate choice
rather than an accident.

Without this, one unsubscribe from any HubSpot email silently disables acknowledgements for
every future referral that person makes.

**Detection at submission:**

```
GET /communication-preferences/v3/status/email/{referrer_email}
```

Unsubscribed from the referral-acknowledgement type →
`acknowledgement_status = suppressed`, and the task becomes
`ACKNOWLEDGE BY PHONE — referrer unsubscribed: {referrer}`.

*To verify when the connector is reachable:* that this endpoint is available on Starter.
If it is not, the reconciliation sweep below still catches it, one cycle later.

### Reconciliation — the backstop

The existing Vercel Cron, every 15 minutes, widens from one query to three:

| Query | Action |
|---|---|
| `first_response_at` empty, past **90 business minutes** | SLA alert |
| `acknowledgement_status = pending`, older than **15 minutes** | treat as failed — no webhook arrived |
| `acknowledgement_status` in (`failed`, `suppressed`) | daily digest until cleared |

The middle query is what makes the webhook meaningful. Without it, a webhook that never
arrives is indistinguishable from one that has not arrived *yet*, and `pending` becomes a
state records die in.

### Why the task, not an alert

Both fallbacks route to the **task the workflow already creates**, rather than a new alerting
channel. A referral where the acknowledgement failed still needs the same action as any other
referral — contact the referrer within 2 business hours — just done by hand. Putting it in the
queue a person already works means it cannot be missed separately from the work itself.

---

## Connection values

Confirmed from the published form's embed code.

| Value | |
|---|---|
| Portal ID | `443542186` |
| Form GUID | `98d9dea9-840e-42f5-864a-747f97456bb1` |
| Data region | `ap1` |
| Form name | *Referral — API target* (published, deliberately not embedded) |
| Subscription type | *Referral acknowledgements* (active) |

Both IDs belong in Vercel environment variables rather than the source, so the form can be
rebuilt without a code change.

### Form settings that the design depends on

| Setting | Value | Why |
|---|---|---|
| Create new contacts for email addresses | **On** | Belt and braces. The endpoint creates the contact first, so a submission normally matches an existing record — but if that write fails or the address differs, an off setting means the submission enrols nobody and the acknowledgement silently never sends. |
| Set new contacts as marketing contacts | **On** | **Required.** A non-marketing contact cannot receive marketing email, and on Starter the acknowledgement *is* marketing email. Off means the workflow runs and sends nothing. Each referrer consumes one of the 1,000 marketing contacts. |
| Form shortening (AI enrichment) | Off | The form is never displayed, so it does nothing useful, and it would route referrer details through a third-party enrichment service for no benefit. |

---

## Edge cases

Ordered by how much damage they do, not how likely they are.

### Identity

**The referrer and the participant are the same person.** Someone self-referring through the
referral form puts the same email in both roles. `upsertContact` returns the same ID twice,
and the contact-to-contact association then tries to associate a record with itself, which
errors and aborts the sequence. Detect matching email or normalised phone, skip the
association, and treat the record as a participant.

**The referrer is already a participant.** A current or former participant refers a friend —
common in exactly the community networks this business is built on. Blindly setting
`contact_type = "Referral partner"` **overwrites their participant status and silently
corrupts the record.**

This is the argument for making it a **boolean `is_referral_partner`** rather than a
single-select `contact_type`. One person can be both, and a single-select cannot represent
that. Worth settling before any of these properties are created, because changing it later
means migrating live records.

**The participant has no contact detail at all.** The field is optional. With no email and no
phone there is no dedup key, so every submission creates a new contact — the same unbounded
duplication as the phone bug, from a different direction. Do not silently create; flag for
manual merge.

**Phone formats vary.** `0433 604 507`, `0433604507` and `+61433604507` are the same number
and three different search results. Normalise to E.164 before both searching and storing, or
the dedup fix does not actually work.

**Names are not all First Last.** `splitName` takes the first whitespace-delimited token as
the given name and the rest as the family name. That mangles Arabic, Somali, Dari and Amharic
naming conventions, single-token names, and names with particles. For a provider whose
positioning is serving these communities, getting someone's name wrong in the first
acknowledgement is worse than most technical failures. Store the name **exactly as entered**
in its own property alongside whatever split is made for greeting purposes.

### Delivery

**Hard bounces.** A typo'd referrer address bounces, and HubSpot then suppresses that contact
permanently. Same silent class as an unsubscribe, different cause. `acknowledgement_status`
should carry `bounced` as a fifth state.

**The 1,000 marketing-contact limit.** Once reached, new contacts cannot be set as marketing
contacts, and a non-marketing contact **cannot receive marketing email**. Every referral would
still be recorded correctly and no acknowledgement would ever send again. Monitor the count
and alert at 80%, rather than discovering it from a referrer complaint.

**Double submission.** A double-click sends two form submissions and the referrer receives two
identical acknowledgements. Deal reuse absorbs the CRM side but not the email. Suppress
repeat submissions for the same referrer and participant within a short window.

### Correctness

**The participant already has an open deal from service delivery.** Deal reuse looks for any
deal not in a closed stage. An existing client being re-referred would have the referral
attached to their live service deal, corrupting both. Restrict reuse to deals in the intake
pipeline at pre-signed stages.

**Service footprint contradictions.** A participant in VIC requesting Core Supports is asking
for something only offered in South East Queensland. The form accepts it happily. Flag the
contradiction at triage rather than discovering it on the call.

**HTML in name fields.** The acknowledgement is an HTML email. Confirm HubSpot escapes
personalisation tokens on render, and sanitise on the way in regardless — an unescaped token
is both a broken email and an injection path.

**Queensland public holidays.** The 2-business-hour calculation must skip them, not only
weekends. Brisbane is UTC+10 year-round with no daylight saving, which removes the usual
timezone trap but not this one.

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

### 4. Who receives the internal notification?

**[decided 18 Aug 2026]** `thehealthwellbeinghub@gmail.com`.

A role-based address was considered and deferred — it needs a mailbox that does not yet exist.
Note that `thehealthwellbeinghub.com` currently has **no MX record**, so it cannot receive mail
at all. Any future move to a branded address needs mail routing set up first, or replies bounce
silently — and template 02 explicitly invites a reply.

### 5. Unsubscribed referrers are silently dropped

Because these send as *marketing* email on Starter, a referrer who ever unsubscribes stops
receiving referral acknowledgements — for every future referral, with no notice to them and
no signal to you. It sits awkwardly beside `referrer_wants_updates = false`: being sent
marketing email means being subscribed to something.

**[decided 18 Aug 2026] Detect and escalate.** Three parts:

1. The dedicated *Referral acknowledgements* subscription type (id `3428566311`) is created and
   active, so a general marketing unsubscribe no longer disables acknowledgements. Only an
   explicit opt-out of this type does.
2. The endpoint checks subscription status at submission and sets
   `acknowledgement_status = suppressed` when the referrer has opted out.
3. The existing follow-up task is rewritten to `ACKNOWLEDGE MANUALLY — referrer unsubscribed`,
   due immediately.

The unsubscribe itself is always honoured. What changes is that the drop becomes visible, and
the referrer still gets a reply — from a person rather than from the system.

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
