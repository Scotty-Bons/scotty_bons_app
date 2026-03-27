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
  console.log("[email] sendEmail called:", { to, subject, hasResend: !!resend });

  if (!resend) {
    console.warn("[email] RESEND_API_KEY not configured, skipping email.");
    return;
  }

  try {
    const result = await resend.emails.send({
      from: `Scotty Ops <${process.env.RESEND_FROM_EMAIL ?? "notifications@resend.dev"}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });
    console.log("[email] Sent successfully:", result);
  } catch (error) {
    console.error("[email] Failed to send:", error);
  }
}
