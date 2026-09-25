# Participant documents

The fillable PDFs the Consent and Welcome emails attach (workflow 03). Committed here so
they're available to any session, not only the one that built them.

| File | Attached by | Fields | Source |
|---|---|---|---|
| `The Health & Well-being Hub - Referral Form (Fillable).pdf` | The Consent email (`04-participant-welcome-onboarding.html`) | 53 | H&W-authored |
| `NDIS Consent for Your Information (Fillable).pdf` | The Consent email | 20 | Fillable fields overlaid on the NDIA's own unaltered "Consent for your NDIS information" form — the form content itself is the NDIA's, not ours to edit |
| `The Health & Well-being Hub - Service Agreement (Fillable).pdf` | The Consent email, and the Service Agreement follow-up (`13-service-agreement-followup.html`) | 239 | The 25 Sep 2026 service agreement wording, rebuilt word for word as a branded fillable PDF in the Referral Form's style. Wording changes need a human's sign-off first |
| `Privacy & Confidentiality (Easy Read Guide).pdf` | The Welcome email (`12-welcome-pack.html`) | — | Supplied as finished content |
| `Feedback & Complaints (Easy Read Guide).pdf` | The Welcome email | — | Supplied as finished content |
| `Your Rights & Responsibilities (Easy Read Guide).pdf` | The Welcome email | — | Supplied as finished content |
| `Incident Management (Easy Read Guide).pdf` | The Welcome email | — | Supplied as finished content |

**The Consent email's three attachments are fixed, not optional** — see
`docs/workflow-03-new-participant.md`. Every send carries all three, never a subset.

The four easy-read guides are image-only PDFs (no selectable text, nothing to fill in).

Not served by the site build (`build.py` doesn't touch this directory) — these exist purely
to be attached to emails Claude sends from the H&W mailbox.

## Earlier service agreement (removed 25 Sep 2026)

`NDIS Service Agreement (Fillable).pdf`, built 22 Sep from
`agreement-templates/build_service_agreement.py`, was replaced by the 25 Sep 2026 wording
(`The Health & Well-being Hub - Service Agreement (Fillable).pdf`) on the user's instruction.
The builder script is kept for reference only — running it recreates the superseded wording.
