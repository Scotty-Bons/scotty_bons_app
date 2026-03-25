# Story 8.1: Order Email Notifications

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Store user,
I want to receive email notifications when my order status changes,
so that I stay informed without having to check the app repeatedly.

As an Admin,
I want to receive email notifications when a new order is submitted,
so that I can review and act on it promptly.

As a Commissary user,
I want to receive an email when an order is approved,
so that I know to begin preparing the items.

## Acceptance Criteria

1. **Given** a Store user submits a new order,
   **When** the order is created successfully,
   **Then** all Admin users receive an email with subject "New Order Submitted — {store name}" containing: store name, order short ID, item count, total, and a link to the order detail page.

2. **Given** an Admin approves an order,
   **When** the status changes to "approved",
   **Then** the Store user who submitted the order receives an email with subject "Order Approved — #{short-id}" containing: order ID, approval notice, and a link to the order detail page.
   **And** all Commissary users receive an email with subject "Order Approved — Ready for Fulfillment" containing: store name, order short ID, item count, and a link to the order detail page.

3. **Given** an Admin declines an order,
   **When** the status changes to "declined",
   **Then** the Store user who submitted the order receives an email with subject "Order Declined — #{short-id}" containing: order ID, decline reason (if provided), and a link to the order detail page.

4. **Given** a Commissary user fulfills an order,
   **When** the status changes to "fulfilled",
   **Then** the Store user who submitted the order receives an email with subject "Order Fulfilled — #{short-id}" containing: order ID, fulfillment notice, invoice number, and a link to the invoice detail page.

5. **Given** email sending fails,
   **When** the notification function encounters an error,
   **Then** the error is logged server-side but does NOT block or fail the original order action — the order status change still succeeds.

6. **Given** a user's email is not available (e.g., deleted user),
   **When** the notification function tries to send,
   **Then** the notification is silently skipped for that recipient.

7. **Given** any email is sent,
   **When** the recipient receives it,
   **Then** the email contains a professional, minimal HTML layout with the app name "Scotty Ops" in the header, the notification content, and a call-to-action button linking to the relevant page.

8. **Given** the notification system is in place,
   **When** email configuration is not set up (missing environment variables),
   **Then** the notification functions are no-ops — they log a warning and return without error.

## Tasks / Subtasks

- [ ] Task 1 — Install Resend email package (AC: all)
  - [ ] Run `npm install resend`
  - [ ] Add `RESEND_API_KEY` to `.env.local.example` with a placeholder comment
  - [ ] Add `NEXT_PUBLIC_APP_URL` to `.env.local.example` if not already present

