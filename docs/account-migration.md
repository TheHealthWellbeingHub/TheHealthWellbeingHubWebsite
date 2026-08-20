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

## Step 0 — before touching any platform

1. Create `officethehealthwellbeinghub@gmail.com`.
2. Turn on **2FA with an authenticator app**, not SMS.
3. Set a recovery phone and recovery email.
4. Save the backup codes somewhere that is **not** that inbox.
5. Set forwarding to `hello@thehealthwellbeinghub.com` and **send a test to confirm it
   delivers**.

Keep direct sign-in to the office@ inbox working throughout. Password resets, verification links
and 2FA codes all land there, and being unable to read it after adding the new account but
before removing the old one is the one genuinely bad failure in this process.

---

## Two different mechanisms

Worth understanding before starting, because it decides what each step looks like:

- **Change the email on the existing account.** Keeps all history, permissions and settings —
  it is the same account with a new address. Simplest where available.
- **Add a new account, then remove the old.** Required where the platform refuses email changes.
  Permissions have to be granted to the new account explicitly.

---

## 1. Wix — change the email

Lowest stakes, do it first to feel out the process.

1. Sign in at **manage.wix.com** as the current owner.
2. Top-right avatar → **Account Settings** (or go to `manage.wix.com/account/account-settings`).
3. Find **Account email** → **Change email**.
4. Enter `officethehealthwellbeinghub@gmail.com`, confirm with your password.
5. Open the verification email **in the office@ inbox** and click the link.
6. **Verify:** sign out entirely, sign back in with the new address, and confirm the site is
   still listed and editable.

---

## 2. GitHub — change the email — **done 20 Aug 2026**

**Correction to an earlier assumption:** `The-Health-Wellbeing-Hub` is a **personal account**,
not an organisation. GitHub's own settings header confirms it — *"Your personal account"*. So
there is no org membership to check, and no invite step.

1. Sign in to GitHub as the current account.
2. **Settings → Emails → Add email address** → `officethehealthwellbeinghub@gmail.com`.
3. Verify it from the office@ inbox.
4. Back on the same page, set it as **Primary email**.
5. **Verify:** push a commit, or open the repo and confirm you can still edit a file.

Username, commit history and the GitHub App that Claude Code uses are all unaffected — they
belong to the account, not to the address.

**Keep the old address listed as a secondary verified email.** It costs nothing and gives a
second route to password reset. Consolidation is about which address is *primary*, not about
deleting every other one.

### Worth knowing: the repo is on one personal account

Because this is a personal account rather than an organisation, the repository — the entire
website and its deployment source — depends on one individual login. An organisation can have
several owners; a personal account cannot.

That is the same single-point-of-failure pattern as the GTM container, and it is not solved by
changing the email on it. Converting the account to an organisation, or transferring the repo
into one, is the durable fix. Not urgent, but worth doing before the business depends on this
any more heavily than it already does.

---

## 3. Vercel — change the email

The project sits on the **TheHealthWellnessBeingHub** team. Team membership follows the user, so
changing your account email carries it across.

1. Sign in at **vercel.com**.
2. Avatar top-right → **Account Settings**.
3. Under **General**, find **Email** → change to the new address.
4. Verify from the office@ inbox.
5. **Verify:** open the `health-wellbeing-hub` project and confirm you can see Deployments and
   **Settings → Environment Variables**. The `HUBSPOT_TOKEN` and related variables belong to the
   project, not to you, so they should be untouched — but confirm they are still listed.
6. **Real check:** trigger a deploy (push any commit) and watch it complete.

---

## 4. Supabase — check how you sign in first

**If you sign in to Supabase with GitHub**, there is nothing to do here — step 2 already handled
it, because Supabase reads the address from GitHub. Confirm by signing out and back in.

If you sign in with an email and password:

1. Sign in at **supabase.com/dashboard**.
2. Account preferences → **Account Settings** → change the email, verify from office@.

If the email cannot be changed on your plan, use the org route instead:

1. **Organization → Team → Invite member** → `officethehealthwellbeinghub@gmail.com` → role
   **Owner**.
2. Accept from the new account, confirm it can see the project.
3. Remove the old member.

**Verify:** load `https://www.thehealthwellbeinghub.com/provider-directory/` and confirm
provider listings render. That page reads directly from Supabase, so listings appearing means
the project and its API keys are intact.

---

## 5. Google — cannot be changed, add a user instead

Google account emails cannot be changed, so the new address is **added** as a user.

### GA4

1. **analytics.google.com** → **Admin** (cog, bottom-left).
2. Under *Property settings* → **Property access management**.
3. **+** (top right) → **Add users** → `officethehealthwellbeinghub@gmail.com`.
4. Role: **Administrator**. Send.
5. Accept from the new account.
6. **Verify:** sign in as the new account and confirm you can open
   *Admin → Custom definitions*.

### GTM — currently blocked

`GTM-NKMLMGDT` is owned by an account that neither `hello@` nor the personal Gmail can see. Adding
a new identity does not grant access it was never given. See "What this does not fix" below.

Once someone with access is found: **GTM → Admin → User Management → +** →
`officethehealthwellbeinghub@gmail.com` → **Publish**.

---

## 6. HubSpot — cannot be changed, new user required

Leave a clear day for this one. It is the most consequential and it holds participant data.

**Before starting:** the portal is **Starter Customer Platform at A$16/seat/month**. Adding a
second user may add cost while both exist. Check the billing screen first.

1. Sign in to HubSpot as the current Super Admin.
2. ⚙ **Settings → Users & Teams**.
3. **Create user** → `officethehealthwellbeinghub@gmail.com`.
4. Permissions: **Super Admin**.
5. Send the invite; accept it from the office@ inbox and set a password.
6. **Verify, thoroughly, before removing anything.** Signed in as the new user, confirm you can
   reach: Contacts, Deals, Marketing → Forms, Marketing → Marketing Email, Automation →
   Workflows, and ⚙ Settings → Properties.
7. **Then run the real check** — submit the live enquiry form at
   `https://www.thehealthwellbeinghub.com/contact/` and confirm the contact, deal, note,
   follow-up task **and the acknowledgement email** all appear. This proves the private app
   token behind `api/hubspot-submit.js` still works, which is the thing most likely to be
   disturbed.
8. Only once all of that passes: **Settings → Users & Teams → the old user → Deactivate**.

Do not delete the old user until at least a week has passed without problems.

---

## 7. Claude — check what is transferable first

1. **claude.ai → Settings → Account** and look for an email change option.
2. If there is none, it is a support request rather than a self-serve change.

Your Claude Code subscription, conversation history and published artifacts are tied to the
account. Confirm what does and does not move **before** doing anything irreversible — this is
the one where creating a fresh account loses things silently.

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
