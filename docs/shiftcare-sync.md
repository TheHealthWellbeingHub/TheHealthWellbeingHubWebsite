# ShiftCare ↔ Command Centre sync

**Live since 28 Sep 2026.** Keeps ShiftCare and the Command Centre's Supabase copy in step, both
ways, every 15 minutes. Code: `lib/shiftcare-sync.js` in the `command_centre` repo, run by
`/dashboard/api/cron/sync`.

## What runs it

| Schedule | Where | Why |
|---|---|---|
| Every 15 minutes | Supabase `pg_cron` job `shiftcare-sync` → `pg_net` GET to the route | Vercel's Hobby plan allows only daily cron jobs |
| Daily, 17:00 UTC (3am Brisbane) | Vercel cron in the Command Centre's `vercel.json` | Backup, if the Supabase job ever stops |

Both send `Authorization: Bearer <CRON_SECRET>`. The secret is the `CRON_SECRET` env var on the
`hub-command-centre` Vercel project and the Vault secret `cron_sync_secret` in Supabase — same
value, never in git. The route is the only path past the Command Centre's login, and only with
that header. `?dry=1` reports what would change without writing; `?only=participants|staff|documents`
runs one part.

Check it's running: `select * from cron.job_run_details order by start_time desc limit 5;` and
`participants.synced_at` (every participant is stamped on each run).

## What it syncs

**Participants — identity, contact and status only.** Name, preferred name, date of birth, address
(and suburb/state derived from it), postcode, phone, mobile, email, NDIS number, status
(Active ↔ `active`, On Hold ↔ `inactive`, Exited ↔ `lost`). Clinical and risk fields are never
synced — they stay on the propose → sign-off → promote path (`command-centre-participant-data.md`).

ShiftCare clients have no "last updated" time, so each participant row keeps
`shiftcare_snapshot` — ShiftCare's values as last seen. Per field, each run:

| Situation | What happens |
|---|---|
| Same both sides (ignoring format: case, spaces, phone punctuation, "Rd" vs "Road") | Nothing |
| Changed in ShiftCare | Copied to the Command Centre. ShiftCare wins if both changed |
| Changed only in the Command Centre | Written to ShiftCare (`PUT /v3/clients`, id in the body) |
| Cleared in the Command Centre | Restored — ShiftCare's API can't clear a field; clear it in ShiftCare |
| First run, one side blank | The blank side is filled from the other |
| First run, both set and different | **Held**: neither overwritten; one *Check details — ShiftCare and the Command Centre differ* task per participant. Released once both sides match |
| ShiftCare refuses a value (400/422) | Held, with the reason in `sync_log` |
| ShiftCare refuses the call itself | Nothing recorded; retried next run |

Plan management is **not** synced: ShiftCare's client `type` reads "Self Managed" for nearly
everyone (its default), while the Command Centre's value comes from the plan documents.

A new ShiftCare client becomes a new participant row. A participant no longer in ShiftCare gets one
*Not in ShiftCare any more* task. A rename also updates the participant's referral, and raises a
task to update the invoice name and Xero contact if they're invoiced. ShiftCare sandbox records
(names starting `ZZTEST`) are skipped.

**Staff** — ShiftCare → `support_workers` (new, changed by `updated_at`, and inactive when gone).
Pay rates and compliance columns are never touched.

