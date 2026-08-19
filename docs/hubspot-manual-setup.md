# HubSpot manual setup — what must be done by hand

Claude Code's HubSpot connector can read schema and read/write **records**, but it has no
tool that creates or edits **property definitions**. Everything in this file must be done in
the HubSpot UI by a person. Verified 18 Aug 2026 against portal 443542186.

Settings → Data Management → Properties → Create property.

---

## Why merge properties live on the REFERRER, not the participant

`workflow-01-referral.md` §"Behind the scenes" step 3 says the email's merge values are
written on the **participant** contact. That is wrong, and it fails silently.

The acknowledgement (template 02) is sent to the **referrer**. Enrolment happens through the
Forms API submission, and the `email` field in that submission decides which contact is
enrolled. HubSpot marketing personalisation resolves tokens against the **enrolled** contact.

So every token in template 02 must resolve against the *referrer's* record. Values stored on
the participant render **blank** — the email sends, looks fine to the system, and arrives with
empty fields. Exactly the silent-failure class this workflow is designed to avoid.

Consequence for naming: these fields describe *the most recent referral this person
submitted*, so they are prefixed `latest_referral_`. Naming them `participant_first_name` on
a referrer's record would be actively misleading to anyone reading the CRM.

**Known limitation:** they hold the *latest* referral only. If the same referrer submits twice
within the send window, the second overwrites the first before the first email renders. The
window is minutes and the blast radius is one wrong name in one acknowledgement. Accepted on
Starter; revisit if referral volume per partner rises.

---

## Tier 1 — blocks the marketing email build (4 properties)

Create these first. Nothing else unblocks template 02.
Object: **Contact**. Group: suggest a new group "Referral acknowledgement".

| Internal name | Label | Field type |
|---|---|---|
| `latest_referral_participant_name` | Latest referral — participant name | Single-line text |
| `latest_referral_reference` | Latest referral — reference | Single-line text |
| `latest_referral_date` | Latest referral — date received | Date picker |
| `latest_referral_service` | Latest referral — service requested | Single-line text |

`latest_referral_service` is **text, not a dropdown** — it renders a human-readable summary of
possibly several service lines into one sentence in the email. The structured, reportable
version is `service_lines_required` in Tier 3.

HubSpot derives the internal name from the label. Set the internal name **explicitly** to the
value above — the auto-derived one will not match and the endpoint writes by internal name.

---

## Tier 2 — blocks the endpoint rewrite (3 properties)

From `workflow-01-referral.md` §A. Object: **Contact**.

| Internal name | Label | Field type | Options |
|---|---|---|---|
| `referrer_role` | Referrer role | Dropdown | Support Coordinator · Plan Manager · GP · Allied health professional · NDIA planner / LAC · Other |
| `contact_type` | Contact type | Dropdown | Participant · Referral partner · Family or carer · Other |
| `referrer_wants_updates` | Referrer wants updates | Single checkbox | — |

---

## ⚠️ Before creating Tier 3 — the form and the spec use different words

The option values in `hubspot-configuration.md` §1 do **not** match what the live forms send.
Creating the properties exactly as specified and pointing the endpoint at them would fail:
HubSpot rejects an **entire** property write if one enumeration value is not a valid option, so
a single mismatch blanks every field in that write.

| Form sends | §1 option | Difference |
|---|---|---|
| `Agency managed` | `Agency-managed` | hyphen |
| `Plan managed` / `Self managed` | `Plan-managed` / `Self-managed` | hyphen |
| `Not sure` | `Unknown` | different word |
| `Arabic — العربية` | `Arabic` | native-script suffix |
| `NDIS Participant` | `Participant themselves` | different phrasing |
| `GP / Health professional` | `Health professional` | different phrasing |
| `Parent / Family member / Carer` | `Family member` **or** `Carer` | one field, two options |
| `Multiple / not sure` | *(no option)* | means "still open", not a value |

**Resolved in code, not by changing the forms.** `api/hubspot-submit.js` holds an explicit
mapping table. The form wording stays plain because participants and families read it; the
property vocabulary stays NDIS-standard because reporting uses it. The table is where the two
meet — update it if either side changes.

Two deliberate non-mappings:

- **`Parent / Family member / Carer` is left unmapped.** The form conflates two options that
  carry different privacy weight — a parent and a paid carer are not the same relationship, and
  authority to act differs. Guessing would put wrong data in a field used to decide who may
  receive participant information. A person sets it.
- **`Multiple / not sure` is left unmapped.** "The question is still open" is not the same as
  any particular value, and recording it as one would hide that a conversation still needs to
  happen.

### These properties populate themselves once created

The endpoint reads the live contact schema once per cold start and writes only properties that
exist, dropping any enumeration value that is not a valid option. So:

