# Account migration — consolidating logins

Moving GitHub, Claude, Wix, Supabase, Vercel, HubSpot and Google onto a single
identity: **`officethehealthwellbeinghub@gmail.com`**.

Written to be worked through over several sittings. Nothing here can be done from Claude Code —
every step needs an authenticated browser session and 2FA.

---

## The rule that keeps you from being locked out

> **Add the new account. Verify it works. Only then remove the old one.**

Never the reverse, never both at once, never on a Friday. If access is removed before the
replacement is confirmed, several of these systems have no self-serve recovery — and one of them
holds participants' health and disability information.

Do **one service per sitting**, and run a real check after each.

---

## The address

`officethehealthwellbeinghub@gmail.com` is the user's decision, recorded 20 Aug 2026.

The argument against it, made once and set aside: a personal Gmail belongs to whoever holds the
password, whereas an address on `thehealthwellbeinghub.com` belongs to the business and can be
recovered by a Workspace admin. For a registered NDIS provider whose CRM holds participant
health data, that distinction matters more than it does for most businesses.

It is also not hypothetical here. As of 20 Aug 2026 the live GTM container `GTM-NKMLMGDT` is
owned by an account nobody available can sign into — see "What this does not fix" below.

---

## Per service

| Service | Can the login email change? | What to actually do |
|---|---|---|
| **GitHub** | Yes | The repo lives in the `The-Health-Wellbeing-Hub` **org**, so org ownership matters more than any personal login. Invite the new account as an org **Owner**, verify, then remove the old |
| **Vercel** | No — team-based | Project is on the **TheHealthWellnessBeingHub** team. Invite the new address as **Owner**, verify a deploy, remove the old member. Env vars and deployments belong to the project, not to a person |
| **Supabase** | No — org-based | Invite the new address to the org as **Owner**, verify, remove the old |
| **Wix** | Yes | Account email is changeable in account settings; Wix also supports transferring a site between accounts |
| **Google** (GTM + GA4) | **No** | Account emails cannot be changed. Add the new address as a user: GTM → Admin → User Management (**Publish**); GA4 → Admin → Property access management (**Administrator**) |
| **HubSpot** | **No** | A HubSpot user's email cannot be changed. Invite a **new user**, give them **Super Admin**, verify, then deactivate the old one |
| **Claude** | Probably not self-serve | Check Settings → Account first. If there is no option it is a support request. The Claude Code subscription and history are tied to the account — confirm before doing anything irreversible |

### HubSpot — two things to check first

- The portal is **Starter Customer Platform at A$16/seat/month**. A second user may add cost
  while both exist.
- The **private app token** used by `api/hubspot-submit.js` belongs to the portal, not to a user,
  so it should survive. Confirm it before removing the old user by putting a real enquiry through
  the live form and checking the record appears.

---

## Suggested order

Least dangerous first, so a mistake is cheap:

1. **Wix** — lowest stakes, and it exercises the process
2. **GitHub** — org invite, easy to verify and easy to undo
3. **Vercel** — verify by watching a deploy complete
4. **Supabase** — verify by loading the provider directory, which reads from it
5. **Google** — GA4 first, then GTM if the container owner can be found
6. **HubSpot** — last, most consequential, and the one to leave a clear day for
7. **Claude** — whenever, but check what is transferable before touching it

---

## Verify each one with something real

Not "the invite says accepted" — an actual end-to-end action:

| Service | Real check |
|---|---|
| GitHub | Push a commit from the new account's session |
| Vercel | Trigger a deploy and watch it go green |
| Supabase | Load `/provider-directory/` and confirm listings render |
| HubSpot | Submit the live enquiry form; confirm contact, deal, note, task and acknowledgement |
| GA4 | Realtime shows the event |

The HubSpot one exercises the entire chain in about thirty seconds and is the single most useful
check on this page.

---

## What breaks, and is easy to fix

**Every MCP connector in Claude Code** — HubSpot, Vercel, GitHub, Supabase, Gmail, Drive — is
authenticated as the current identity. All will need reconnecting after the migration. Expect it
rather than being surprised by it, and note that the HubSpot connector's marketing-email write
scope was already lost on 20 Aug 2026 and needs a full re-authorisation regardless.

---

## What this does **not** fix

**The GTM container.** `GTM-NKMLMGDT` is live, published and serving the site — verified 20 Aug
2026 — but neither `hello@thehealthwellbeinghub.com` nor the personal Gmail can see it in Tag
Manager. It belongs to some third account.

Creating a new identity does not grant access to a container that identity was never given.
Someone with access has to add the new account: **GTM → Admin → User Management**.

Two leads on who that is:

- Tag Manager → the Google tag → Admin → **"Choose who can administer this tag"**
- GA4 → Admin → **Property access management**

Until that is resolved, the site's tracking runs fine but cannot be changed. The only remedy
without the owning account is re-tagging the entire site, which is why it is worth chasing while
the trail is warm.

---

## Timing

**Do not start this in the middle of a campaign send.** A half-migrated HubSpot login while
referral acknowledgements are going out is the worst possible moment to discover a permissions
gap. Either finish the migration first, or send the campaign first and migrate after.
