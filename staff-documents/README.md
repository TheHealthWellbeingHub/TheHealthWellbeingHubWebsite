# Staff documents

Documents for staff and contractors, not participants. Kept here so any session can
attach them from the H&W mailbox. The Support Worker Agreement goes out with email 14
(`worker-welcome`, the new support worker welcome) through `api/send-participant-email.js`,
and `api/send-document-pack.js` emails the whole set (with `participant-documents/`) to an
H&W inbox.

| File | Fields | Source |
|---|---|---|
| `The Health & Well-being Hub - Support Worker Agreement (Fillable).pdf` | 10 | The NDIS Support Worker Agreement (ABN contractor), rebuilt word for word as a branded fillable PDF on 25 Sep 2026. Wording changes need a human's sign-off first |

**Not public.** `vercel.json` redirects `/staff-documents/*` away from the site, because
this folder holds contractor pay rates. The send function reads the files from its own
bundle, so the redirect doesn't affect it.

The agreement states its own ABN (57 580 962 488) in section 1, which differs from the
ABN on the rest of H&W's material (91 643 237 045). Its footer omits an ABN so the
document never shows two different ones — confirm which is correct before it's signed.
