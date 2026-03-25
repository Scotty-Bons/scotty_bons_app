export function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fafafa;">
  <div style="background: #fff; border-radius: 8px; padding: 24px; border: 1px solid #e5e5e5;">
    <div style="border-bottom: 2px solid #18181b; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="font-size: 20px; margin: 0; color: #18181b;">Scotty Ops</h1>
    </div>
    ${content}
  </div>
  <div style="text-align: center; padding-top: 16px; font-size: 12px; color: #737373;">
    This is an automated notification from Scotty Ops.
  </div>
</body>
</html>`;
}

export function notificationEmail({
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
    <h2 style="font-size: 18px; margin: 0 0 12px; color: #18181b;">${title}</h2>
    <div style="font-size: 14px; line-height: 1.6; color: #404040;">${body}</div>
    <div style="margin-top: 20px;">
      <a href="${ctaUrl}" style="display: inline-block; padding: 10px 24px; background: #18181b; color: #fff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500;">
        ${ctaText}
      </a>
    </div>
  `);
}
