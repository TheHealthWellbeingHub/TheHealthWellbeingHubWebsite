# Reference email templates

A second design family for the H&W lifecycle emails, supplied by the user on
24 Aug 2026 and kept here **as reference, not as the live set**.

The live templates remain the nine `01-`–`09-` files in `email-templates/`.
Nothing here is wired to HubSpot.

## What is here

| File | Live counterpart |
|---|---|
| `02-referral-received.html` | `../02-referral-received.html` |
| `03-new-enquiry-acknowledgement.html` | `../03-new-enquiry-acknowledgement.html` |
| `04-participant-welcome-onboarding.html` | `../04-participant-welcome-onboarding.html` |
| `05-appointment-confirmation.html` | `../05-appointment-confirmation.html` |
| `07-feedback-acknowledgement.html` | `../07-feedback-acknowledgement.html` |

## How this family differs from the live set

|  | Reference | Live |
|---|---|---|
| Wordmark | "H & W" in Georgia, with a HEALTH & WELL-BEING lockup | Full business name on a purple bar |
| Hero | Cream-to-lilac-to-green gradient, centred | Solid purple gradient header |
| Container | 640px | 600px |
| Outlook | no MSO conditionals | MSO conditionals + `PixelsPerInch` |
| Merge fields | `{{Referrer First Name}}` — Title Case, spaces | `{{first_name}}` — snake_case |

Neither is "the right one". The reference family is warmer and more editorial;
the live family is more robust in Outlook and already carries the approved
2-business-hour copy.

## Three things to fix before any of these is sent

These are not style opinions — each one breaks at send time.

1. **Merge fields will not resolve.** `{{Referrer First Name}}` is not valid in
   HubSpot, which needs its own token syntax. Every field in every file here needs
   deliberate conversion — see the note in `CLAUDE.md`. A token that does not
   resolve renders as literal braces to the recipient.

2. **The unsubscribe link is wrong for HubSpot.** These use `{{unsubscribe_url}}`;
   HubSpot expects `{{ unsubscribe_link }}`. This was already corrected once in
   `campaigns/2026-08-referrer-outreach.html`.

3. **`07-feedback-acknowledgement.html` contains an authoring instruction**, not a
   merge field:

   ```
   {{Choose One: No response was requested… / We will contact you by {{Response Date}}…}}
   ```

   That renders verbatim to the participant. It has to become a real branch or a
   single chosen sentence before use.

## Numbering

The file supplied as feedback acknowledgement was named `08…` upstream. In this
repo feedback is **07** and complaint is **08**, and it is stored under 07 to match.
The `01-`–`09-` scheme is the one convention for this directory — see `CLAUDE.md`.

## Compliance

Participant-facing wording here has **not** been reviewed. Compliance and
operational language is checked against H&W's approved policies and current NDIS
requirements before production use — Claude drafts, a human approves.
