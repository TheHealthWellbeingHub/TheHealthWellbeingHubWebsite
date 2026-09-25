# Command Centre — participant data accuracy workstream

Extends the Command Centre described in `CLAUDE.md` ("What lives in this project," item 3)
with a second workstream, alongside the GA/HubSpot lead-source tracking already documented
there. This file is the source of truth for it; `CLAUDE.md` links here.

## Purpose

The Health & Well-being Hub holds participant intake and case documents (assessments, plan
approval letters, progress reports, risk assessments, incident records) in Shiftcare, synced
into a Supabase project. Many participant profiles built from that sync are incomplete or
wrong in places — fields missed on import, or contradicted by a document nobody has read
since. This workstream reads the source documents and brings the structured profile fields
in line with what they actually say.

## Where the data lives

Supabase project `azzvzegudhdgwlrinije`. **Not this git repository.** The guardrail in
`CLAUDE.md` — "Participant data never enters this repository... no names, contact details,
NDIS numbers, plan details, case notes or anything traceable to an individual" — is unchanged
by this workstream. Nothing from Supabase is copied into git; this file documents the process
and schema shape only, not any participant's data.

Core tables:

- `participants` — the structured profile (diagnoses, medications, risks, review_reason,
  treating_professionals, key_contacts, plan dates, etc.). This is what staff and the
  Command Centre read.
- `participant_documents` — the source documents per participant, with `extracted_text`,
  and `deep_read_at` / `deep_read_summary` marking read-progress so nothing is silently
  skipped or re-read.
- `document_findings` — the audit trail. Every document read produces one row per finding:
  what it said, the evidence quote, and a severity/category. This is append-only and is
  never a substitute for the profile fields themselves.
- `participant_profile_updates` — staged, not-yet-applied changes to `participants` fields
  (see workflow below). `status` is `pending` / `approved` / `rejected`; only `approved` rows
  are ever promoted into `participants`.

## Workflow

1. **Read.** Work through each participant's unread documents, largest/most acute first.
   Sensitive documents (e.g. court-restricted records) are summarised at an appropriate
   level of abstraction, not reproduced verbatim.
2. **Log every finding to `document_findings`.** Confirmations, corrections, new
   information, and data-quality problems in the source itself (e.g. a document that shows
   signs of being AI-generated rather than genuine clinical content) all get logged. This is
   an append-only note, not a live field anyone is currently relying on, so it is written
   continuously without per-item sign-off.
3. **Stage proposed profile changes in `participant_profile_updates`** — field, current
   value, proposed value, reason, evidence quote, source document, severity. Nothing is
   written directly to `participants` at this step.
4. **Human sign-off, done in batches, not one row at a time.** Someone at H&W reviews a
   batch of staged updates together and marks each `approved` or `rejected`.
5. **Promotion.** Approved rows are applied to the live `participants` fields; rejected rows
   stay in the table as a record of what was proposed and why it wasn't used.

Direct writes to live `participants` clinical/risk fields (diagnoses, medications, risks,
review_reason, treating_professionals, key_contacts, plan dates) skip this and are not used —
staging is the only path in, so nothing reaches a field staff act on without a human
having reviewed it. `document_findings` is the exception: it's an audit log, not a field
anyone currently acts on, so it's fine to write continuously.

## Source-reliability rules

- A primary/official source (e.g. an NDIA plan approval letter) outranks a provider-internal
  report when they conflict.
- A document showing AI-generation artifacts (leftover model names, web-chrome text like
  "Top of Form," an embedded assistant-style follow-up question, content that names an
  unrelated participant) has its content logged as a finding but is **not** treated as
  reliable confirmation of anything positive it claims — flag it, don't build the profile on it.
- Anything asserting clinical outcomes, NDIS funding eligibility, or plan coverage is a
  compliance matter for human review, per the Guardrails in `CLAUDE.md` — draft/flag it,
  never assert it directly into a profile field.

## Which Claude surface does what (extends the table in `CLAUDE.md`)

| Surface | Can reach | Cannot reach |
|---|---|---|
| **Claude Code** (this repo) | files, git, GitHub, this Supabase project | HubSpot, Google Analytics |
| **claude.ai chat** (Command Centre artifact) | HubSpot, GA via connectors | this git repo, this Supabase project (unless separately connected) |

## Status

`participant_profile_updates` did not exist before 2026-09-17; earlier session work in this
project wrote some corrections directly to `participants` before this staging table existed.
Those are called out separately so the first sign-off batch can cover them retroactively,
rather than being silently left outside the new process.
