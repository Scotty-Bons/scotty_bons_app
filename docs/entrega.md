# Scotty-Ops — Project Handover

> Official handover document for the **Scotty-Ops** system, developed for
> Padoque. It covers what the system does, how to use it, how to run
> day-to-day maintenance, and who to turn to when something needs to be
> changed "under the hood".
>
> **Recommended audience:** leadership, management, and the admin team
> should read from the cover up to the section **"For the future technical
> team"**. The final section is written for whoever takes over development.

---

## 1. What Scotty-Ops is

Scotty-Ops is the **operations web platform** for the Padoque network.
It connects three worlds that used to live in spreadsheets, WhatsApp and paper:

- **Stores** place supply orders with the central commissary.
- **The commissary** receives, approves and fulfills those orders, and also
  visits stores to run quality audits.
- **Administration** follows everything in real time, generates invoices,
  configures the network and analyzes indicators.

All in a single place, with history, traceability and clear
per-role permissions.

---

## 2. How the system is organized

The system is built around **three user types**, each landing on a
different "door" after login:

| Role | What they do | What they do NOT see |
|------|--------------|----------------------|
| **Admin** | Everything: users, products, orders, invoices, audits, settings, dashboards | — |
| **Commissary** | Receives orders, approves/declines, fulfills them and generates invoices. Visits stores and runs audits | Financial settings and user management |
| **Store** | Places orders, tracks its own history, sees its own invoices and audit results | Orders / invoices / audits from other stores |

> This separation is enforced by the **database itself** (not only by the
> website), so a Store user **cannot** see data from another store, not
> even with external tools.

---

## 3. System modules (user view)

### 3.1 Dashboard
Home page for admin and commissary users. Shows:

- Total orders by status
- Order value over time
- Store compliance ranking (average audit score)
- Most ordered products
- Filters by period (7 days, 30 days, 3 months, 6 months) and by store

### 3.2 Orders
Full supply-order workflow:

1. The store builds its cart from the catalog and **submits**.
2. The commissary sees it in real time, marks it **under review**,
   **approves** or **declines**.
3. When delivered, it's marked **fulfilled** — the system automatically
   generates the **invoice**.
4. Every status change is recorded in the order history.

Extra features:

- Search and filters by status, period, store, order number
- Editing approved orders (with the change logged in history)
- Product images inside the cart
- Automatic email on every relevant status change

### 3.3 Products and categories
Managed by admin and commissary; stores see the catalog in read-only mode. Each product has:

- Name, price, category
- **Multiple images** (sortable)
- **Modifiers** (variants like size or flavor, with price adjustments)
- **Out of stock** toggle (stays visible in the catalog but cannot be ordered)
- Soft delete: the product leaves the catalog but does not disappear from past history

Stores can browse and search the catalog but cannot create or edit products.

### 3.4 Invoices
Generated **automatically** when an order is fulfilled. Characteristics:

- **Immutable** — once issued, they cannot be edited (fiscal/accounting requirement)
- Sequential numbering (format `INV-YYYY-0001`)
- Contains store and commissary data, line items, subtotal, configurable
  tax (HST), total, and marketing royalties if configured
- Filterable by period, store and number
- Can be exported as PDF

### 3.5 Audits
The network's quality program:

1. **Admin creates a template** — a list of questions grouped by category,
   each with a rating scale (e.g. *Poor / Satisfactory / Good*).
2. **Commissary visits the store** and fills out the audit on phone or
   computer, optionally attaching **photo evidence** (up to 3 per item,
   JPEG/PNG/WebP, max 2MB).
3. **The system computes the score** automatically.
4. **The store sees** the result of its own audits in the history.
5. **Administration sees** the consolidated ranking on the dashboard.

Reports can be exported as PDF.

### 3.6 Users
Admin manages:

- Creating a new user (as admin, commissary or store — and linked to a specific store when applicable)
- Editing data and role
- **Deactivating**: access is revoked immediately, but history (orders, audits) is preserved
- **Deleting**: only recommended for users who never operated; the system
  blocks deletion when there are important dependencies

### 3.7 Settings
Admin-only. Defines:

- Company details (legal name, tax ID, address) — used on invoices
- **Tax rate (HST %)** — applied automatically on every new invoice
- **Marketing royalties fee (%)**
- Billing details for each store

Any user (regardless of role) can change their own **password** and
**email** from their profile page.

