# Story 8.2: Audit Submitted Email Notification

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Store user,
I want to receive an email notification when an audit of my store is completed,
so that I can review the results promptly and address any issues.

As an Admin,
I want all admins to be notified when any audit is completed,
so that the leadership team stays informed about compliance results.

## Acceptance Criteria

1. **Given** an Admin or Commissary user completes an audit (sets `conducted_at`),
   **When** the audit is successfully marked as completed,
   **Then** the Store user(s) associated with the audited store receive an email with subject "Audit Completed — {store name}" containing: store name, template name, overall score with label (e.g., "85.5% — Good"), conductor name, date, and a link to the audit detail page.

2. **Given** an audit is completed,
   **When** the notification is sent,
   **Then** all Admin users also receive an email with the same content, so leadership is aware of compliance results.

3. **Given** the audit score is below 60%,
   **When** the email is sent,
   **Then** the email subject includes a warning: "Audit Completed — {store name} ⚠ Critical Score" and the score is highlighted in red in the email body.

4. **Given** email sending fails,
   **When** the notification function encounters an error,
   **Then** the error is logged server-side but does NOT block or fail the audit completion — the audit is still marked as completed.

5. **Given** the `RESEND_API_KEY` environment variable is not configured,
   **When** an audit is completed,
   **Then** the notification function is a no-op — it logs a warning and returns without error.

6. **Given** the email is received,
   **When** the recipient reads it,
   **Then** it uses the same "Scotty Ops" email layout from Story 8-1 with a "View Audit" CTA button.

## Tasks / Subtasks

