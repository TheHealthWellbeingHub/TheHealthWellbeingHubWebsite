# Workflow 02 — Website enquiry acknowledgement

The enquiry equivalent of [`workflow-01-referral.md`](workflow-01-referral.md). Read that
one first — the mechanism is identical and is explained there in full. This document covers
only what is **different**, and what still has to be built.

| | |
|---|---|
| Form on the site | `templates/partials/enquiry_form.html`, served on `/` and `/contact/` |
| Endpoint | `api/hubspot-submit.js`, `form_name: "enquiry"` |
| Enrolment trigger | HubSpot form submission via the Forms API |
| Acknowledgement | Marketing email **03 — New enquiry acknowledgement** |
| Reference format | `ENQ-<year>-<dealId>` |

---

## Why this is not just workflow 01 with different words

Four differences, each of which changes behaviour rather than copy.

### 1. The person who submits *is* the contact

On a referral there are two people: the referrer submits, the participant is referred. The
acknowledgement goes to the referrer, so the merge values have to be written to the
**referrer's** record — writing them to the participant sends an email full of blanks that
looks fine from our side.

An enquiry has one person. Merge values are written to `contactId` directly. There is no
second record to get wrong, and no equivalent of that bug to guard against.

### 2. Email is optional, so "no acknowledgement" is a normal outcome

The enquiry form requires **phone**, not email. That is deliberate — a participant without an
email address must still be able to ask for help.

So an enquiry with no email address cannot be acknowledged by email, and this is not a
failure. The endpoint returns `acknowledgementStatus: "no_email"` and does **not** raise an
alarm. The follow-up task created for every enquiry already tells the team to call them.

Treating this as an error would train everyone to ignore the error.

### 3. `contact_status` is set on every enquiry, not only on creation

A new contact created by the endpoint defaults to `Needs_first_contact`. An enquirer is set to
**`We_owe_a_reply`** on *every* submission, including a returning one.

The reasoning is the same as for referrers: someone who has just enquired is waiting on us,
and that is true whether or not we have spoken before. A participant marked *On hold* who
sends a new website enquiry is pulled back to *We owe a reply* — which is the point of the
field, not drift.

This is a judgement call and it is reversible: the team can set the status back. The failure
in the other direction is worse — an enquiry sitting behind an *On hold* status that nobody
replies to, breaking the 2-business-hour promise.

Note the contrast with the referral path, where the **participant** stays
`Needs_first_contact`, because the participant has not asked us for anything.

### 4. A separate form, because Starter allows one workflow per form

Starter permits one workflow per form, so referrals and enquiries cannot share an enrolment
trigger. Two forms, two GUIDs, two workflows. `submitToFormsApi()` is one helper taking a
`formGuid` — everything else about the call is identical.

---

## Sequence

Identical to workflow 01 §"Behind the scenes" up to the acknowledgement, with the enquiry
branch substituted:

1. Origin check, honeypot, payload size, **privacy consent** — a submission without consent is
   rejected `400` before anything is written.
2. Upsert the enquirer (by email if given, otherwise by phone), with
   `contact_status: We_owe_a_reply`.
3. Write triage properties, schema-filtered.
4. Find or reuse an open deal; create one if there is none.
5. Mint `ENQ-<year>-<dealId>`.
6. Note and follow-up task.
7. Write the four `latest_enquiry_*` merge properties on the enquirer.
8. **Last** — submit to the Forms API, which enrols them and sends email 03.
9. Respond `200`.

Ordering is deliberate and matches workflow 01: CRM writes first, so a mid-sequence failure
leaves *"record exists, email missing"* — recoverable by hand. The reverse risks *"email sent,
no record"*, where someone is told we have their enquiry and nothing does.

### `acknowledgementStatus` values

The response field says what happened to the acknowledgement, and is the fastest way to
diagnose a "they never heard back" report.

| Value | Meaning | Action |
|---|---|---|
| `pending` | Handed to HubSpot; the workflow sends it | none |
| `no_email` | Enquirer gave no email address | none — call them, as the task says |
| `not_configured` | `HUBSPOT_ENQUIRY_FORM_GUID` is unset | **finish the setup below** |
| `failed` | Forms API rejected three attempts | a HIGH task is raised; acknowledge by hand |
| `not_applicable` | Not an enquiry | none |

`not_configured` and `failed` both create a visible task rather than only logging. A log line
nobody reads is the same as no alert at all.

---

## Build status

| Step | State |
|---|---|
| Endpoint (`api/hubspot-submit.js`) | **done**, deployed, verified live |
| HubSpot form *Enquiry — API target* | **done** — `1d577457-30f7-4041-bcb4-4c996103b07a` |
| Four `latest_enquiry_*` properties | **done**, verified writing |
| Subscription type *Enquiry acknowledgements* | **done** |
| Marketing email 03 | **built** — object `709156560372`, verified rendering |
| The workflow | **live** — verified sending 19 Aug 2026 |