---

## 4. How to access the system

1. Open **[https://app.scottybonsgrill.com](https://app.scottybonsgrill.com)**.
2. Login screen: email + password.
3. Forgot your password: click **"Forgot my password"** → a reset link arrives by email.
4. Change password: log in → user menu → **Settings**.

> **Tip:** the system works on phones, tablets and computers. Orders and
> audits can be done from a phone, no app needed — just open the browser.

---

## 5. Accounts and services used by the system

Scotty-Ops relies on **four external services**. Each has a clear purpose
and all of them are managed from a web dashboard:

| Service | Purpose | Dashboard | Plan |
|---------|---------|-----------|------|
| **GitHub** | Stores the source code | [github.com](https://github.com) | Free or Team |
| **Supabase** | Database, login, files | [supabase.com/dashboard](https://supabase.com/dashboard) | Pro (~US$ 25/mo) |
| **Vercel** | Hosts the website | [vercel.com/dashboard](https://vercel.com/dashboard) | Pro (~US$ 20/user/mo) |
| **Resend** | Sends system emails | [resend.com](https://resend.com) | Free → Pro above 3,000 emails/mo |

> All four accounts are registered under **info@scottybonsgrill.com**. Use this email to log in to each service dashboard.

### Important recommendations
- **Enable 2FA** (two-factor authentication) on all four accounts.
- Keep every password in a **password manager** (1Password, Bitwarden). **Never** send credentials over WhatsApp or email.

---

## 6. Day-to-day maintenance (no developer required)

Everything in this list is done **by the admin, directly inside the system**:

| What you need to do | Where to do it |
|---------------------|----------------|
| Create a new team member | Users → **New user** |
| Revoke access for someone who left | Users → edit → **Deactivate** |
| Reset someone's password | Users → edit → send reset link (or ask the person to use "Forgot my password") |
| Add/remove a product from the catalog | Products → New / edit / delete |
| Mark a product as out of stock | Product → **In stock** toggle |
| Upload a new product image | Product → images tab |
| Create a new product category | Products → Categories |
| Adjust tax (HST) or royalties | Settings → Financial |
| Update company data on invoices | Settings → Company |
| Create a new audit template | Audits → Templates → New |
| Look up an old invoice | Invoices → filter by period / store |
| Export orders or audits as PDF | Inside the page, **Export** button |

### Recommended routines
- **Weekly:** review unfulfilled orders and pending audits
- **Monthly:** export the month's order and invoice reports
- **Quarterly:** review the list of active users, deactivate those who left
- **Yearly:** review the HST rate and tax data in *Settings*

---

## 7. Backup, security and privacy

- **Database backup:** included with the **Supabase Pro** plan (daily, retained for 7 days). Nothing manual is required.
- **Immutable history:** invoices and order history cannot be wiped by accident — only admins can delete orders, and the action is logged.
- **Passwords:** stored encrypted by Supabase Auth itself. Not even the developer has access to user passwords.
- **Data access:** each role sees only what it needs — this is not a "website rule", it's a **database rule** (technically: Row-Level Security).
- **HTTPS everywhere:** all traffic between browser and server is encrypted.
- **Banned users** are blocked immediately, even with an open session.

---

## 8. What to do if something goes wrong

### A user cannot log in
1. Confirm with the admin that the user is **active** under *Users*.
2. Ask the user to use **"Forgot my password"**.
3. Check if the reset email ended up in the spam folder.

### System emails are not arriving
1. Check the **Resend** dashboard (login.resend.com) → *Emails* — it shows whether the email was sent, delivered or rejected.
2. If it's a domain-based rejection, notify the technical contact.

### The site is down
1. Open **vercel.com** → the project shows the status of the latest deploy.
2. If there's an error, open a ticket with the developer (see the next section).

### Suspicion of incorrect data
- Every order, invoice and audit has a **traceable history** inside the system. Before contacting support, check the history of the affected order/invoice.

---

## 9. For the future technical team

> This section is written for the **next developer** taking over maintenance
> or evolution of Scotty-Ops. Feel free to skip if you are just using the
> system.

### 9.1 Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** (App Router) + **React 19** |
| Language | TypeScript 5.9 |
| Styling | Tailwind CSS 3 + **shadcn/ui** + Radix UI |
| Database | **Supabase (PostgreSQL)** + Row-Level Security |
| Auth | Supabase Auth via `@supabase/ssr` (cookies) |
| Storage | Supabase Storage (audit evidence) |
| Realtime | Supabase Realtime (live order updates) |
| Email | **Resend** |
| PDF | `jspdf` + `jspdf-autotable` |
| Excel | `xlsx` |
| Validation | `zod` + `react-hook-form` |
| Charts | `recharts` |
| Hosting | **Vercel** (Edge Runtime) |

### 9.2 Folder structure
```
app/
  (auth)/          Public routes: login, forgot-password, update-password
  (dashboard)/     Authenticated routes (proxy.ts redirects by role)
    dashboard/     KPIs and charts
    orders/        Orders (list, detail, new)
    products/      Catalog and categories
    invoices/      Invoices
    audits/        Audits + templates
    users/         User management (admin)
    settings/      Company settings
    documentation/ This handover guide (admin)
components/        Feature-grouped React components
lib/
  supabase/        Client init, auth helpers
  email/           Resend helpers
  validations/     Zod schemas
supabase/
  migrations/      ~45 migrations (full schema history)
  config.toml
docs/              This document and related guides
_bmad-output/      Sprint stories and tech specs (what was built and why)
```

### 9.3 Running locally

```bash
git clone <repo>
cd scotty-ops
cp .env.example .env.local   # fill in Supabase and Resend keys
npm install
npm run dev                  # serves http://localhost:3000
```

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (formerly `ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY` (admin operations, **never** exposed to the client)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### 9.4 Database

- Every schema change is tracked as a **SQL migration** in `supabase/migrations/`.
- To apply the full schema to a fresh Supabase project:
  ```bash
  supabase link --project-ref <ref>
  supabase db push
  ```
- Main tables: `stores`, `profiles`, `products`, `product_categories`,
  `product_images`, `product_modifiers`, `orders`, `order_items`,
  `order_status_history`, `invoices`, `invoice_items`, `audit_templates`,
  `audit_template_items`, `audits`, `audit_responses`, `audit_evidence`,
  `financial_settings`.
- **RLS policies** and `SECURITY DEFINER` functions are part of the
  security model — **never disable RLS** on a table to "fix things quickly".
- Invoice numbering uses a **Postgres advisory lock** to prevent
  duplicates under concurrency.

### 9.5 Deployment

- **Automatic** on push to `master`, via the Vercel ↔ GitHub integration.
- Preview deploys are created for every PR.
- Environment variables live under *Vercel → Project → Settings → Environment Variables*.

### 9.6 Project-specific caveats

- **`proxy.ts`** (not `middleware.ts`) handles session (Supabase cookies), role-based redirects
  and banned-user blocking. If anything fails during login, start there.
- **Soft delete** is the default for products and orders — be careful
  writing queries without `is_deleted = false`.
- **Images** live in a Supabase Storage bucket and are served via signed URLs.
- The full history of specs behind every feature (including design
  rationale) is in `_bmad-output/implementation-artifacts/`.

### 9.7 Code conventions

- Server Actions (`actions.ts`) validate the user's role **before** any
  mutation — do not remove those checks.
- Forms use `react-hook-form` + `zod` — schemas live in `lib/validations`.
- Language: the **UI is in English** (product decision); documentation and
  client-facing content can be in Portuguese or English.

---

## 10. Final deliverables

- [x] Full source code in the Scotty Bons GitHub repository
- [x] Supabase database provisioned in the Scotty Bons account (info@scottybonsgrill.com), with production data
- [x] Vercel production deploy in the Scotty Bons account (info@scottybonsgrill.com)
- [x] Application domain configured — https://app.scottybonsgrill.com
- [x] Resend transactional emails active in the Scotty Bons account (info@scottybonsgrill.com)
- [x] Initial admin user created
- [x] Initial product catalog loaded
- [x] Baseline audit template created
- [x] This handover document

---

## 11. Support and contacts

| Purpose | Contact |
|---------|---------|
| Usage questions (admin/store) | Scotty Bons administrator |
| Evolutive maintenance / bugs | **Gustavo** — gustavo@equipepadoque.com.br · +55 31 97338-6815 |
| Infra status (site is down) | [vercel.com/status](https://vercel.com/status) · [status.supabase.com](https://status.supabase.com) · [resend.com/status](https://resend.com/status) |

> **Last updated:** 2026-05-13.
