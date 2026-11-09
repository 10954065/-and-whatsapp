import type { EmailMessage } from "@/lib/email";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface LayoutInput {
  preview: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footnote?: string;
}

function layout({ preview, heading, paragraphs, action, footnote }: LayoutInput): { html: string; text: string } {
  const body = paragraphs
    .map((paragraph) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155">${escapeHtml(paragraph)}</p>`)
    .join("");
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#5b3df5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 16px;font-size:13px;line-height:20px;color:#64748b">Or paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(action.url)}</span></p>`
    : "";
  const note = footnote
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#94a3b8">${escapeHtml(footnote)}</p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5fb;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0">
<tr><td style="padding:28px 32px 0"><span style="font-weight:800;font-size:16px;letter-spacing:0.08em;color:#0b1437">SUNLEON<span style="color:#5b3df5"> AI</span></span></td></tr>
<tr><td style="padding:20px 32px 32px"><h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#0b1437">${escapeHtml(heading)}</h1>${body}${button}${note}</td></tr>
</table>
<p style="margin:16px 0 0;font-size:12px;color:#94a3b8">SUNLEON AI · Sunleon Router Enterprise · Accra, Ghana</p>
</td></tr></table></body></html>`;
  const text = [heading, "", ...paragraphs, ...(action ? ["", `${action.label}: ${action.url}`] : []), ...(footnote ? ["", footnote] : [])].join("\n");
  return { html, text };
}

export function verificationEmail(input: { to: string; name: string; url: string }): EmailMessage {
  const content = layout({
    preview: "Confirm your email address for SUNLEON AI",
    heading: `Welcome, ${input.name}`,
    paragraphs: ["Confirm your email address to finish setting up your SUNLEON AI account. The link expires in 24 hours."],
    action: { label: "Confirm email", url: input.url },
    footnote: "If you did not create a SUNLEON AI account, you can ignore this email.",
  });
  return { to: input.to, subject: "Confirm your email address", template: "email_verification", ...content };
}

export function passwordResetEmail(input: { to: string; name: string; url: string }): EmailMessage {
  const content = layout({
    preview: "Reset your SUNLEON AI password",
    heading: "Reset your password",
    paragraphs: [`Hi ${input.name}, we received a request to reset your password. The link expires in 1 hour and can be used once.`],
    action: { label: "Choose a new password", url: input.url },
    footnote: "If you did not request this, no action is needed. Your password stays the same.",
  });
  return { to: input.to, subject: "Reset your SUNLEON AI password", template: "password_reset", ...content };
}

export function invitationEmail(input: {
  to: string;
  businessName: string;
  inviterName: string;
  roleLabel: string;
  url: string;
  businessId: string;
}): EmailMessage {
  const content = layout({
    preview: `${input.inviterName} invited you to ${input.businessName} on SUNLEON AI`,
    heading: `Join ${input.businessName} on SUNLEON AI`,
    paragraphs: [`${input.inviterName} invited you to join ${input.businessName} as ${input.roleLabel}. The invitation expires in 7 days.`],
    action: { label: "Accept invitation", url: input.url },
  });
  return {
    to: input.to,
    subject: `You're invited to ${input.businessName}`,
    template: "invitation",
    businessId: input.businessId,
    ...content,
  };
}

export function notificationEmail(input: {
  to: string;
  title: string;
  body: string;
  url?: string;
  businessId?: string | null;
}): EmailMessage {
  const content = layout({
    preview: input.title,
    heading: input.title,
    paragraphs: [input.body],
    action: input.url ? { label: "Open SUNLEON AI", url: input.url } : undefined,
  });
  return { to: input.to, subject: input.title, template: "notification", businessId: input.businessId, ...content };
}