Verified against production on 19 Aug 2026, `ENQ-2026-287456717249`:

| Property | Value |
|---|---|
| `latest_enquiry_reference` | `ENQ-2026-287456717249` |
| `latest_enquiry_date` | `2026-08-19` |
| `latest_enquiry_date_display` | `19/08/2026` |
| `latest_enquiry_service` | `Support Coordination` |

`acknowledgementStatus` returned `pending`, so the Forms API accepted the submission. Nothing
sends yet because no workflow is listening to the form.

The *"Not sure — please advise"* fallback was tested separately and wrote
`latest_enquiry_service = NDIS supports`, as intended.

### 1. HubSpot form — *Enquiry — API target* — done

Marketing → Forms → Create form → Embedded form → Blank template.

- Name it **`Enquiry — API target`**, matching `Referral — API target`.
- Fields: **Email** only. It is never rendered anywhere — it exists solely as an enrolment
  trigger the Forms API can post to.
- Publish it, then take the **GUID** from the form's URL or embed code.

The GUID goes into `ENQUIRY_FORM_GUID` in `api/hubspot-submit.js` (alongside the referral one),
or into a `HUBSPOT_ENQUIRY_FORM_GUID` environment variable in Vercel.

**Created 19 Aug 2026** — `1d577457-30f7-4041-bcb4-4c996103b07a`, now the default in the
endpoint.

### 2. Four contact properties — done

Same pattern as `latest_referral_*`, and prefixed the same way for the same reason: they
describe the **most recent** enquiry, not a permanent attribute of the person.

| Internal name | Label | Type |
|---|---|---|
| `latest_enquiry_reference` | Latest enquiry — reference | Single-line text |
| `latest_enquiry_date` | Latest enquiry — date received | Date picker |
| `latest_enquiry_date_display` | Latest enquiry — date (display) | Single-line text |
| `latest_enquiry_service` | Latest enquiry — service | Single-line text |

Both date properties are written on every enquiry, deliberately — the date picker for
filtering and reporting, the text one for what the enquirer actually reads. See
`hubspot-manual-setup.md` §"Date format" for why: HubSpot renders a date property in the
portal's locale, and `05/08/2026` means two different days depending on who is reading it.

Both are computed in `Australia/Brisbane`, so a late-evening submission carries the correct
local date rather than the previous day's.

`latest_enquiry_service` is **text, not a dropdown**, so it can hold a readable phrase. Where
the enquirer picks *"Not sure — please advise"* the form posts an empty string and the endpoint
substitutes **`NDIS supports`** — otherwise the email reads *"your enquiry about ."*

### 3. Subscription type — *Enquiry acknowledgements* — done

Settings → Marketing → Email → Subscription types → Create.

- Name: **Enquiry acknowledgements**
- Description: *Confirmation that we have received an enquiry you sent us*

The description is not internal wording — it is the line a participant reads on the
communication preferences page when deciding what to unsubscribe from.

Do **not** reuse *Referral acknowledgements*. It is the record of what a person has opted into,
and it appears on the preference page they see. A participant who unsubscribes from
"referral acknowledgements" they never asked for is a confusing and inaccurate record.

### 4. Marketing email 03 — done

Built 19 Aug 2026 by cloning email 02 in the HubSpot UI, because the connector could not write
(see below).

| | |
|---|---|
| Name | `03 — New enquiry acknowledgement` |
| Marketing email object ID | `709156560372` |
| Content ID (editor URL) | `367577414094` |
| Type | **AUTOMATED** |
| Subscription type | Enquiry acknowledgements (`3430045004`) |
| Reply-to | `hello@thehealthwellbeinghub.com` |

Verified by rendering the saved email against contact `346310074863`:

```
Hi Enquiry,
We've received your enquiry about Support Coordination. Someone from our team
will contact you within 2 business hours to talk about what you need.
Enquiry reference: ENQ-2026-287456717249
Date received: 19/08/2026
```

All four tokens resolve. Date is day-first and Brisbane-computed.

#### Defaults are inline, not set through the UI

Each enquiry token is wrapped in `personalization_token(...)` with its default as the second
argument, rather than relying on a default configured per-token in the editor:

```
{{ personalization_token('contact.latest_enquiry_service', 'NDIS supports') }}
{{ personalization_token('contact.latest_enquiry_reference', 'to be confirmed') }}
{{ personalization_token('contact.latest_enquiry_date_display', 'today') }}
```

