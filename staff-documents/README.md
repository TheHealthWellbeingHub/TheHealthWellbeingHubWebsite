# Staff documents

Documents for staff and contractors, not participants. Kept here so any session can
attach them from the H&W mailbox. The Support Worker Agreement goes out with email 14
(`worker-welcome`, the new support worker welcome) through `api/send-participant-email.js`,
and `api/send-document-pack.js` emails the whole set (with `participant-documents/`) to an
H&W inbox.

| File | Fields | Source |
|---|---|---|
| `The Health & Well-being Hub - Support Worker Agreement (Fillable).pdf` | 9 | The NDIS Support Worker Agreement (ABN contractor), rebuilt word for word as a branded fillable PDF on 25 Sep 2026. Wording changes need a human's sign-off first. Pre-signed as Company Representative by Ibrahim Zakariya (30 Sep 2026) — the contractor's fields stay fillable |

**Always a fillable PDF.** Agreements and forms that go out are editable PDFs — never
Word files — so the other party can fill in and sign them without printing (user's
instruction, 30 Sep 2026).

**Pre-signed.** Ibrahim Zakariya's signature is stamped into the H&W signature box of the
Support Worker Agreement and of the Service Agreement (`participant-documents/`) by
`source/stamp_signature.py`. The signature image itself is **not** kept in this repository
(the repository is public on GitHub) — ask the user for it and pass its path to the script. The signature
becomes page content and that one field is removed; every other field stays fillable, and
each field gets its own appearance so filling one never shows up in another. If
either agreement is ever rebuilt, run the script again afterwards (it skips a form that's
already signed).

**Not public.** `vercel.json` redirects `/staff-documents/*` away from the site, because
this folder holds contractor pay rates. The send function reads the files from its own
bundle, so the redirect doesn't affect it.
