import { sendEmail } from "./client";
import { notificationEmail } from "./templates";
import { escapeHtml } from "./escape-html";
import { getScoreLabel } from "@/lib/constants/audit-status";
import { createClient } from "@/lib/supabase/server";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
  const isCritical = score < 60;
  const scoreLabel = getScoreLabel(score);
  const dateFmt = new Intl.DateTimeFormat("en-CA", { dateStyle: "long" });

  // Fetch recipients
  const [storeEmailsResult, adminEmailsResult] = await Promise.all([
    supabase.rpc("get_store_user_emails", { p_store_id: storeId }),
    supabase.rpc("get_emails_by_role", { p_role: "admin" }),
  ]);

  const storeEmails = storeEmailsResult.data?.map((d: { email: string }) => d.email) ?? [];
  const adminEmails = adminEmailsResult.data?.map((d: { email: string }) => d.email) ?? [];
  const allRecipients = [...new Set([...storeEmails, ...adminEmails])];

  if (allRecipients.length === 0) return;

  const safeName = escapeHtml(storeName);
  const safeTemplate = escapeHtml(templateName);
  const safeConductor = escapeHtml(conductorName);

  const subject = isCritical
    ? `Audit Completed — ${storeName} ⚠ Critical Score`
    : `Audit Completed — ${storeName}`;

  const scoreDisplay = isCritical
    ? `<span style="color: #dc2626; font-weight: bold;">${score}% — ${escapeHtml(scoreLabel)}</span>`
    : `<strong>${score}% — ${escapeHtml(scoreLabel)}</strong>`;

  const html = notificationEmail({
    title: "Audit Completed",
    body: `
      An audit has been completed for <strong>${safeName}</strong>.<br><br>
      <strong>Template:</strong> ${safeTemplate}<br>
      <strong>Score:</strong> ${scoreDisplay}<br>
      <strong>Conducted by:</strong> ${safeConductor}<br>
      <strong>Date:</strong> ${dateFmt.format(new Date())}
    `,
    ctaText: "View Audit",
    ctaUrl: `${appUrl()}/audits/${encodeURIComponent(auditId)}`,
  });

  await sendEmail({ to: allRecipients, subject, html });
}