A bare `{{ contact.latest_enquiry_service }}` with no default does not render blank when the
property is empty — HubSpot renders the property name in capitals,
`CONTACT.LATEST_ENQUIRY_SERVICE`, in the middle of the sentence. Inline defaults keep the
fallback in the same place as the token, so it cannot be lost by editing the copy.

#### The editor canvas is not evidence

Worth recording, because it cost two rounds. The email editor previews the **unsaved editor
session**. It twice showed a completely correct email while the *saved* version still held the
referral body — *"Thank you for referring your participant…"* — addressed to someone who had
made an enquiry.

Check with `PREVIEW_CONTENT` against a real contact ID, or `GET_CONTENT`, both of which read
the saved record. A screenshot of the canvas does not tell you what would send.

### 5. The workflow

Marketing → Automation → Workflows → Create → **Form submission** → *Enquiry — API target*.

Simple workflow, Starter limits apply: ten actions, no branching, no webhook action.

1. **Send internal email** — notify the team.
2. **Send email** → *03 — New enquiry acknowledgement*.

Check action 2 sends to the **enrolled contact**, not "all associated contacts". On workflow 01
that setting defaulted to all associated contacts, which would have emailed participants who
had never consented to hear from us.

---

## Email 03 — copy and token decisions

Structure mirrors email 02 exactly: logo band, hero band, body, footer. The fastest correct
build is **clone 02 in the HubSpot UI**, then change the settings and replace two blocks of
HTML.

### Settings

| Field | Value |
|---|---|
| Name | `03 — New enquiry acknowledgement` |
| Subject | `We've received your enquiry` |
| Preview text | `We'll be in touch within 2 business hours.` |
| From name | `The Health & Well-being Hub` |
| Reply-to | `hello@thehealthwellbeinghub.com` |
| Subscription type | **Enquiry acknowledgements** (create it first) |
| Email type | **AUTOMATED** — permanent, and required for workflow enrolment |

### Token mapping

| Uploaded template token | HubSpot token |
|---|---|
| `{{First Name}}` | `{{ contact.firstname }}` |
| `{{Service or Support Type}}` | `{{ contact.latest_enquiry_service }}` |
| `{{Enquiry Reference}}` | `{{ contact.latest_enquiry_reference }}` |
| `{{Date}}` | `{{ personalization_token('contact.latest_enquiry_date_display', 'today') }}` |
| `{{Expected Timeframe}}` | literal text — **2 business hours** |
| `{{unsubscribe_url}}` | the footer module, which HubSpot renders |

`{{Expected Timeframe}}` is written out rather than merged, for the reason recorded in
workflow 01: the canonical promise is *within 2 business hours*, and rendering a bare
"2 hours" would be a stronger claim than the facts table supports.

### Hero band — replaces section 1

```html
<h1 style="margin:0;font-family:Georgia,serif;font-weight:700;font-size:29px;line-height:1.25;color:#273963;text-align:center;">Thanks for reaching out</h1>
<p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#5f6681;text-align:center;">We've got your enquiry and we'll be in touch soon.</p>
```

### Body — replaces section 2

```html
<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#434b66;">Hi {{ contact.firstname }},</p>
<p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#434b66;">We've received your enquiry about <strong>{{ contact.latest_enquiry_service }}</strong>. Someone from our team will contact you within <strong>2 business hours</strong> to talk about what you need.</p>
<div style="background:#f8f1f8;border-radius:12px;padding:20px;margin:16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.8;color:#434b66;"><strong>Enquiry reference:</strong> {{ contact.latest_enquiry_reference }}<br><strong>Date received:</strong> {{ personalization_token('contact.latest_enquiry_date_display', 'today') }}</div>
<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#434b66;">We speak English, Arabic, Somali, Dari and Amharic. If you would like an interpreter, or a support worker of a particular gender, just ask.</p>
<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#434b66;">If there is anything else that would help us — how your NDIS plan is managed, or a good time to call — reply to this email and tell us.</p>
<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#434b66;">For anything urgent, call <a href="tel:+61433604507" style="color:#81268a;">0433 604 507</a>. We are not an emergency service. If someone is in immediate danger, call 000.</p>
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.7;color:#434b66;">Kind regards,<br><strong>The Health &amp; Well-being Hub</strong></p>
```

### Copy decisions

**Plainer than email 02**, on purpose. Email 02 goes to Support Coordinators and GPs. This one
goes to participants and families, often reading in a second language, so the sentences are
shorter and the words more common — `CLAUDE.md`, "Write plainly".

**The languages line leads with what makes the Hub different.** Languages spoken and
gender-matched workers on request are both canonical facts. It is placed early rather than
buried near the footer, because for the families this provider exists to serve it is the
reason they chose to enquire.

**The uploaded copy's "reply with your preferred contact time, suburb, plan-management type,
and any language, cultural or support-worker preferences" was cut.** The form already asks for
suburb, preferred language and preferred contact method. Asking again reads as though nobody
looked at what they sent. The rewritten line asks only for what the form does *not* collect:
plan management type and a good time to call.

