# HubSpot personalisation properties

Every merge field in `email-templates/` now uses HubSpot's own token syntax.
Before any of these templates can send, the custom properties below must exist
on the **Contact** object: ⚙ Settings → Properties → Create property.

Standard properties need no setup — `firstname` is HubSpot's own.

Three values are now hardcoded rather than tokenised, because they are the same
for every recipient and a token would only be a way to get them wrong:
the phone number, `hello@thehealthwellbeinghub.com`, and the 2 business hour
response time.

## Properties to create

| Internal name | Label | Type | Used by |
|---|---|---|---|
| `appointment_date` | Appointment date | Date picker | 05 |
| `appointment_duration` | Appointment duration | Single-line text | 05 |
| `appointment_end_time` | Appointment end time | Single-line text | 05, 06 |
| `appointment_location` | Appointment location | Single-line text | 05 |
| `appointment_start_time` | Appointment start time | Single-line text | 05, 06 |
| `assigned_staff_member` | Assigned staff member | Single-line text | 04, 05, 06, 07, 08, 09, 12 |
| `assigned_staff_role` | Assigned staff role | Single-line text | 04, 06, 12 |
| `complaint_reference` | Complaint reference | Single-line text | 08 |
| `complaint_summary` | Complaint summary | Single-line text | 08 |
| `date_received` | Date received | Date picker | 07, 08 |
| `enquiry_reference` | Enquiry reference | Single-line text | 03 |
| `escalation_contact` | Escalation contact | Single-line text | 08 |
| `exit_reason` | Service exit reason | Single-line text | 09 |
| `exit_verb` | Service exit wording | Single-line text | 09 |
| `feedback_reference` | Feedback reference | Single-line text | 07 |
| `feedback_subject` | Feedback subject | Single-line text | 07 |
| `final_meeting_details` | Final meeting details | Single-line text | 09 |
| `final_service_date` | Final service date | Date picker | 09 |
| `participant_first_name` | Participant first name | Single-line text | 02, 04, 06, 09, 10, 11, 12, 13 |
| `preferred_schedule` | Preferred schedule | Single-line text | 04 |
| `preparation_instructions` | Preparation instructions | Single-line text | 05 |
| `referral_date` | Referral date | Date picker | 02, 10, 11, 13 |
| `referral_outcome_date` | Referral outcome date | Date picker | 10, 11, 13 |
| `referral_reference` | Referral reference | Single-line text | 02, 10, 11, 13 |
| `requested_service` | Requested service | Single-line text | 02, 03, 04, 05, 06, 09, 10, 11, 13 |
| `response_line` | Response line | Single-line text | 07 |
| `service_location` | Service location | Single-line text | 04, 06 |
| `service_start_date` | Proposed service start date | Date picker | 03, 04, 06, 09 |
| `support_details` | Support details | Single-line text | 06 |
| `update_due_date` | Update due date | Date picker | 08 |
| `worker_experience` | Worker experience | Single-line text | 06 |
| `worker_first_name` | Worker first name | Single-line text | 06 |
| `worker_full_name` | Worker full name | Single-line text | 06 |
| `worker_interests` | Worker interests or skills | Single-line text | 06 |
| `worker_languages` | Worker languages | Single-line text | 06 |

## Fallbacks

Every token is wrapped in `personalization_token()` with a default, so an empty
property renders sensible words rather than a blank gap. Preview with
*Preview as a specific contact* before sending — it is the only way to see what
a real record produces.

## Where the values come from

`api/hubspot-submit.js` already writes several of these on submission —
`participant_first_name`, `requested_service` and the reference numbers. The
rest are set by staff on the contact record, or by a workflow, before the
matching email sends.

## One thing to watch

HubSpot resolves these against the **enrolled contact**. In the referral
templates the enrolled contact is the *referrer*, so `firstname` is the
referrer's name and the participant's name has to live in
`participant_first_name` on that same record. Putting participant details on a
separate contact would leave the tokens empty.