**New support workers (from 28 Sep 2026), whatever created them** — Command Centre Staff → New
(adds the row at once), straight in ShiftCare, or Claude's ShiftCare tool (the sync adds the row):
the row gets `auto_onboard`, then `lib/worker-onboarding.js` sends **email 14, "Welcome to the team"**
once (signed Ibrahim Zakariya, Support Worker Agreement attached; logged in `sent_emails`), and
adds them to **Xero Payroll** as an employee through the website's
`/api/xero?action=payroll-employee` — once their date of birth and home address are in ShiftCare,
since Xero requires both. Until then `support_workers.xero_note` says what's missing and every run
retries. Workers already on file were never flagged, so they're never emailed. No follow-up task
(user's choice). `/dashboard/api/cron/health` (same secret) is a read-only check that ShiftCare,
email and Xero Payroll are reachable — confirmed all three on 28 Sep 2026.

**Required documents (from 28 Sep 2026)** — `lib/worker-documents.js`, every run: each active
worker's ShiftCare staff files (and qualifications) are matched, by file name, to the 11 documents
in the welcome email (Yellow Card, Blue Card, driver's licence, passport, first aid and CPR, car
insurance, vehicle registration, Queensland police check, 100 points of ID — met by a passport
plus a driver's licence — infection control, and the NDIS training module certificate). Results go
to `worker_documents` (one row per worker per document, with its expiry date) and
`support_workers.documents_status`: `documents_required` (anything missing), `expired`,
`expiring` (within 7 days) or `complete`, shown on the staff list and the profile's *Required
documents* panel. Expiry dates come from the ShiftCare file, or are typed on the profile (a typed
date stands unless ShiftCare later has a later one). A reminder task linked to the worker
(`tasks.support_worker_id`) is raised a week before a document expires, and when it has; never
twice. Accounts that aren't support workers have `requires_documents = false`. First run: 7 active
workers checked, all 7 missing at least one document (3–11 each); no expiry dates recorded yet.

**Documents** — each participant's ShiftCare document list → `participant_documents`: new ones
added (extraction pending), type, visibility, expiry and archived changes copied,
`participants.document_count` kept right. About 40 participants per run, oldest-checked first.
Uploads through the website's `api/shiftcare-upload-document.js` and returned onboarding forms are
recorded straight away, without waiting for the sync.

Every change is a row in `sync_log` (`run_id`, direction pull/push, field changes).

## First run, 28 Sep 2026 (counts only)

76 ShiftCare clients, 1 sandbox skipped. 54 participants had gaps in ShiftCare filled from the
Command Centre (mostly NDIS numbers); 10 had gaps in the Command Centre filled from ShiftCare;
20 held for a person (7 dates of birth, 12 addresses, 2 names, a few phone numbers). Verified
in ShiftCare that a written NDIS number landed. The next run changed nothing.

## Calendar (from 29 Sep 2026)

The Command Centre calendar (`/dashboard/calendar`) shows, in Brisbane time:

- **NDIS plan start and end dates** for every participant who isn't exited — read live from
  `participants.plan_start` / `plan_end`, never stored as events — plus a list of plans ending
  in the next 60 days.
- **Appointments and meetings** in `calendar_events`, from three places:
  - **+ New appointment** in the Command Centre (`source = 'command_centre'`);
  - **the office Google Calendar** (`thehealthwellbeinghub@gmail.com`), brought in by the
    15-minute sync (`lib/google-calendar-sync.js`, `source = 'google'`) from the calendar's
    private iCal address in the `GOOGLE_CALENDAR_ICS_URL` env var — 60 days back to a year
    ahead, repeating events included; changed and deleted events follow; a guest email or a
    title containing a participant's full name links it to them. Change these in Google, not
    here;
  - **Claude**, when a worker mentions one: added to that Google Calendar, so it arrives the
    same way (see CLAUDE.md, "Appointments and meetings").

**Both ways (from 29 Sep 2026).** Appointments made in the Command Centre or by Claude, and every
participant's NDIS plan start and end dates (not exited; 60 days back to two years ahead, as
all-day events titled "NDIS plan starts/ends — {name}"), are written to the Google Calendar by a
Google Apps Script on thehealthwellbeinghub@gmail.com, every 5 minutes. The script
(`docs/google-calendar-apps-script.js` in `command_centre`) asks `/dashboard/api/gcal/outbox`
(key: `GCAL_SCRIPT_TOKEN` on the Command Centre's Vercel project) what to add, change or remove,
and reports each Google event id back into `google_calendar_links`, so nothing is added twice.
Reading the calendar back skips those events; a move or rename made to one of our appointments
in Google comes back to it, and one deleted in Google is deleted here after 2 hours. Plan dates
always follow the participant's profile — a change made to one in Google is overwritten. Events
that started in Google are never written back. The calendar page says when it last sent.

Times used to be read and shown in UTC on the server (10 hours out); fixed on 29 Sep 2026.

## Weekly pay breakdown (from 29 Sep 2026)

Every **Monday 8:30am Brisbane** (Supabase pg_cron job `weekly-pay-breakdown` →
`/dashboard/api/cron/pay`, same Vault secret as the sync), for the Monday–Sunday week just gone,
`lib/pay-breakdown.js` in `command_centre`:

1. Reads every ShiftCare **timesheet** for the week — all shifts worked, approved or not (user's
   choice). Each timesheet line has its pay item (Weekday, Saturday, Sunday, Public Holidays) and
   hours, plus allowances (mileage in km, expenses in dollars, sleepovers).
2. Prices each line at the worker's rate in `support_workers` — weekday, Saturday, Sunday,
   public holiday, travel per km, sleepover. **ShiftCare holds no dollar rates for this account**
   (its shift costing is off until its pay items are mapped to Xero), so the rates are kept and
   edited on the worker's profile, **Pay** tab. Evening and night hours on a weekday are paid at
   the weekday rate. Expenses are paid at face value.
3. Saves the week to `pay_breakdowns` (one row per worker per week) and emails the worker
   **email 15, "Your pay breakdown"** — automatically, no office check (user's choice). Logged in
   `sent_emails` as `pay_breakdown`.

A week with any line that has no rate on file is **held, not emailed**, and raises a task
*Pay breakdown held — {worker}, week of {dates}: missing {rate}*. Saving the rate on the Pay tab
rebuilds and sends it, and closes the task. The Pay tab also rebuilds and sends any week by hand
(for a timesheet corrected after Monday). Amounts are before tax — this is not a payslip.
Accounts that aren't support workers (`requires_documents = false`) are skipped.
`?dry=1` works a week out without saving or sending; `?week=YYYY-MM-DD` runs another week.

At launch no worker had a **public holiday rate** on file, and one had no weekday rate, so a week
with a public holiday shift (the next is 5 Oct 2026, King's Birthday) is held until one is added.