**The 000 sentence is kept verbatim.** It is a safety statement, not marketing copy.

**Nothing here has been reviewed by a human yet.** It is participant-facing, so Kholoud should
read it before it sends — see `CLAUDE.md`, "Compliance wording is reviewed, not generated."

---

## Blocked — marketing email writes through the connector

**19 Aug 2026.** Email 03 could not be created from this session. Every marketing-email write
through the HubSpot connector is refused with *"You need access to additional permissions to
perform this action"*:

| Attempt | Result |
|---|---|
| `CREATE` a new automated email | permission error |
| `CLONE` email 02 | permission error |
| `UPDATE` email 02's name to its existing value | permission error |

Reads still work — `GET_EMAIL_DETAILS`, `GET_CONTENT`, `LIST_FROM_ADDRESSES` and
`LIST_SUBSCRIPTION_TYPES` all returned normally, and CRM reads are unaffected. The connector's
own capability table reports `MARKETING_EMAIL: write AVAILABLE`, which contradicts what the
API actually does.

This is a **change**, not a standing limitation: email 02 was created and repeatedly edited
through this same connector on 18 Aug 2026. The write scope has been lost since.

Route 2 was taken — email 03 was cloned from 02 in the HubSpot UI by hand. Reconnecting the MCP
server did **not** restore the scope; `CLONE` and `EDIT_CONTENT` were both retried afterwards
and both still failed. It needs a full re-authorisation of the HubSpot connector, not a
reconnect.

Reads are unaffected, which is what made verification possible: `GET_CONTENT`,
`PREVIEW_CONTENT` and `GET_EMAIL_DETAILS` all worked throughout and were how the unsaved-canvas
problem above was caught.

---

## Verified end to end — 19 Aug 2026

One real submission through the live site, `ENQ-2026-287449341380`, contact `346322043349`:

```
recipient:      true
deliveryStatus: DELIVERED
SENT      1787113320662
DELIVERED 1787113323808
```

Every stage confirmed: endpoint → contact, deal, note, task → merge properties → Forms API
enrolment (`hs_marketable_reason_type: FORM_SUBMISSION`) → workflow → email sent and delivered.

### Diagnosing "it enrolled but nothing sent"

Three earlier runs produced a correct CRM record and no email, because **the workflow had not
been switched on**. Worth recording how that was told apart from the analytics lag that made
workflow 01 look broken when it was fine:

- **Per-recipient, not aggregate.** `RECIPIENTS` mode for the email + contact returns
  `recipient: false` versus a full `SENT`/`DELIVERED` timeline. Aggregate counters lag; this
  is a direct read.
- **Compare against a known-good email in the same window.** Email 02 reported
  `totalScheduled: 12` for the same day while email 03 had *no analytics row at all*. That
  rules out the reporting pipeline being behind — one email had data, the other had none.
- **Check the enrolment trigger separately from the send.** `hs_marketable_reason_type:
  FORM_SUBMISSION` on the contact proves the Forms API submission arrived and matched. With
  that confirmed, everything before HubSpot is exonerated and the fault is downstream.

Also note: **re-testing with the same contact proves nothing.** Simple workflows do not
re-enrol a contact who has already been through, so a second submission on the same email
address is silently a no-op. Use a fresh address — a Gmail `+tag` address is a distinct
contact in HubSpot but the same inbox, so it enrols cleanly and still delivers somewhere
readable.

**The form panel's "Update" button updates the form, not the workflow.** The workflow's own
switch lives in the workflow editor. The form's review panel does show workflow state — it
read `● Off` throughout the three failed runs.

---

## Failure modes

Those in workflow 01 §"Failure modes" apply unchanged. Two are specific to this workflow:

| Failure | Consequence | Handling |
|---|---|---|
| Enquirer gave no email | No acknowledgement can send | Expected. Task says to call them |
| Form GUID unset | **Nothing sends, silently** | `not_configured` + HIGH task per enquiry |

The second is the one that would otherwise be invisible. An enquirer who is promised contact
within 2 business hours and hears nothing has no way to tell whether they were ignored or the
system failed — and neither would we, from a log line alone.

---

## Open

- **Copy is unreviewed.** Participant-facing; needs Kholoud.
- **Inbox placement unconfirmed.** The delivery record proves the receiving server accepted
  it, not that it landed outside spam. Email 03 has its own sending reputation to build even
  though the domain is authenticated.
- **`first_response_at`** is not stamped for enquiries any more than for referrals — the
  webhook action that would report an actual send does not exist on Starter. Same accepted
  consequence as workflow 01: the timestamp would evidence dispatch, not delivery.
