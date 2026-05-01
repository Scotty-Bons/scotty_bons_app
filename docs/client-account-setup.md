# Account Setup Guide

This guide walks you through creating the four accounts that power your application:
**GitHub** (source code), **Supabase** (database and authentication), **Vercel**
(hosting), and **Resend** (transactional email).

> **Use the same corporate email for all four accounts.** Ideally a shared
> mailbox like `it@yourcompany.com` so access is not tied to a single person.
> Store every password in a password manager (1Password, Bitwarden, etc.) —
> never share credentials over WhatsApp or plain email.

---

## 1. GitHub — where your source code lives

1. Go to https://github.com/signup
2. Create an account using your corporate email and a strong password
3. Confirm the verification email
4. Enable **two-factor authentication (2FA)** under
   *Settings → Password and authentication*. GitHub requires this.
5. **Recommended:** create a free **Organization** at
   https://github.com/organizations/new → pick the *Free* plan → name it after
   your company. This way the repository belongs to the company, not to an
   individual.
6. **Invite your developer** so they can transfer the repository and keep
   maintaining it:
   - If you created an **Organization:** go to your org →
     *People → Invite member* → enter the developer's GitHub username →
     role **Owner** (needed to receive a repository transfer). You can
     downgrade to *Member* after the migration is done.
   - If you did **not** create an organization: no invite is needed now —
     the developer will send you a transfer request that you just accept
     from your email.
7. **Send to your developer:** your GitHub username (or the organization name).

---

## 2. Supabase — database and authentication

1. Go to https://supabase.com/dashboard/sign-up
2. Click **Continue with GitHub** and use the account you just created
   (easier to manage later)
3. Create an **Organization** with your company name
4. **Do not create a project yet** — your developer will create it during
   migration
5. Start on the **Free** plan. Later your developer can advise whether to
   upgrade to **Pro** (US$ 25/month), which is recommended for production
   because it includes daily backups and prevents the project from being paused
   after inactivity.
6. **Invite your developer** to the organization:
   *Organization → Team → Invite* → enter the developer's email → role
   **Owner** (needed to create the project and run the database migration).
   You can downgrade to *Developer* after the migration is done.
7. **Send to your developer:** confirmation that the account is ready and the
   invite was sent.

---

## 3. Vercel — where your website runs

1. Go to https://vercel.com/signup
2. Click **Continue with GitHub** (use the account from step 1)
3. When asked about account type, choose **Team** and name it after your
   company. The free *Hobby* plan is personal only; the **Pro** plan
   (US$ 20/month per member) is required for commercial use.
4. Authorize GitHub access when prompted
5. **Do not import a project yet** — your developer will do that during
   migration
6. **Invite your developer** to the Team:
   *Team Settings → Members → Invite Member* → enter the developer's email →
   role **Owner** (needed to import the project and set environment
   variables). You can downgrade to *Member* after go-live.
7. **Send to your developer:** the Team name and confirmation that the invite
   was sent.

---

## 4. Resend — transactional email delivery

1. Go to https://resend.com/signup
2. Sign up with your corporate email (or log in with GitHub)
3. Under *Domains*, add your company domain (e.g. `yourcompany.com`) and follow
   the instructions to create the **SPF, DKIM and DMARC** DNS records
   - If you do not manage your own DNS, forward the instructions to whoever
     hosts your domain
4. Wait for the domain to be verified (usually a few minutes)
5. Start on the **Free** plan — it allows 3,000 emails/month and 100/day, which
   is enough to get started. Upgrade to *Pro* (US$ 20/month) later if you need
   more volume.
6. **Invite your developer** to the Resend account:
   *Settings → Team → Invite* → enter the developer's email → role
   **Admin** (needed to create API keys used by the application).
7. **Send to your developer:** confirmation that the domain shows as
   *Verified* and the invite was sent.

---

## Final checklist to send to your developer

- [ ] GitHub username or organization name — **developer invited as Owner**
- [ ] Supabase organization ready — **developer invited as Owner**
- [ ] Vercel Team name — **developer invited as Owner**
- [ ] Resend domain verified — **developer invited as Admin**

Once your developer has these four items they can begin migrating the
application into your accounts.

---

## Important reminders

- **Store every password in a password manager.** Never share credentials over
  WhatsApp or email.
- **Enable 2FA everywhere** — GitHub requires it; the other three strongly
  recommend it.
- **Use a shared corporate email** (not a personal one) so access is not tied
  to a single employee.
- **Keep billing centralized** on one corporate credit card for all four
  services.
