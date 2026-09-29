# Support worker shifts through Claude — add, change, cancel

**Decided 29 Sep 2026.** Staff can ask any Claude chat that has the ShiftCare connector to add,
look up, change or cancel a support worker's shift — e.g. *"Book Sahaal with Cody on Tuesday
10–3"*, *"Move Friday's visit to 11"*, *"Swap Merzouq for Ramshah on Saturday"*, *"Cancel
Warren's shift tomorrow"*. ShiftCare is where shifts live; Claude works on them there, through
the ShiftCare connector. Nothing about a shift is written anywhere else.

Two rules the user set:

- **Read back, then "yes".** Claude never writes to ShiftCare until it has read the exact change
  back and the staff member has said yes to it.
- **Cancelling: ask every time** whether the client cancelled (the client is billed and the
  worker is paid) or we cancelled (no charge, not paid). ShiftCare's API cannot delete a shift;
  "delete" means cancel. To remove a shift entirely, staff delete it in the ShiftCare app.

The ShiftCare skills `shiftcare-create-shift` and `shiftcare-cancel-shift` carry the general
mechanics (resolving names to ids, time zones, conflicts, read-back). This page is what H&W adds
on top.

## Which ShiftCare tool

| Request | Tool |
|---|---|
| One shift | `create_shift` |
| A repeating shift ("every Tuesday and Thursday until Christmas") | `create_recurring_shift` |
| Find shifts ("what's Sahaal on this week?") | `list_shifts` (date range, or `staff_id` / `client_id`) |
| Change one shift — time, worker, notes, address, type | `update_shift` (send only what changes) |
| Change every shift in a series from a date on ("from now on start at 10") | `update_shift_recurrence_details` |
| Change which days a series repeats on, or when it ends | `update_shift_recurrence_pattern` — it rebuilds the series, so every shift id changes; say so in the read-back |
| Client cancelled | `cancel_shift_with_charge` with the NDIS no-show code: NSDH health, NSDF family, NSDT transport, NSDO other |
| We cancelled | `cancel_shift_without_charge` with the reason |

`update_shift` replaces the whole worker list when `staff_ids` is sent — include every worker who
should stay on the shift. An invoiced shift can't be changed (ShiftCare refuses it), and a
cancelled shift can't be edited.

## Checks before the read-back

Do these, then put anything they find in the read-back so the staff member decides with it in
front of them. They are warnings, not blocks, unless marked.

1. **Participant.** Find them with `list_clients`. If the Command Centre shows them **Exited**
   (Supabase `participants.status`), stop: say so and don't book.
2. **Worker.** Find them with `list_staff`. Check their documents in Supabase
   (`support_workers.documents_status` / `documents_missing`): if it's `documents_required`,
   `expired` or `expiring`, name what's missing or expiring in the read-back.
3. **Clashes.** `list_shifts` for the worker over whole days — the shift's day and the day before
   (a filter on start time misses overnight shifts). Any overlap goes in the read-back.
4. **Times.** Brisbane, UTC+10, no daylight saving — always send `+10:00`. If the end is before the
   start on the same day, ask whether it's an overnight shift before doing anything.
5. **Shift type.** Personal Care (`standard`) unless asked. Others on this account: Domestic
   Assistance, Respite Care, Transport, Night Shift, Sleepover, Support coordination, 24 Hour
   Care, On Call, Client Expense. A sleepover also sets `sleepover: true` — and no worker has a
   sleepover pay rate yet, so their week will show *Rate missing* on the Pay list until one is
   added.
6. **Address.** The participant's address from ShiftCare (`get_client`), unless told otherwise.
7. **Will it be invoiced?** In Supabase `invoice_participants` (Command Centre → Invoicing), the
   participant needs to be set up, active, with a support item for that day — weekday, Saturday
   or Sunday. If not, say the shift **won't appear on the Monday Xero draft** until it's set up.
8. **Changing or cancelling a past shift.** If that week's pay list already exists
   (`pay_breakdowns` for the week), say *Recalculate from ShiftCare* is needed on the Pay page
   afterwards. If the worker is already marked **Done** for that week, their invoice has been
   emailed — say it won't change.
9. **Notify the worker?** Ask, defaulting to yes for a new or moved shift (ShiftCare sends the app
   notification).

## The read-back

One short block, then ask for yes. For example:

> **Add this shift?**
> Tuesday 6 October, 10:00am–3:00pm (5 hours)
> Participant: Cody S. · Worker: Sahaal Yusuf · Personal Care
> Address: (from ShiftCare) · Notify Sahaal: yes
> ⚠ Sahaal's documents: police check missing.
> Reply **yes** to book it.

For a change, show what changes from → to. For a cancel, say which kind and what it means:
*"client cancelled — Cody is billed and Sahaal is paid"* or *"we cancelled — no charge, Sahaal not
paid"*.

## After "yes"

Write once, then read the shift back from ShiftCare (`list_shifts` with its id, or with
`program_id` for a series) and confirm what's now there, with the ShiftCare link. If ShiftCare
refused it, say what it said — never report a change that wasn't confirmed.

Nothing else needs updating: the Command Centre reads shifts from ShiftCare, the Monday Xero
drafts and the Monday pay list read the roster, and the 15-minute sync doesn't touch shifts.

## When a worker is mid-task

The standing instruction in CLAUDE.md applies: tell them only the next step. For a shift that's
usually just the read-back and "Reply yes to book it".
