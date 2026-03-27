import { sendEmail } from "./client";
import { notificationEmail } from "./templates";
import { escapeHtml } from "./escape-html";

const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  commissary: "Commissary",
  store: "Store User",
};

export async function notifyUserCreated({
  email,
  name,
  role,
  storeName,
}: {
  email: string;
  name: string;
  role: string;
  storeName?: string | null;
}) {
  const safeName = escapeHtml(name);
  const roleLabel = ROLE_LABELS[role] ?? role;
  const storeInfo = storeName
    ? `<p>You have been assigned to the store <strong>${escapeHtml(storeName)}</strong>.</p>`
    : "";

  const html = notificationEmail({
    title: "Welcome to Scotty Ops",
    body: `
      <p>Hi ${safeName},</p>
      <p>An account has been created for you on Scotty Ops with the role <strong>${roleLabel}</strong>.</p>
      ${storeInfo}
      <p>To get started, please set your password by clicking the button below.</p>
    `,
    ctaText: "Set Your Password",
    ctaUrl: `${appUrl()}/forgot-password`,
  });

  await sendEmail({
    to: email,
    subject: "Welcome to Scotty Ops — Set Your Password",
    html,
  });
}
