import { sendEmail } from "./client";
import { notificationEmail } from "./templates";
import { escapeHtml } from "./escape-html";
import { createClient } from "@/lib/supabase/server";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

async function getEmailsByRole(role: string): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_emails_by_role", { p_role: role });
    return data?.map((d: { email: string }) => d.email) ?? [];
  } catch {
    return [];
  }
}

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_user_email", { p_user_id: userId });
    return data ?? null;
  } catch {
    return null;
  }
}

export async function notifyOrderSubmitted(
  orderId: string,
  storeName: string,
  itemCount: number,
): Promise<void> {
  const adminEmails = await getEmailsByRole("admin");
  if (adminEmails.length === 0) return;

  const safe = escapeHtml(storeName);
  const shortId = escapeHtml(orderId.slice(0, 8));

  const html = notificationEmail({
    title: "New Order Submitted",
    body: `
      A new order has been submitted by <strong>${safe}</strong>.<br><br>
      <strong>Order:</strong> #${shortId}<br>
      <strong>Items:</strong> ${itemCount}
    `,
    ctaText: "View Order",
    ctaUrl: `${appUrl()}/orders/${encodeURIComponent(orderId)}`,
  });

  await sendEmail({
    to: adminEmails,
    subject: `New Order Submitted — ${storeName}`,
    html,
  });
}

export async function notifyOrderApproved(
  orderId: string,
  storeName: string,
  submittedByUserId: string,
  itemCount: number,
): Promise<void> {
  const [submitterEmail, commissaryEmails] = await Promise.all([
    getUserEmail(submittedByUserId),
    getEmailsByRole("commissary"),
  ]);

  const shortId = escapeHtml(orderId.slice(0, 8));
  const safeName = escapeHtml(storeName);

  // Notify submitter
  if (submitterEmail) {
    const html = notificationEmail({
      title: "Order Approved",
      body: `Your order <strong>#${shortId}</strong> has been approved and is being prepared.`,
      ctaText: "View Order",
      ctaUrl: `${appUrl()}/orders/${encodeURIComponent(orderId)}`,
    });

    await sendEmail({
      to: submitterEmail,
      subject: `Order Approved — #${orderId.slice(0, 8)}`,
      html,
    });
  }

  // Notify commissary
  if (commissaryEmails.length > 0) {
    const html = notificationEmail({
      title: "Order Approved — Ready for Fulfillment",
      body: `
        An order from <strong>${safeName}</strong> has been approved.<br><br>
        <strong>Order:</strong> #${shortId}<br>
        <strong>Items:</strong> ${itemCount}
      `,
      ctaText: "View Order",
      ctaUrl: `${appUrl()}/orders/${encodeURIComponent(orderId)}`,
    });

    await sendEmail({
      to: commissaryEmails,
      subject: "Order Approved — Ready for Fulfillment",
      html,
    });
  }
}

export async function notifyOrderDeclined(
  orderId: string,
  submittedByUserId: string,
  declineReason: string | null,
): Promise<void> {
  const submitterEmail = await getUserEmail(submittedByUserId);
  if (!submitterEmail) return;

  const shortId = escapeHtml(orderId.slice(0, 8));
  const reasonText = declineReason
    ? `<br><br><strong>Reason:</strong> ${escapeHtml(declineReason)}`
    : "";

  const html = notificationEmail({
    title: "Order Declined",
    body: `Your order <strong>#${shortId}</strong> has been declined.${reasonText}`,
    ctaText: "View Order",
    ctaUrl: `${appUrl()}/orders/${encodeURIComponent(orderId)}`,
  });

  await sendEmail({
    to: submitterEmail,
    subject: `Order Declined — #${orderId.slice(0, 8)}`,
    html,
  });
}

export async function notifyOrderFulfilled(
  orderId: string,
  submittedByUserId: string,
  invoiceId: string,
  invoiceNumber: string,
): Promise<void> {
  const submitterEmail = await getUserEmail(submittedByUserId);
  if (!submitterEmail) return;

  const shortId = escapeHtml(orderId.slice(0, 8));
  const safeInvoice = escapeHtml(invoiceNumber);

  const html = notificationEmail({
    title: "Order Fulfilled",
    body: `
      Your order <strong>#${shortId}</strong> has been fulfilled.<br><br>
      <strong>Invoice:</strong> ${safeInvoice}
    `,
    ctaText: "View Invoice",
    ctaUrl: `${appUrl()}/invoices/${encodeURIComponent(invoiceId)}`,
  });

  await sendEmail({
    to: submitterEmail,
    subject: `Order Fulfilled — #${orderId.slice(0, 8)}`,
    html,
  });
}
