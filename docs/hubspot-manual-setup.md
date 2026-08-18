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
