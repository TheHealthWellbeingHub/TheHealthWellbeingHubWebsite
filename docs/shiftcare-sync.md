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