- [ ] Task 1 — Create audit notification function (AC: #1, #2, #3, #4, #5, #6)
  - [ ] Create `lib/email/audit-notifications.ts`:
    - `notifyAuditCompleted(auditId, storeId, storeName, templateName, score, conductorName)`:
      - Fetches store users' emails via `get_emails_by_role_and_store(p_role, p_store_id)` or filter `get_emails_by_role('store')` + check `store_id`
      - Fetches admin emails via `get_emails_by_role('admin')`
      - Builds email content with score, label, conductor name, date
      - If score < 60%, adds warning to subject and highlights score in red
      - Uses `emailLayout` and `orderNotificationEmail` (rename to generic `notificationEmail`) from `lib/email/templates.ts`
      - Fire-and-forget, wrapped in try/catch

- [ ] Task 2 — DB migration: add store-scoped email helper (AC: #1)
  - [ ] Create `supabase/migrations/20260325110000_email_store_users_helper.sql`:
    ```sql
    CREATE OR REPLACE FUNCTION get_store_user_emails(p_store_id uuid)
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
      WHERE p.role = 'store' AND p.store_id = p_store_id AND p.is_active = true;
    END;
    $$;
    ```
  - [ ] **Note:** If Story 8-1's migration already covers a generic version, adapt it. Otherwise add this specific function.

- [ ] Task 3 — Integrate notification into completeAudit action (AC: #1, #2, #4)
  - [ ] In `app/(dashboard)/audits/actions.ts`, `completeAudit()`:
    - After successful audit completion (after the `.update()` call), call `notifyAuditCompleted(...)` fire-and-forget
    - Pass: `audit.id`, `audit.store_id`, store name (fetch if not available), template name, score, conductor name
    - Fetch store name and template name from existing queries or add to the audit fetch

- [ ] Task 4 — Rename email template function for reuse (AC: #6)
  - [ ] In `lib/email/templates.ts`, rename `orderNotificationEmail` to `notificationEmail` (or add an alias) since it's now used for audits too
  - [ ] Update references in `lib/email/order-notifications.ts`

- [ ] Task 5 — Build and lint verification (AC: all)
  - [ ] Run `npm run build` — zero errors
  - [ ] Run `npm run lint` — zero warnings/errors

## Quick Reference — Existing Code to Reuse

```
Supabase server client:  import { createClient } from "@/lib/supabase/server"
Email client:            import { sendEmail } from "@/lib/email/client"       (from Story 8-1)
Email templates:         import { notificationEmail } from "@/lib/email/templates"  (from Story 8-1)
Score helpers:           import { getScoreLabel } from "@/lib/constants/audit-status"
Types:                   import type { ActionResult } from "@/lib/types"
```

## Dev Notes

### Dependency on Story 8-1

This story depends on Story 8-1 being implemented first, as it reuses:
- `lib/email/client.ts` — Resend client wrapper
- `lib/email/templates.ts` — email layout and notification template
- `get_emails_by_role()` — migration from 8-1

### Notification Function

```typescript
// lib/email/audit-notifications.ts
import { sendEmail } from "./client";
import { notificationEmail } from "./templates";
import { getScoreLabel } from "@/lib/constants/audit-status";
import { createClient } from "@/lib/supabase/server";

export async function notifyAuditCompleted({
  auditId,
  storeId,
  storeName,
  templateName,
  score,
  conductorName,
}: {
  auditId: string;
  storeId: string;
  storeName: string;
  templateName: string;
  score: number;
  conductorName: string;
}): Promise<void> {
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const isCritical = score < 60;
  const scoreLabel = getScoreLabel(score);
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });

  // Fetch recipients
  const [storeEmails, adminEmails] = await Promise.all([
    supabase.rpc("get_store_user_emails", { p_store_id: storeId }).then((r) => r.data?.map((d) => d.email) ?? []),
    supabase.rpc("get_emails_by_role", { p_role: "admin" }).then((r) => r.data?.map((d) => d.email) ?? []),
  ]);

  const allRecipients = [...new Set([...storeEmails, ...adminEmails])];
  if (allRecipients.length === 0) return;

  const subject = isCritical
    ? `Audit Completed — ${storeName} ⚠ Critical Score`
    : `Audit Completed — ${storeName}`;

  const scoreDisplay = isCritical
    ? `<span style="color: #dc2626; font-weight: bold;">${score}% — ${scoreLabel}</span>`
    : `<strong>${score}% — ${scoreLabel}</strong>`;

  const html = notificationEmail({
    title: "Audit Completed",
    body: `
      An audit has been completed for <strong>${storeName}</strong>.<br><br>
      <strong>Template:</strong> ${templateName}<br>
      <strong>Score:</strong> ${scoreDisplay}<br>
      <strong>Conducted by:</strong> ${conductorName}<br>
      <strong>Date:</strong> ${dateFmt.format(new Date())}
    `,
    ctaText: "View Audit",
    ctaUrl: `${appUrl}/audits/${auditId}`,
  });

  await sendEmail({ to: allRecipients, subject, html });
}
```

### Integration in completeAudit

```typescript
// In app/(dashboard)/audits/actions.ts, after successful update:

// Fetch store name and template name for notification
const { data: storeData } = await auth.supabase.from("stores").select("name").eq("id", audit.store_id).single();
const { data: templateData } = await auth.supabase.from("audit_templates").select("name").eq("id", audit.template_id).single();
const { data: conductorProfile } = await auth.supabase.from("profiles").select("full_name").eq("user_id", auth.userId).single();

// Fire-and-forget
notifyAuditCompleted({
  auditId: audit.id,
  storeId: audit.store_id,
  storeName: storeData?.name ?? "Unknown Store",
  templateName: templateData?.name ?? "Audit",
  score,
  conductorName: conductorProfile?.full_name ?? "Unknown",
}).catch(() => {});
```

### Anti-Patterns — NEVER DO

- Block the audit completion with `await` on email — fire-and-forget
- Throw errors from notification functions — always catch and log
- Send audit details to users who shouldn't see them (RLS handles page access, but emails should only go to store + admin)
- Use `select('*')` — select specific columns
- Hard-code email addresses

## Project Structure Notes

**Files to CREATE:**

```
supabase/migrations/20260325110000_email_store_users_helper.sql  — Store-scoped email helper
lib/email/audit-notifications.ts                                  — Audit notification function
```

**Files to MODIFY:**

```
app/(dashboard)/audits/actions.ts      — Add notification call in completeAudit
lib/email/templates.ts                 — Rename orderNotificationEmail → notificationEmail
lib/email/order-notifications.ts       — Update import to use renamed function
```

**Files NOT to touch:**
- No UI changes — notifications are server-side only
- No changes to audit pages or components

## Architecture Compliance

**D3 — Migration Strategy:** New timestamped migration for `get_store_user_emails` function.

**D5 — RLS Policy Design:** Email helper function is `SECURITY DEFINER` with `SET search_path = public, pg_temp`.

**D7 — Server Actions:** Notification call added to existing `completeAudit` action. Fire-and-forget, never affects the action's return value.

**D9 — Error Handling:** All email errors caught and logged. No user-facing errors for email failures.

## Testing Requirements

- Run `npm run build` — zero errors
- Run `npm run lint` — zero warnings/errors
- Manual: Complete an audit with `RESEND_API_KEY` set — store users + admins receive email
- Manual: Complete an audit with score < 60% — email subject has "⚠ Critical Score" warning
- Manual: Complete an audit with score ≥ 60% — normal email without warning
- Manual: Verify email content: store name, template, score, conductor, "View Audit" button
- Manual: Unset `RESEND_API_KEY` — audit completion still works, console shows warning
- Manual: Complete audit for store with no active users — no emails sent, no errors

## Previous Story Intelligence

1. **Story 8-1 must be implemented first** — provides email client, templates, and base migration.
2. **`completeAudit` in `app/(dashboard)/audits/actions.ts`** — this is where the notification call goes, after the `.update()` succeeds and before the return.
3. **`getScoreLabel()` exists** in `lib/constants/audit-status.ts` for score text labels.
4. **`profiles` has `full_name` column** — used for conductor name display.
5. **Fire-and-forget pattern** from 8-1: `notifyAuditCompleted(...).catch(() => {})`.

## Git Intelligence

Recommended commit message:
```
feat: story 8-2 — audit completion email notification to store users and admins
```

## References

- [Source: app/(dashboard)/audits/actions.ts] completeAudit action
- [Source: lib/email/client.ts] Resend client (from Story 8-1)
- [Source: lib/email/templates.ts] Email templates (from Story 8-1)
- [Source: lib/constants/audit-status.ts] Score label helpers
- [Source: memory/feedback_ui_language.md] UI must be in English