- It is safe to run **before** any Tier 3 property exists — nothing is written, nothing fails.
- Each property **starts populating the moment you create it in HubSpot**. No redeploy.
- A renamed option or edited form value causes that one field to be skipped and logged, not a
  failed submission.

Create them in any order, at whatever pace suits.

---

## Tier 3 — the full `hubspot-configuration.md` §1 spec (16 properties)

Not blocking anything today. Worth doing while the portal is near-empty — retrofitting these
across live participant records later is slow and has to be done by someone who remembers what
each record meant.

Object: **Contact**.

### Language and communication
| Internal name | Label | Field type | Options |
|---|---|---|---|
| `primary_language` | Primary language | Dropdown | English · Arabic · Somali · Dari · Amharic · Other |
| `primary_language_other` | Primary language (other) | Single-line text | — |
| `interpreter_required` | Interpreter required | Dropdown | No · Yes · Unknown |
| `gender_matched_worker` | Gender-matched worker | Dropdown | No preference · Female worker required · Male worker required |

### NDIS plan
| Internal name | Label | Field type | Options |
|---|---|---|---|
| `ndis_plan_status` | NDIS plan status | Dropdown | Active plan · Plan pending · No plan or unsure · Not an NDIS participant |
| `plan_management_type` | Plan management type | Dropdown | Agency-managed · Plan-managed · Self-managed · Unknown |
| `ndis_plan_end_date` | NDIS plan end date | Date picker | — |
| `service_lines_required` | Service lines required | Multiple checkboxes | Support Coordination · Core Supports & Daily Living · Community Participation · Therapy Services |

### Who is enquiring
| Internal name | Label | Field type | Options |
|---|---|---|---|
| `enquirer_relationship` | Enquirer relationship | Dropdown | Participant themselves · Family member · Carer · Plan nominee · Guardian or legal decision-maker · Support coordinator · LAC · Health professional · Other |
| `authority_to_act` | Authority to act | Dropdown | Participant · Plan nominee · Guardian or legal decision-maker · Not yet established |

### Location and service footprint
| Internal name | Label | Field type | Options |
|---|---|---|---|
| `service_suburb` | Service suburb | Single-line text | — |
| `service_region` | Service region | Dropdown | Logan · Brisbane · Other South East Queensland · NSW · VIC · WA · Other |

### Enquiry handling
| Internal name | Label | Field type | Options |
|---|---|---|---|
| `enquiry_type` | Enquiry type | Dropdown | New enquiry · Referral · Complaint · Feedback · General question |
| `enquiry_received_at` | Enquiry received at | Date and time | set by automation only |
| `first_response_at` | First response at | Date and time | set by automation only |
| `referral_source_detail` | Referral source detail | Single-line text | — |

---

## Already-existing custom properties — decide before creating overlaps

The portal already has these, created earlier under a different naming scheme:

| Existing | Overlaps with |
|---|---|
| `preferred_support_type` | `service_lines_required` |
| `primary_goal` | — (no conflict) |
| `ndis_plan_review_date` | `ndis_plan_end_date` — *review* and *end* are different dates; confirm which is meant |
| `referral_outreach_status` | `acknowledgement_status` (deal, planned) |

Creating the Tier 3 set without deciding these leaves two fields meaning nearly the same
thing, which is how CRMs rot. Not urgent — none of them block Tier 1.

---

## Deal properties — deferred

`acknowledgement_status` (pending · sent · failed · suppressed) and the structured lost-reason
dropdown are in `hubspot-configuration.md` §2 and `workflow-01-referral.md`. Neither blocks the
email. Create after Tier 1 and 2.

---

## Not doable by hand here, and not needed yet

- **Workflow wiring** — Workflows API is Professional+. Simple workflow built in the UI.
- **Domain verification** — in progress via Entri, up to 48h. Blocks *sending*, not building.
  Until it verifies, the only from-address in the portal is `thehealthwellbeinghub@gmail.com`.

---

## Built — marketing email 02 (18 Aug 2026)

| | |
|---|---|
| Name | `02 — Referral received (acknowledgement)` |
| Marketing email object ID | `708868075963` |
| Content ID (editor URL) | `367062870493` |
| Editor | https://app-ap1.hubspot.com/email/443542186/edit/367062870493 |
| Type | **AUTOMATED** (permanent — required for workflow enrolment) |
| Subscription type | Referral acknowledgements (`3428566311`) |
| Reply-to | `thehealthwellbeinghub@gmail.com` — swap when a branded address exists |

Tokens bound, all verified rendering against real contact properties:

