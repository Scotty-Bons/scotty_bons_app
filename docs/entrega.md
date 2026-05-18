# Scotty-Ops — Handover

Operations platform for the Padoque / Scotty Bons network: stores place supply orders with the commissary, the commissary fulfills them and the system generates invoices automatically. It also runs the quality audit program and powers the management dashboards.

---

## 1. Who can do what

| Role | What they see and do |
|------|----------------------|
| **Admin** | Everything: users, products, orders, invoices, audits, settings, dashboards |
| **Commissary** | Receives, approves/declines and fulfills orders. Visits stores and runs audits. Sees the catalog and dashboards. Does **not** see financial settings or user management |
| **Store** | Places orders. Sees only **its own** orders, invoices and audit results |

Each store only sees its own data — this is enforced by the database itself, not just by the website.

---

## 2. How each module works

### Orders
- Flow: **Submitted → Approved → Fulfilled** (or **Declined** at any point before fulfillment).
- Every status change is recorded in the order history (who, when, what).
- An approved order can still be edited (items / quantities) by admin or commissary — the edit is logged in the history too.
- When the commissary marks an order as **fulfilled**, the **invoice is generated automatically**. There is no separate "create invoice" step.
- An email is sent on every relevant status change. If email sending fails for any reason, the order action still goes through — emails never block operations.

### Products
- **Deleting a product is "soft"**: it leaves the catalog but stays visible in old orders and invoices. Past history is never lost.
- **Modifiers** (e.g. sizes, flavours, with their own prices) are mandatory — every order line refers to a modifier, not just the product.
- **Out of stock toggle**: hides the product from new orders but keeps it visible in the catalog.
- **Optional stock control per product**:
  - If the product has no stock quantity set → unlimited (current default).
  - If a stock quantity is set → the system subtracts on each new order and **gives stock back automatically** when the order is declined or deleted (as long as it had not been fulfilled).
- Products support multiple images, sortable, with gallery preview.

### Invoices
- **Cannot be edited or deleted** once issued (accounting requirement).
- Numbered sequentially: `INV-YYYY-0001`, `INV-YYYY-0002`, … No gaps, no duplicates, even if many orders are fulfilled at the same second.
- Each invoice freezes the company data, tax (HST %) and royalties % **as configured at the moment it was issued**. Changing settings later does not change old invoices.
- The royalties / advertising fee is a **flat fee applied once per order**, not per item.
- Can be exported as PDF.

### Audits
- Templates are built by admin: categories → questions, each with a rating scale and custom labels/weights.
- Commissary fills the audit on phone or computer, optionally attaching **photo evidence** (up to 3 photos per question, JPEG/PNG/WebP, max 2 MB each).
- Score is calculated automatically from the answers.
- Templates can be **duplicated** to speed up creation of variants.
- When an audit is submitted, the store admins receive an email notification.
- Reports exportable as PDF.

### Users
- **Deactivate** a user → access is revoked immediately, even if they have a session open. History (orders, audits) is preserved.
- **Delete** is only allowed for users with no important history. The system blocks deletion otherwise. Use deactivate in normal cases.

### Settings (admin only)
- Company info shown on invoices.
- **Tax rate (HST %)** and **royalties %** applied to new invoices.
- Per-store billing info.
- Any user can change their **own** email and password from their profile, regardless of role.

### Dashboard
- Orders by status, order value over time, store ranking (audit averages), top products.
- Filters: period (7 days, 30 days, 3 months, 6 months) and store.

---

## 3. How to access the system

