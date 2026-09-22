# Participant documents

The fillable PDFs the Consent and Welcome emails attach (workflow 03). Committed here so
they're available to any session, not only the one that built them.

| File | Attached by | Fields | Source |
|---|---|---|---|
| `The Health & Well-being Hub - Referral Form (Fillable).pdf` | The Consent email (`04-participant-welcome-onboarding.html`) | 53 | H&W-authored |
| `NDIS Consent for Your Information (Fillable).pdf` | The Consent email | 20 | Fillable fields overlaid on the NDIA's own unaltered "Consent for your NDIS information" form — the form content itself is the NDIA's, not ours to edit |
| `Privacy & Confidentiality (Easy Read Guide).pdf` | The Welcome email (`12-welcome-pack.html`) | — | Supplied as finished content |
| `Feedback & Complaints (Easy Read Guide).pdf` | The Welcome email | — | Supplied as finished content |
| `Your Rights & Responsibilities (Easy Read Guide).pdf` | The Welcome email | — | Supplied as finished content |
| `Incident Management (Easy Read Guide).pdf` | The Welcome email | — | Supplied as finished content |
| `NDIS Service Agreement (Fillable).pdf` | Not wired into an email yet — see below | 121 | H&W-branded rebuild of the standard NDIS Service Agreement (Parties, Payments, Cancellation Policy, Schedule of Supports, Emergency Management Plan, etc.), same design system as the Support Worker Agreement |

**The Consent email's two attachments are fixed, not optional** — see
`docs/workflow-03-new-participant.md`. Every send carries both, never just one.

Not served by the site build (`build.py` doesn't touch this directory) — these exist purely
to be attached to emails Claude sends from the H&W mailbox.

## NDIS Service Agreement (Fillable).pdf

Built from `agreement-templates/build_service_agreement.py` (reportlab, same brand
fonts/palette as the NDIS Support Worker Agreement template). Regenerate after editing the
script with:

```
cd participant-documents/agreement-templates
python3 build_service_agreement.py
```

It writes the PDF one directory up, overwriting `NDIS Service Agreement (Fillable).pdf`.
Not currently attached by any automated send — `04-participant-welcome-onboarding.html`
(the Consent email) only carries the Referral Form and the NDIS Consent form. If this
should also go out automatically, it needs adding to `send-participant-email.js`'s
`TEMPLATES.consent` attachment list (and to the email's stated contents).
