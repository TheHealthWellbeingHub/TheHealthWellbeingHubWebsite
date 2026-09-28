# Invoicing — ShiftCare and Support Coordination to Xero

Two runs, both saving **DRAFT** invoices in Xero for a person to check, approve and send:

- **Weekly (Core supports)** — from the ShiftCare roster, every Monday. Below.
- **Monthly (Support Coordination)** — from each client's settings, on the 1st of every month
  for the month just gone. See [Monthly Support Coordination](#monthly-support-coordination).

## Weekly Core supports

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
     - travel: the week's mileage entries added up, at the travel item's price. When a worker
       enters mileage more than once for the same shift, only their **latest** entry counts —
       the later one is a correction (e.g. 78 km then 83 km on one shift counts as 83). Two
       workers on one shift each have their own entry, and both count. **No mileage entered
       by the workers means no travel line** — nothing is estimated or carried over (decided
       28 Sep 2026).
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

- a worker entering mileage more than once for one shift (the latest counts; the email says which km were left out)
- a weekday shift running past 8pm (billed at the weekday daytime rate)
- a sleepover or non-standard shift type, a shared shift, a shift with no worker
- a shift cancelled by the client (billed) — shifts cancelled without charge are left out
- hours on a day with no support item set (left off, and so is that shift's mileage); a support item with no price
- no NDIS number
- public holidays are **not** detected — they're billed at the ordinary day's rate

## Running it by hand

`GET /api/weekly-invoice-draft` with `Authorization: Bearer <XERO_STATUS_TOKEN>`:

- `?dryRun=1` — build and return the invoices only; nothing written, nothing emailed.
- `?start=YYYY-MM-DD&end=YYYY-MM-DD` — a different week (Monday and Sunday).
- `?clientId=<ShiftCare client ID>` — one participant (comma-separate several).

`POST /api/xero?action=create-invoice` `{ clientId, start, end, dryRun }` does one participant.

A week that already has a draft for a participant is left alone. To rebuild a DRAFT after
fixing something (same invoice number), POST `create-invoice` with `"replace": true`. An
approved or paid invoice is never changed.

## Monthly Support Coordination

Set up 28 Sep 2026 from the office's *INVOICES SUPPORT COORDINATION* spreadsheet and the
Support Coordination invoices already in Xero. Support Coordination is billed once a month
and isn't in the ShiftCare roster, so each client's invoice copies their settings exactly.

### How a month works

Decided 28 Sep 2026: Support Coordination is drafted on the **1st of every month at 8am
Brisbane, for the month just gone** — the same way Core is drafted every Monday for the week
just gone. The cron (`vercel.json`) calls `/api/sc-monthly-invoice-draft`, rewritten to
`api/xero.js?action=sc-monthly` because the Hobby plan's 12 functions are all in use. It fires
at 22:00 UTC on the 28th–31st, and only the call that lands on the 1st in Brisbane does
anything.

Each client is billed for **the 1st of the month to their end day**, e.g.
`01/09/2026 - 21/09/2026`, drafted on 1 October. For every active client:

- **Not invoiced yet** → one DRAFT invoice, dated the 1st, due the same day:
  - contact: their plan manager (exact Xero contact name)
  - reference: theirs, e.g. "<First name> SC"
  - one line: `<period>` then their description (name, NDIS number, support item text),
    exactly as saved; quantity = their hours; price = the rate table
    (`07_002_0106_8_3` Support Coordination Level 2)
  - account 201, GST Free Income, Standard theme, number left to Xero.
- **Already invoiced** → left alone. "Invoiced" means a live Xero invoice to that plan
  manager with a line whose period starts on the same day, under the same reference **or**
  naming the client. So an invoice made by hand counts, even with a different reference.
  Deleting a draft in Xero lets the run make it again.
- **On hold, settings missing, or plan ended** → not invoiced; listed in the email.

The office is emailed the drafts and anyone not invoiced. An end day past the month's last
day (e.g. 30 in February) becomes the last day, and the email says so.

### Where the settings live (Supabase)

| Table | Holds | Edited in |
|---|---|---|
| `sc_invoice_clients` | Per client: name, reference, plan manager's Xero contact name, hours a month, period end day, description (every line after the dates), support item, NDIS number, plan end date, active, hold reason, notes | Command Centre → Invoicing → Support Coordination |
| `sc_invoice_drafts` | What the run created (client, period, Xero invoice) | written by the run |

- **Active** off = stopped (e.g. marked "x" on the spreadsheet, plan ended, agency-managed).
- **Hold reason** filled in = paused until someone decides. The reason is shown in the email.
  Clear it to resume.
- **Plan end date**: the run flags a plan ending within 45 days and stops after it ends.

Hours, contacts and wording were copied from each client's latest Xero invoice. Where the
spreadsheet differed, the client's notes say how. Participant details live only in Supabase.
Nothing about a client goes in this repository.

### Running it by hand

`GET /api/xero?action=sc-monthly` with `Authorization: Bearer <XERO_STATUS_TOKEN>`:

- `?dryRun=1` — show what would be drafted; nothing written, nothing emailed.
- `?today=YYYY-MM-DD` — run as if it were that day (it bills the month before). By hand it
  runs on any day, e.g. if the 1st was missed.
- `?clientId=<sc_invoice_clients id>` — one client (comma-separate several).

For a one-off invoice outside the settings (e.g. a backdated month),
`POST /api/xero?action=create-draft` takes `{ contactName | contactId, reference, date,
lines: [{ description, quantity, unitAmount }] }`. Each line starts with its period. It
refuses a period that's already invoiced unless `allowDuplicate: true`.
`GET /api/xero?action=list-invoices&since=YYYY-MM-DD` lists invoices, drafts included.

## Claude: doing the invoices when asked

For a session asked to "do the invoices". The token is `XERO_STATUS_TOKEN` (Vercel env). Always
call `https://www.thehealthwellbeinghub.com` (the bare domain redirects). Every invoice is a
DRAFT, and staff approve and send it.

**Core supports, a week** (Mon–Sun):

1. Dry run: `GET /api/weekly-invoice-draft?start=<Mon>&end=<Sun>&dryRun=1` (add
   `&clientId=` for some). Read the flags: mileage entered twice, shifts past 8pm, no worker,
   cancellations, hours on a day with no support item.
2. Check anything surprising against ShiftCare before creating. The office has caught km errors.
3. Run it without `dryRun`. To rebuild one draft after a fix, POST
   `/api/xero?action=create-invoice` `{ clientId, start, end, replace: true }`.

**Support Coordination, a month:**

1. Dry run: `GET /api/xero?action=sc-monthly&today=<the 1st after the month>&dryRun=1`.
   Each client shows as a draft to make, already invoiced (with the invoice), on hold, or a
   problem.
2. Run it without `dryRun`. It emails the office.
3. Don't spend Xero's 60-calls-a-minute budget on repeated dry runs just before a real run.
   If a result says `429`, wait a minute and run it again. Anything already made is skipped.

**Don'ts:**

- Never draft a period that's already invoiced (approved or paid) to "test". It would bill
  the plan manager twice once approved.
- Never guess hours, NDIS numbers or plan managers. Hold the client (`hold_reason`) and say
  why.
- Differences between the office spreadsheet and Xero go in the client's notes. Xero (what
  was actually billed) is the default until the office says otherwise.
- Write what was done in Command Centre → Invoicing → Notes (`invoicing_notes`).

A one-off invoice outside the settings (a backdated month, an extra line) goes through
`POST /api/xero?action=create-draft`. Find what exists first with
`GET /api/xero?action=list-invoices&since=YYYY-MM-DD` (drafts included; the Xero chat tools
can't see drafts).