| Template token | HubSpot token |
|---|---|
| Referrer first name | `{{ contact.firstname }}` |
| Participant | `{{ contact.latest_referral_participant_name }}` |
| Reference | `{{ contact.latest_referral_reference }}` |
| Date received | `{{ contact.latest_referral_date }}` |
| Requested support | `{{ contact.latest_referral_service }}` |

### Portal settings this email depends on

Both were wrong or missing and have been corrected. Neither is obvious from the email itself.

- **Timezone** was `US/Eastern`; now `Australia/Brisbane`. Every timestamp the referral workflow
  writes, and the date rendered in this email, keyed off it. A 14-hour error.
- **Footer address** did not exist, so the footer rendered `, , ,`. It is configured under
  *Settings → Marketing → Email → Configuration → Footer addresses*, **not** under Account
  Defaults → Company Information. Filling the latter does not fix the former.

### Still outstanding for this email

- **From address is `@gmail.com`.** The sending domain is authenticated, but a gmail.com from
  address cannot be DKIM-aligned to `thehealthwellbeinghub.com`, so the authentication does not
  apply to what actually sends. Needs a branded address — which needs a mailbox, which needs an
  **MX record** the domain does not currently have.
- Currency is still `USD`; should be `AUD`. Affects deal reporting, not this workflow.

---

## Date format — open defect (18 Aug 2026)

`latest_referral_date` is a HubSpot **date** property, so HubSpot renders it using the portal's
locale. It currently renders **US format**:

```
Date received: 08/18/2026
```

Today's date is unambiguous, but `05/08/2026` reads as **8 May** to an Australian recipient and
**5 August** to HubSpot. Referral acknowledgements go to Support Coordinators and health
professionals who may act on that date.

HubL date filters cannot fix this: the marketing email rich-text module **strips HubL logic**,
keeping only bare `{{ contact.property }}` tokens. Three approaches were tried
(`personalization_token` with a default, the `default` filter, and `{% if %}/{% else %}`) — all
were removed by the sanitiser. Token *defaults* had to be set through the editor UI for the
same reason.

Two ways to fix, neither applied yet:

1. **Change the portal date format** so dates render day-first. One setting, affects everything
   in the portal. Still numeric, so `08/05/2026` remains harder to read than a written month.
2. **Change `latest_referral_date` to a single-line text property** and have the endpoint write
   a preformatted string — `18 August 2026`. Unambiguous in any locale, and takes the rendering
   decision away from HubSpot entirely. Costs a property change plus an endpoint change.

Option 2 is the more robust and is the recommendation, but it is a schema change and has not
been made without a decision.

### Resolved 18 Aug 2026 — option 2 applied

`latest_referral_date_display` was created as a single-line text contact property, and the
*Date received* token in marketing email 02 was repointed to it.

Both properties are now written on every referral, deliberately:

| Property | Type | Value | Purpose |
|---|---|---|---|
| `latest_referral_date` | Date | `2026-08-19` | filtering, sorting, reporting |
| `latest_referral_date_display` | Text | `19/08/2026` | what the referrer reads |

Verified: the email renders `Date received: 19/08/2026`. Both values are computed in
`Australia/Brisbane`, so a late-evening UTC submission carries the correct local date rather
than the previous day's.

---

## Deliverability — resolved 18 Aug 2026

The acknowledgement initially landed in **spam**. Cause was the sender identity, not the content.

HubSpot cannot send as `@gmail.com`, so it rewrote the from-address onto its own shared
domain: `thehealthwellbeinghub.gmail.com@hubspotstarter.net`. Three problems at once — no DKIM
alignment with the authenticated domain, shared reputation with every other Starter portal, and
the literal string `gmail.com` inside a from-address on another domain.

### What was built

| Piece | Value |
|---|---|
| Mailbox | `hello@thehealthwellbeinghub.com` (Google Workspace) |
| MX | `1 smtp.google.com` |
| Google DKIM | `google._domainkey` published |
| HubSpot DKIM | `hs1-443542186._domainkey` / `hs2-443542186._domainkey` |
| DMARC | `v=DMARC1; p=none;` |
| From address | `hello@thehealthwellbeinghub.com` (HubSpot custom address) |

### The SPF trap

Adding Google Workspace did **not** update SPF. The record still read:

```
v=spf1 include:443542186.spf03.hubspotemail.net -all
```

`-all` is a hard fail and Google was not listed, so every message sent from the new mailbox —
including ordinary replies to referrers — would have failed SPF. Corrected to:

```
v=spf1 include:_spf.google.com include:443542186.spf03.hubspotemail.net -all
```

**One SPF record only.** A second `v=spf1` record produces a permerror and breaks
authentication for *both* senders.

### Result

Live test 3 (`REF-2026-TEST03`): `SENT → DELIVERED → OPENED`, **primary inbox**, first send from
a new domain.

