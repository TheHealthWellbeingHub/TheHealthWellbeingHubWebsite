# Email merge fields

Every template in `email-templates/` sends through `api/send-participant-email.js`
(POST, `Authorization: Bearer <SEND_EMAIL_TOKEN>`, body `{ template, to, merge }`).
HubSpot is no longer used.

- `{{Key}}` — required. The send is refused until a value is given.
- `{{Key|fallback}}` — optional. The fallback text renders when no value is given.
- `{{Unsubscribe Link}}` — filled by the sender, never by the caller.

Phone number, email address and the 2 business hour response time are written into the
templates directly, because they are the same for every recipient.

Generated from the templates themselves — regenerate if a template's fields change.

## `referrer-introduction` — 01

File `01-referrer-introduction.html` · subject: NDIS Referrals | Health & Well-being Hub

| Field | Required | Fallback |
|---|---|---|
| `First Name` | no | there |

## `referral-received` — 02

File `02-referral-received.html` · subject: Referral received

| Field | Required | Fallback |
|---|---|---|
| `Referral Reference` | yes | — |
| `Referral Date` | yes | — |
| `First Name` | no | there |
| `Participant First Name` | no | the participant |
| `Service` | no | NDIS supports |

## `enquiry-acknowledgement` — 03

File `03-new-enquiry-acknowledgement.html` · subject: We received your enquiry

| Field | Required | Fallback |
|---|---|---|
| `Enquiry Reference` | yes | — |
| `Start Date` | yes | — |
| `First Name` | no | there |
| `Service` | no | NDIS supports |

## `consent` — 04

File `04-participant-welcome-onboarding.html` · subject: {{Participant First Name}}'s forms and service agreement · attachments: referral form, NDIS consent form, service agreement (all fillable)

| Field | Required | Fallback |
|---|---|---|
| `Participant First Name` | yes | — |
| `Staff Member` | yes | — |
| `Role` | yes | — |
| `Service` | yes | — |
| `Start Date` | yes | — |
| `Schedule` | yes | — |
| `Location` | yes | — |

## `appointment-confirmation` — 05

File `05-appointment-confirmation.html` · subject: Appointment confirmed

| Field | Required | Fallback |
|---|---|---|
| `Appointment Date` | yes | — |
| `Start Time` | yes | — |
| `End Time` | yes | — |
| `Duration` | yes | — |
| `Preparation Instructions` | yes | — |
| `First Name` | no | there |
| `Service` | no | your supports |
| `Staff Member` | no | our team |
| `Appointment Location` | no | details to follow |

## `support-worker-introduction` — 06

File `06-support-worker-introduction.html` · subject: Meet your support worker

| Field | Required | Fallback |
|---|---|---|
| `Worker Experience` | yes | — |
| `Worker Languages` | yes | — |
| `Worker Interests` | yes | — |
| `Start Date` | yes | — |
| `Start Time` | yes | — |
| `End Time` | yes | — |
| `Location` | yes | — |
| `Support Details` | yes | — |
| `Worker First Name` | no | your support worker |
| `Participant First Name` | no | the participant |
| `Worker Full Name` | no | your support worker |
| `Service` | no | your supports |
| `Role` | no | your H&W contact |
| `Staff Member` | no | your coordinator |

## `feedback-acknowledgement` — 07

File `07-feedback-acknowledgement.html` · subject: Feedback received

| Field | Required | Fallback |
|---|---|---|
| `Feedback Reference` | yes | — |
| `Date Received` | yes | — |
| `First Name` | no | there |
| `Feedback Subject` | no | your feedback |
| `Staff Member` | no | our team |
| `Response Line` | no | We will be in touch if a response is needed. |

## `complaint-acknowledgement` — 08

File `08-complaint-acknowledgement.html` · subject: Complaint acknowledged

| Field | Required | Fallback |
|---|---|---|
| `Complaint Reference` | yes | — |
| `Date Received` | yes | — |
| `Update Due Date` | yes | — |
| `First Name` | no | there |
| `Complaint Summary` | no | the matter you raised |
| `Staff Member` | no | our complaints officer |
| `Escalation Contact` | no | our Director |

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

File `12-welcome-pack.html` · subject: Your welcome pack · attachments: 4 easy-read guides

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
