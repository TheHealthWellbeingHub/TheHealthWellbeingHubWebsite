# Workflow 08 — Service cancellation and exit

Same shape as workflows 05 and 06: no public form, because a participant never
self-serves ending their own services — a worker tells Claude it's happening, after
already speaking with the participant. **Every cancellation through this workflow is a
full exit** — decided 25 August 2026, there is no partial version. A participant
keeping some services and dropping one specific service is a different conversation
that this workflow does not attempt to have; if that need ever comes up it is a
separate design question, not a variant of this one.

| | |
|---|---|
| Trigger | Worker tells Claude to send the service cancellation/exit email to a named participant |
| Email | `09-service-cancellation-exit.html` — **Service exit confirmation** |
| Recipient | Participant (or nominee) only — the referrer is never emailed here, decided 25 August 2026 |
| Deal stage | Always moves to `Lost / Not Suitable` (`3607504326`) on send — same stage a decline uses, "in case they come back" rather than a separate terminal stage |
| Built | 25 August 2026 |

---

## The quick form — asked in conversation, not a web form

Claude asks for exactly what the template needs before composing anything. Same
pattern as workflow 06's appointment form: a short, fixed set of questions, asked
once, nothing inferred from a data source that doesn't exist.

| Asked | Required? | Feeds |
|---|---|---|
| Participant name | Yes | Identifies the contact/deal, `{{Participant First Name / Nominee}}` |
| Services being exited | Yes | `{{Service Name}}` — free text; a full exit can name more than one service |
| Reason (neutral) | Yes, pick one | `{{Neutral Reason / At your request}}` and drives the end/cancelled wording below |
| Final service date | Yes | `{{Final Service Date}}` |
| Final scheduled appointment | No — "none" is a valid answer | `{{Date and Time / None}}` |
| Notice received date | Yes | `{{Date}}` |
| Staff member (sign-off) | Yes | `{{Staff Member}}`, both places it appears |

### Reason options, and why the wording is derived, not asked twice

The template's sentence is *"{{Service Name}} will {{end / be cancelled}} effective
{{Final Service Date}}"* — a second, redundant question ("is this ending or being
cancelled?") is not asked. The reason the worker picks decides it, so the form asks
one thing, not two:

| Reason (shown to the worker) | Written into `{{Neutral Reason...}}` | Wording used |
|---|---|---|
| At the participant's request | "At your request" | be cancelled |
| No longer required | "No longer required" | be cancelled |
| Moved outside our service area | "You have moved outside our service area" | end |
| Plan ended or not renewed | "Your plan has ended" | end |
| Other (worker types the reason) | worker's own text | end — the softer default when the reason doesn't fit the other four |

All five stay in the neutral, non-judgemental register CLAUDE.md requires — none of
them assigns fault or describes clinical circumstances. "Other" is free text
precisely so a worker never has to force a real reason into one of the four
canned options, but it still goes out as written, unedited, so it needs the same
care a worker would give writing it directly to the participant.

---

## What Claude does with the answers

1. **Fills the template** with the answers above.
2. **Shows the preview** — per the standard at the top of this document, that means
   the subject line and every attachment stated as text, plus a rendered image of the
   body. This email carries **no attachments**, so the preview states that explicitly
   rather than leaving it to be assumed.
   - Subject: **Confirming your service exit**
   - Preview/preheader text: *"Confirmation of your service cancellation or exit
     arrangements."*
3. **Sends** from the H&W mailbox, once confirmed.
4. **Moves the deal to `Lost / Not Suitable`.** Always — there is no case in this
   workflow where it doesn't, per the 25 August decision above.
5. **Leaves a note** on the participant's contact: reason, final service date, staff
   member, and that the exit email was sent — the same "nothing else is stored
   structurally, so the note is the record" pattern used in 03, 05 and 06.

---

## Edge cases, decided 25 August 2026

**A participant who later comes back.** Not handled specially — `Lost / Not Suitable`
was chosen over a separate terminal stage precisely so a returning participant looks
like any other reopened deal, not a distinct "previously exited" category needing its
own recovery path.

**No referrer notification, ever.** Considered and declined, unlike workflow 03's
change-of-mind case which does reuse `11-referral-outcome-declined.html`. The
difference: a change of mind happens before onboarding, while the referrer is still
actively involved; a service exit can happen long after, when the referrer's role in
the relationship may have ended too. Telling them by default risks disclosing a
former participant's circumstances to someone no longer part of their care. If a
specific case genuinely needs the referrer told, that is a worker's judgement call
made outside this workflow, not something Claude does automatically.

---

## Verification

**Not yet tested.** A preview render was shown to the worker on 24 August 2026 using
fictional values before this form design existed — useful for checking the template's
tone and layout, not a test of the workflow above. Nothing here has gone through a
live or dry run of the actual question-and-send sequence yet.

---

## Open

- **Compliance review.** `09-service-cancellation-exit.html` carries no "approved"
  note — same open item as templates 04, 07, 08, 12 and 13. This is the most
  sensitive email in the library; Kholoud should read the wording and, specifically,
  the five reason options above before this is relied on for a live send.
- **A live send**, once reviewed.