### Naming convention

`hello@` is the single sending identity for all nine lifecycle templates. Per-purpose addresses
(`referrals@`, `enquiries@`) should be **aliases onto the same mailbox**, not separate mailboxes
— one sending reputation rather than several weak ones.

**Complaints are the exception.** Give `complaints@` its own mailbox when the complaints
pipeline is built: separate retention and access control, because that pipeline carries the
NDIS Commission obligation and may need to be produced at audit.

---

## Verified end to end — 18 Aug 2026

Three live submissions through the production Forms API confirmed the full chain:

```
Forms API POST  →  contact enrolled (recent_conversion_event_name set, marketable)
                →  simple workflow fires
                →  internal notification to thehealthwellbeinghub@gmail.com
                →  acknowledgement to the referrer, tokens populated
                →  DELIVERED to primary inbox
```

**What this does not yet cover:** `api/hubspot-submit.js` never calls the Forms API and never
writes the `latest_referral_*` properties. Every test above was driven by hand. A real referral
from the website still creates CRM records and triggers **nothing**. That endpoint work is the
remaining gap between this and production.

---

## Endpoint verified against the live code path — 18 Aug 2026

Tested on a Vercel preview deployment of `claude/hub-referral-workflow-rf1eff`, posting the
real form field names to `/api/hubspot-submit`.

```
{"ok":true,"contactId":"346217563599","dealId":"287467383245",
 "reference":"REF-2026-287467383245","isReturning":false,
 "acknowledgementStatus":"pending"}
```

Verified on the referrer contact (`346162890207`), which is the record the acknowledgement
merges from:

| Property | Value |
|---|---|
| `firstname` / `lastname` | `Bambang` / `Durrani` — name split correct |
| `company` | `Test Health Service` |
| `latest_referral_participant_name` | `Test Participant Four` |
| `latest_referral_reference` | `REF-2026-287467383245` |
| `latest_referral_service` | `Support Coordination` |
| `latest_referral_date` | `2026-08-19` — Brisbane date, not UTC |
| `recent_conversion_event_name` | `Refer a participant: Referral — API target` |

The last row is the important one: it proves the endpoint's Forms API call registered a genuine
form conversion, which is the only workflow enrolment trigger Starter offers.

### Duplicate-contact fix confirmed

Submitting the identical payload twice returned the **same** contact and deal, with
`isReturning` flipping to `true`. `participant_contact` held a phone number, which is the case
that previously fell through to `findContactByEmail(undefined)` and created a new contact and
deal on every submission.

### Preview environment credential

`HUBSPOT_TOKEN` was Production-scoped only, so every preview deployment had a non-functional
form endpoint — no form change could be tested before going live. A Preview-scoped copy now
exists. Note that Vercel will not let a **Sensitive** variable's environment scope be edited
after creation; a second entry scoped to Preview is the way to do this without touching the
working Production credential.

---

## Abuse protection — added and tested 18 Aug 2026

| Guard | Result | How verified |
|---|---|---|
| Origin allowlist | `403` | POST with `Origin: https://evil.example.com` |
| Honeypot (`company_website`) | `200`, discarded | POST with the field filled; response carried no `contactId`, so nothing was written |
| Payload cap (20KB) | `413` | 25KB body |
| Per-IP rate limit | ⚠️ **logic verified, deployment not** | see below |
| Legitimate submission | `200`, contact and deal reused | full referral payload after hardening |

### The rate limit is the weakest layer, and this is not a formality

The limit (5 per 10 minutes) was **not** verified against the deployment. Seven rapid posts all
returned `200`, and the runtime logs show why: each arrived from a different source IP —
`160.79.106.128`, `.131`, `.136`, `.137` — because the test traffic egressed through a rotating
proxy pool. The guard behaved correctly; it saw seven distinct clients.

The logic itself was verified in isolation: the sixth request from one IP is blocked, other IPs
are unaffected.

**The accident is the lesson.** A per-IP limit was bypassed without trying, by ordinary
infrastructure. Anyone deliberately rotating IPs evades it just as easily. Two further
limitations compound it:

- The bucket is **in-memory**, so it is per serverless instance. Concurrent instances each keep
  their own count and share nothing.
- Nothing persists across cold starts.

So the ordering of the layers by real value is: **honeypot** (stops naive bots) > **origin
allowlist** (stops casual cross-site embedding) > **rate limit** (bounds a single-source flood
only). None stops a determined attacker.

If real abuse appears, the fix is a shared store — Vercel KV or Upstash — keyed by IP, plus
Cloudflare Turnstile on the form. Both were considered out of scope for this change; neither is
warranted before abuse is actually observed.