- URL: **[https://app.scottybonsgrill.com](https://app.scottybonsgrill.com)**
- Login: email + password. Forgot password → use the link on the login page; the reset email arrives within a few minutes (check spam if it doesn't).
- An **admin can also set a user's password directly** from *Users → edit*, useful for onboarding someone who can't receive email yet or for resetting access for a user who is stuck.
- Works on phone, tablet and computer. No app to install — just the browser.

---

## 4. External services the system depends on

All four are registered under **info@scottybonsgrill.com**.

| Service | What it does | Current plan |
|---------|--------------|--------------|
| **GitHub** | Stores the source code | Free |
| **Supabase** | Database, login, files. Daily backups for 7 days included | **Pro — ~US$ 25 / month** (paid) |
| **Vercel** | Hosts the website | Free (Hobby) |
| **Resend** | Sends system emails | Free |

> **Resend daily limit:** the free plan caps email sending at **100 emails per day**. If the network grows or volume spikes (lots of order status changes + audit notifications), emails above the cap that day will be **rejected**. Upgrade to Resend Pro when you start approaching the limit (Resend dashboard shows daily usage in *Logs*).

---

## 5. What admins can do without calling the developer

Everything below is done directly inside the system:

| Need | Where |
|------|-------|
| Add / remove a team member | Users → New user / Deactivate |
| Reset someone's password | Users → edit → send reset link **or set a new password directly** |
| Add or edit a product, upload images, manage categories | Products |
| Mark a product out of stock or set a stock quantity | Product → toggle / stock field |
| Create or duplicate an audit template | Audits → Templates |
| Change tax (HST), royalties or company data on invoices | Settings |
| Look up an old order or invoice, export as PDF | Orders / Invoices → filters → Export |

**Suggested routines:**
- **Weekly:** review unfulfilled orders and pending audits.
- **Monthly:** export the order / invoice report for the period.
- **Quarterly:** review active users and deactivate those who left.
- **Yearly:** review the HST rate and the company info in Settings.

---

## 6. When something goes wrong

- **A user cannot log in** → check they are *Active* under Users; ask them to use *Forgot my password*; check the reset email isn't in spam.
- **An email is not arriving** → open the Resend dashboard ([resend.com](https://resend.com), email *Logs*). It shows whether the email was sent, delivered or rejected, and why.
- **The site is down** → check [vercel.com/status](https://vercel.com/status) and [status.supabase.com](https://status.supabase.com). If those are green, contact the developer.
- **Something looks wrong in an order or invoice** → open the order's history first; every change is logged with who did it and when.

---

## 7. Security and data

- Each role only sees what it should — enforced by the **database itself**, not only the website.
- Invoices and order history are **immutable**: they cannot be wiped by mistake.
- Passwords are stored encrypted. Not even the developer has access to user passwords.
- All traffic is over HTTPS.
- Database is backed up automatically every day (kept for 7 days) by Supabase.

---

## 8. For the next developer

Quick orientation only — the codebase and `_bmad-output/implementation-artifacts/` carry the full design rationale per feature.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind + shadcn/ui · Supabase (Postgres + Auth + Storage + Realtime) · Resend · jspdf · Vercel.

**Repo:**
```
app/(auth)         login, forgot-password, update-password
app/(dashboard)    authenticated routes — proxy.ts gates by role
components/        feature-grouped React
lib/               supabase clients, email helpers, zod schemas, types
supabase/migrations/   full schema history (apply with: supabase db push)
docs/              this document
_bmad-output/      sprint stories + tech specs — read these before redesigning anything
```

**Environment variables:**
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY     # was ANON_KEY
SUPABASE_SERVICE_ROLE_KEY                # server-only, bypasses RLS
NEXT_PUBLIC_APP_URL                      # used in email links
RESEND_API_KEY                           # leave empty to disable email
RESEND_FROM_EMAIL
```

**Things that will surprise you:**
- The middleware file is `proxy.ts` (Next.js 16 naming). Do **not** create `middleware.ts` — they conflict. Session refresh, role-based redirects and inactive-user blocking live there.
- **RLS is the real security layer.** Role checks in Server Actions are defense-in-depth. Never disable RLS on a table to "fix" something — fix the policy.
- **Soft delete is the default** for products and orders. Most list queries must filter out deleted rows.
- **Invoices are immutable** — there is no edit path, by design.
- Stock and invoice numbering both use row locks to stay correct under concurrent requests.
- UI strings are **English only** (overrides any PT-BR in older specs).

**Deploy:**
- Push to `master` → Vercel deploys production automatically.
- Each PR gets a preview deploy.
- Env vars: Vercel → Project → Settings → Environment Variables.
- DB changes: add a new migration file in `supabase/migrations/`, then `supabase db push`.

---

## 9. Support

| Topic | Contact |
|-------|---------|
| Day-to-day usage | Scotty Bons admin |
| Bugs / new features / code changes | **Gustavo** — gustavo@equipepadoque.com.br · +55 31 97338-6815 |
| Infrastructure status | [vercel.com/status](https://vercel.com/status) · [status.supabase.com](https://status.supabase.com) · [resend.com/status](https://resend.com/status) |

_Last updated: 2026-05-18._