- [ ] Task 2 — Create email utility module (AC: #5, #6, #7, #8)
  - [ ] Create `lib/email/client.ts`:
    - Initialize Resend client: `new Resend(process.env.RESEND_API_KEY)`
    - Export `sendEmail({ to, subject, html })` wrapper function
    - If `RESEND_API_KEY` is not set, log warning and return (no-op)
    - Wrap all sends in try/catch — log errors but never throw
  - [ ] Create `lib/email/templates.ts`:
    - Export `emailLayout(content: string): string` — shared HTML layout wrapper with header ("Scotty Ops"), body content slot, and footer
    - Export `orderNotificationEmail({ title, body, ctaText, ctaUrl }): string` — fills the layout with order-specific content
    - Simple inline-CSS HTML (no React email dependency needed)

- [ ] Task 3 — Create notification functions (AC: #1, #2, #3, #4)
  - [ ] Create `lib/email/order-notifications.ts`:
    - `notifyOrderSubmitted(orderId, storeName, itemCount, total)` — sends to all admin emails
    - `notifyOrderApproved(orderId, storeName, submittedByUserId, itemCount)` — sends to submitter + all commissary users
    - `notifyOrderDeclined(orderId, submittedByUserId, declineReason)` — sends to submitter
    - `notifyOrderFulfilled(orderId, submittedByUserId, invoiceId, invoiceNumber)` — sends to submitter
  - [ ] Each function fetches recipient emails from `profiles` using a service-level query pattern
  - [ ] All functions are fire-and-forget (no `await` blocking the caller, or wrap in `Promise.resolve().then(...)`)

- [ ] Task 4 — Fetch recipient emails helper (AC: #1, #2, #3, #4, #6)
  - [ ] In `lib/email/order-notifications.ts`, add helper:
    - `getAdminEmails(supabase)` — fetches all active admin profiles, returns email array
    - `getCommissaryEmails(supabase)` — fetches all active commissary profiles, returns email array
    - `getUserEmail(supabase, userId)` — fetches a single user's email, returns string or null
  - [ ] Use `supabase.auth.admin.listUsers()` or query `auth.users` via the `profiles` join
  - [ ] **Note:** Since server actions use the user's supabase client (with RLS), we need to use the service role client for fetching other users' emails. Create a separate `createServiceClient()` or use `supabase.auth.admin` API.

- [ ] Task 5 — Integrate notifications into existing server actions (AC: #1, #2, #3, #4, #5)
  - [ ] In `app/(dashboard)/orders/actions.ts` — `createOrder()`:
    - After successful order creation, call `notifyOrderSubmitted(...)` (fire-and-forget)
  - [ ] In `app/(dashboard)/orders/[order-id]/actions.ts`:
    - After `updateOrderStatus` with `approved`: call `notifyOrderApproved(...)` (fire-and-forget)
    - After `updateOrderStatus` with `declined`: call `notifyOrderDeclined(...)` (fire-and-forget)
  - [ ] In the fulfillment flow (wherever `fulfill_order_with_invoice` RPC is called):
    - After successful fulfillment: call `notifyOrderFulfilled(...)` (fire-and-forget)
  - [ ] All notification calls are wrapped in try/catch to prevent failures from affecting the action

- [ ] Task 6 — Environment variable documentation (AC: #8)
  - [ ] Update `.env.local.example` with:
    ```
    # Email notifications (Resend)
    RESEND_API_KEY=
    NEXT_PUBLIC_APP_URL=http://localhost:3000
    ```

- [ ] Task 7 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Types:                   import type { ActionResult } from "@/lib/types"
formatPrice:             import { formatPrice } from "@/lib/utils"
```

## Dev Notes

### Resend vs Supabase Email

Supabase has built-in email for auth flows only (magic links, password reset). For application-level transactional emails, we use Resend — a simple API-based email service with a generous free tier (100 emails/day).

### Email Client

```typescript
// lib/email/client.ts
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not configured, skipping email.");
    return;
  }

  try {
    await resend.emails.send({
      from: "Scotty Ops <notifications@yourdomain.com>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });
  } catch (error) {
    console.error("[email] Failed to send:", error);
  }
}
```

### Email Template

```typescript
// lib/email/templates.ts
export function emailLayout(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="border-bottom: 2px solid #18181b; padding-bottom: 12px; margin-bottom: 24px;">
        <h1 style="font-size: 20px; margin: 0;">Scotty Ops</h1>
      </div>
      ${content}
      <div style="border-top: 1px solid #e5e5e5; padding-top: 12px; margin-top: 24px; font-size: 12px; color: #737373;">
        This is an automated notification from Scotty Ops.
      </div>
    </body>
    </html>
  `;
}

export function orderNotificationEmail({
  title,
  body,
  ctaText,
  ctaUrl,
}: {
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
}): string {
  return emailLayout(`
    <h2 style="font-size: 18px; margin: 0 0 12px;">${title}</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #404040;">${body}</p>
    <a href="${ctaUrl}" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #18181b; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px;">
      ${ctaText}
    </a>
  `);
}
```

### Fire-and-Forget Pattern

Notifications must NEVER block or fail the primary action:

```typescript
// In server action, after successful order creation:
// Fire-and-forget — do not await
notifyOrderSubmitted(orderId, storeName, itemCount, total).catch(() => {});
```

### Fetching Recipient Emails

Since server actions run with the user's RLS-scoped client, we need a way to look up other users' emails. Options:

1. **Create a `SECURITY DEFINER` function** that returns emails by role (safest, follows existing pattern)
2. **Use `supabase.auth.admin`** — requires service role key

Recommended: Create a Postgres function `get_emails_by_role(p_role text)` that is `SECURITY DEFINER` with `SET search_path = public, pg_temp`:

```sql
CREATE OR REPLACE FUNCTION get_emails_by_role(p_role text)
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT au.email::text
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE p.role = p_role AND p.is_active = true;
END;
$$;
```

### Migration

```sql
-- Get emails by role for notification purposes
CREATE OR REPLACE FUNCTION get_emails_by_role(p_role text)
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT au.email::text
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE p.role = p_role AND p.is_active = true;
END;
$$;

-- Get a single user's email by user_id
CREATE OR REPLACE FUNCTION get_user_email(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT au.email::text INTO v_email
  FROM auth.users au
  JOIN profiles p ON p.user_id = au.id
  WHERE au.id = p_user_id AND p.is_active = true;
  RETURN v_email;
END;
$$;
```

### Anti-Patterns — NEVER DO

- Block the original action with `await` on email sends — always fire-and-forget
- Throw errors from notification functions — always catch and log
- Use `select('*')` — select specific columns
- Store email content in the database — emails are transient
- Send emails from client components — server actions only
- Hard-code email addresses — always fetch from profiles
- Use `service_role` key directly in app code — use `SECURITY DEFINER` functions instead

## Project Structure Notes

**Files to CREATE:**

```
supabase/migrations/20260325100000_email_notification_helpers.sql  — RPC functions for email lookup
lib/email/client.ts                    — Resend client wrapper
lib/email/templates.ts                 — HTML email templates
lib/email/order-notifications.ts       — Order notification functions
```

**Files to MODIFY:**

```
app/(dashboard)/orders/actions.ts              — Add notification after createOrder
app/(dashboard)/orders/[order-id]/actions.ts   — Add notifications after status changes
.env.local.example                              — Add RESEND_API_KEY, NEXT_PUBLIC_APP_URL
package.json                                    — resend dependency
```

**Files NOT to touch:**
- No UI changes needed — notifications are server-side only
- No changes to existing email templates (auth emails are Supabase built-in)

## Architecture Compliance

**D3 — Migration Strategy:** New timestamped migration for `SECURITY DEFINER` email helper functions.

**D5 — RLS Policy Design:** Email helper functions are `SECURITY DEFINER` so they can access `auth.users` regardless of the caller's role. Always include `SET search_path = public, pg_temp`.

**D7 — Server Actions:** Notifications are called from existing server actions. They are fire-and-forget and never affect the action's return value.

**D9 — Error Handling:** All email errors are caught and logged. No user-facing errors for email failures.

## Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Set `RESEND_API_KEY` in `.env.local`, submit an order — admin(s) receive email
- Manual: Approve an order — store user + commissary users receive emails
- Manual: Decline an order — store user receives email with decline reason
- Manual: Fulfill an order — store user receives email with invoice number
- Manual: Unset `RESEND_API_KEY` — orders still work, console shows warning
- Manual: Verify email layout: "Scotty Ops" header, content, CTA button

## Previous Story Intelligence

1. **`createOrder` in `app/(dashboard)/orders/actions.ts`** — fires the `create_order_with_items` RPC. Add notification call after success.
2. **`updateOrderStatus` in `app/(dashboard)/orders/[order-id]/actions.ts`** — handles approve/decline. Add notification call after success.
3. **`fulfill_order_with_invoice` RPC** is called from `components/orders/fulfill-order-button.tsx` via a server action. Find the fulfill action and add notification there.
4. **`SECURITY DEFINER` pattern** already used for `create_order_with_items`, `fulfill_order_with_invoice`. Follow the same `SET search_path` pattern.
5. **`date-fns` is NOT installed** — use `Intl.DateTimeFormat`.
6. **UI Language is English** — all email content in English.

## Git Intelligence

Recommended commit message:
```
feat: story 8-1 — order email notifications via Resend
```

## References

- [Source: app/(dashboard)/orders/actions.ts] createOrder action
- [Source: app/(dashboard)/orders/[order-id]/actions.ts] updateOrderStatus action
- [Source: lib/types/index.ts] OrderRow, OrderStatus types
- [Source: memory/feedback_ui_language.md] UI must be in English
