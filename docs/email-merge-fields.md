# Email merge fields

Three things send these templates:

- **`api/lead-submit.js`** sends 02, 03, 07 and 08 the moment a website form is submitted.
- **The Command Centre** (`command_centre` repo) sends 05 and 06.
- **`api/send-participant-email.js`** sends any template by hand (POST,
  `Authorization: Bearer <SEND_EMAIL_TOKEN>`, body `{ template, to, merge }`), and is the
  only sender for the rest. HubSpot is no longer used.

The field names in 02, 03, 05, 06, 07 and 08 are the ones their automatic senders fill —
don't rename one without changing that sender too.

- `{{Key}}` — required. `send-participant-email.js` refuses to send until a value is given.
- `{{Key|fallback}}` — optional. The fallback text renders when no value is given.
- `{{Phone Number}}`, `{{Email Address}}`, `{{Unsubscribe Link}}` / `{{unsubscribe_url}}` —
  filled by the sender, never by the caller.

Generated from the templates themselves — regenerate if a template's fields change.

## `referrer-introduction` — 01

File `01-referrer-introduction.html` · subject: NDIS Referrals | Health & Well-being Hub

| Field | Required | Fallback |
|---|---|---|
| `First Name` | no | there |

## `referral-received` — 02

File `02-referral-received.html` · subject: Referral received · sent automatically by lead-submit.js (referral form)

| Field | Required | Fallback |
|---|---|---|
| `Referrer First Name` | yes | — |
| `Participant First Name` | yes | — |
| `Reference` | yes | — |
| `Date Received` | yes | — |
| `Service` | yes | — |

## `enquiry-acknowledgement` — 03

File `03-new-enquiry-acknowledgement.html` · subject: We received your enquiry · sent automatically by lead-submit.js (enquiry form)

| Field | Required | Fallback |
|---|---|---|
| `First Name` | yes | — |
| `Service` | yes | — |
| `Reference` | yes | — |
| `Date Received` | yes | — |

## `consent` — 04

File `04-participant-welcome-onboarding.html` · subject: {{Participant First Name}}'s forms and service agreement · attachments: The Health & Well-being Hub - Referral Form (Fillable); NDIS Consent for Your Information (Fillable); The Health & Well-being Hub - Service Agreement (Fillable)

| Field | Required | Fallback |
|---|---|---|
| `Participant First Name` | yes | — |
| `Staff Member` | yes | — |
| `Role` | yes | — |
| `Service` | yes | — |
| `Date` | yes | — |
| `Schedule` | yes | — |
| `Location` | yes | — |

## `appointment-confirmation` — 05

File `05-appointment-confirmation.html` · subject: Appointment confirmed · sent automatically by the Command Centre

| Field | Required | Fallback |
|---|---|---|
| `Participant First Name` | yes | — |
| `Service` | yes | — |
| `Appointment Date` | yes | — |
| `Appointment Start Time` | yes | — |
| `Appointment End Time` | yes | — |
| `Assigned Staff Member` | yes | — |
| `Appointment Location` | yes | — |
| `Appointment Duration` | yes | — |
| `Preparation Instructions` | yes | — |

## `support-worker-introduction` — 06

File `06-support-worker-introduction.html` · subject: Meet your support worker · sent automatically by the Command Centre

| Field | Required | Fallback |
|---|---|---|
| `Worker First Name` | yes | — |
| `Participant First Name` | yes | — |
| `Worker Full Name` | yes | — |
| `Service` | yes | — |
| `Worker Role` | yes | — |
| `Worker Experience` | yes | — |
| `Worker Languages` | yes | — |
| `Worker Interests` | yes | — |
| `Service Start Date` | yes | — |
| `Appointment Start Time` | yes | — |
| `Appointment End Time` | yes | — |
| `Service Location` | yes | — |
| `Support Details` | yes | — |
| `Assigned Staff Member` | yes | — |

## `feedback-acknowledgement` — 07

File `07-feedback-acknowledgement.html` · subject: Feedback received · sent automatically by lead-submit.js (feedback form)

| Field | Required | Fallback |
|---|---|---|
| `First Name` | yes | — |
| `Reference` | yes | — |
| `Date Received` | yes | — |
| `Regarding` | yes | — |
| `Assigned Staff Member` | yes | — |
| `Response Line` | yes | — |

## `complaint-acknowledgement` — 08

File `08-complaint-acknowledgement.html` · subject: Complaint acknowledged · sent automatically by lead-submit.js (complaint form)

| Field | Required | Fallback |
|---|---|---|
| `First Name` | yes | — |
| `Complaint Summary` | yes | — |
| `Reference` | yes | — |
| `Date Received` | yes | — |
| `Assigned Staff Member` | yes | — |
| `Update Due Date` | yes | — |
| `Escalation Contact` | yes | — |

## `service-exit` — 09

File `09-service-cancellation-exit.html` · subject: Service exit confirmation

| Field | Required | Fallback |
|---|---|---|
| `Final Service Date` | yes | — |
| `Start Date` | yes | — |
| `Participant First Name` | no | the participant or their nominee |
| `Service` | no | your supports |
| `Exit Wording` | no | end |
| `Exit Reason` | no | at your request |
| `Final Meeting Details` | no | No final meeting is scheduled. |
| `Staff Member` | no | our team |

## `referral-considering` — 10

File `10-referral-outcome-considering.html` · subject: Referral update

| Field | Required | Fallback |
|---|---|---|
| `Referral Reference` | yes | — |
| `Referral Date` | yes | — |
| `Referral Outcome Date` | yes | — |
| `Participant First Name` | no | the participant |
| `First Name` | no | there |
| `Service` | no | NDIS supports |

## `referral-declined` — 11

File `11-referral-outcome-declined.html` · subject: Referral update

| Field | Required | Fallback |
|---|---|---|
| `Referral Reference` | yes | — |
| `Referral Date` | yes | — |
| `Referral Outcome Date` | yes | — |
| `Participant First Name` | no | the participant |
| `First Name` | no | there |
| `Service` | no | NDIS supports |

## `welcome` — 12

File `12-welcome-pack.html` · subject: Your welcome pack · attachments: Privacy & Confidentiality (Easy Read Guide); Feedback & Complaints (Easy Read Guide); Your Rights & Responsibilities (Easy Read Guide); Incident Management (Easy Read Guide)

| Field | Required | Fallback |
|---|---|---|
| `Participant First Name` | yes | — |
| `Staff Member` | yes | — |
| `Role` | yes | — |

## `referral-going-ahead` — 13

File `13-referral-outcome-going-ahead.html` · subject: Referral update

| Field | Required | Fallback |
|---|---|---|
| `Referral Reference` | yes | — |
| `Referral Date` | yes | — |
| `Referral Outcome Date` | yes | — |
| `Participant First Name` | no | the participant |
| `First Name` | no | there |
| `Service` | no | NDIS supports |

## `service-agreement-followup` — 13

File `13-service-agreement-followup.html` · subject: Sorry, {{Participant First Name}} — your Service Agreement · attachments: The Health & Well-being Hub - Service Agreement (Fillable)

| Field | Required | Fallback |
|---|---|---|
| `Participant First Name` | yes | — |
| `Staff Member` | yes | — |
| `Role` | yes | — |

## `worker-welcome` — 14

File `14-new-support-worker-welcome.html` · subject: Welcome to the team, {{Worker First Name}} · attachments: The Health & Well-being Hub - Support Worker Agreement (Fillable) (from `staff-documents/`) · sent to a new support worker, not a participant

| Field | Required | Fallback |
|---|---|---|
| `Worker First Name` | yes | — |
| `Staff Member` | yes | — |
