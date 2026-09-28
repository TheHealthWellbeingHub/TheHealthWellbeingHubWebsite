# Weekly invoicing — ShiftCare to Xero

Built 28 Sep 2026. Replaces the Monday "draft for review" email (which only listed totals) and
the per-client `create-invoice` call that matched Xero contacts by Account Number.

## What happens

Every **Monday 8am Brisbane** (`vercel.json` cron → `api/weekly-invoice-draft.js`), for the
Monday–Sunday week just gone:

1. Read every rostered shift in ShiftCare for the week, with its participants and workers.
2. Read the workers' mileage entries (ShiftCare progress notes, category **mileage**:
   "Added carer mileage of N …") for those shifts.
3. For each participant set up in the Command Centre → **Invoicing**, build one invoice:
   - **Contact:** the participant's plan manager (the Xero contact named in their settings).
   - **Date and due date:** the Monday the run happens (the day after the week ends).
   - **Invoice number:** left out, so Xero gives the next number in its sequence.
   - **Reference:** the participant's fixed reference, e.g. "<First name> Core".
   - **Branding theme:** Standard.
   - **Lines**, each "dates / name / NDIS number / description", quantity × price:
     - weekday hours (Mon–Fri), Saturday hours and Sunday hours, each with the participant's own
       support item. Hours come from the **roster**, not clock-ins (most workers forget to clock
       in). Every worker on a shift counts: two workers for 8 hours is 16 hours.
     - travel: the sum of all mileage entries for the week, at the travel item's price.
   - **Account 201, GST Free Income**, amounts tax exclusive.
4. Save each one in Xero as a **DRAFT**. Nothing is sent to a plan manager.
5. Email the office the list: each draft with its total and a Xero link, anything that needs
   checking, and anyone who had shifts but isn't set up.

Staff open each draft in Xero, check it, then approve and send it.

## Where the settings live (Supabase)

| Table | Holds | Edited in |
|---|---|---|
| `invoice_rates` | NDIS support item number → price (per hour, or per km for travel) | Command Centre → Invoicing → Rate table |
| `invoice_participants` | Per participant: name on invoice, "Ndis Number"/"NDIS" wording, plan manager's Xero contact name, reference, support item + description for weekday / Saturday / Sunday / travel, active | Command Centre → Invoicing |
| `invoice_drafts` | What each run created (participant, week, Xero invoice) | written by the run |

The NDIS number comes from the participant's profile (`participants.ndis_number`). Prices come
from the rate table, **not** ShiftCare's price book (participants are on ShiftCare's Demo Price
Book). Update the rate table when the NDIS price guide changes on 1 July — pricing is a
compliance matter, so a person checks the figures.

Participant details live only in Supabase. Nothing about a participant goes in this repository.

## What the run flags (in the email, it doesn't guess)

- more than one mileage entry on a shift (all are counted)
- a weekday shift running past 8pm (billed at the weekday daytime rate)
- a sleepover or non-standard shift type, a shared shift, a shift with no worker
- a shift cancelled by the client (billed) — shifts cancelled without charge are left out
- hours on a day with no support item set; a support item with no price
- no mileage for the week; no NDIS number
- public holidays are **not** detected — they're billed at the ordinary day's rate

## Running it by hand

`GET /api/weekly-invoice-draft` with `Authorization: Bearer <XERO_STATUS_TOKEN>`:

- `?dryRun=1` — build and return the invoices only; nothing written, nothing emailed.
- `?start=YYYY-MM-DD&end=YYYY-MM-DD` — a different week (Monday and Sunday).
- `?clientId=<ShiftCare client ID>` — one participant (comma-separate several).

`POST /api/xero?action=create-invoice` `{ clientId, start, end, dryRun }` does one participant.

A week that already has a draft for a participant is left alone. To redo it, delete that draft
in Xero and run again.
