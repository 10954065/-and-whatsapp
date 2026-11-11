import type { EmailMessage } from "@/lib/email";
import { env } from "@/lib/env";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** The app's light palette in hex (email clients ignore oklch). Links use a darker sun step for contrast. */
const COLOR = {
  page: "#f4efe6",
  card: "#fffdf9",
  border: "#e7dfd1",
  panel: "#f7f2e9",
  ink: "#1d1a16",
  body: "#3b352e",
  muted: "#7a7166",
  link: "#b4500f",
} as const;

const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";
const SANS = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Dark-mode overrides for clients that honour them (Apple Mail, iOS, Outlook.com via data-ogsc). */
const DARK: Record<string, string> = {
  "sl-page": "background:#14110e!important",
  "sl-card": "background:#1d1a16!important;border-color:#302a24!important",
  "sl-panel": "background:#26201a!important",
  "sl-ink": "color:#f3efe7!important",
  "sl-body": "color:#d8d0c4!important",
  "sl-muted": "color:#a1978a!important",
  "sl-rule": "border-color:#302a24!important",
  "sl-btn": "background:#f3efe7!important",
  "sl-btn-a": "color:#1d1a16!important",
  "sl-link": "color:#f2a46a!important",
};

const STYLES = [
  ":root{color-scheme:light dark;supported-color-schemes:light dark}",
  `@media (prefers-color-scheme:dark){${Object.entries(DARK).map(([name, rule]) => `.${name}{${rule}}`).join("")}}`,
  Object.entries(DARK).map(([name, rule]) => `[data-ogsc] .${name}{${rule}}`).join(""),
  "@media (max-width:620px){.sl-pad{padding-left:24px!important;padding-right:24px!important}.sl-h1{font-size:30px!important;line-height:36px!important}}",
].join("\n");

interface EmailDetail {
  label: string;
  value: string;
}

interface LayoutInput {
  subject: string;
  /** Inbox preview line shown after the subject. */
  preview: string;
  heading: string;
  greeting?: string;
  paragraphs: string[];
  details?: EmailDetail[];
  action?: { label: string; url: string };
  /** Small line under the button, e.g. when the link expires. */
  note?: string;
  /** Closing line inside the card, below a rule. */
  footnote?: string;
  /** Footer line saying why this address received the email. */
  reason: string;
  /** Optional footer link, e.g. to notification settings. */
  manage?: { label: string; url: string };
}

function paragraphsHtml(lines: string[]): string {
  return lines
    .map((line) => `<p class="sl-body" style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:26px;color:${COLOR.body}">${escapeHtml(line)}</p>`)
    .join("");
}

function detailsHtml(details: EmailDetail[]): string {
  const rows = details
    .map(
      (detail, index) => `<tr>
<td class="sl-muted${index ? " sl-rule" : ""}" width="38%" style="padding:12px 18px;font-family:${SANS};font-size:13px;line-height:20px;color:${COLOR.muted};${index ? `border-top:1px solid ${COLOR.border};` : ""}">${escapeHtml(detail.label)}</td>
<td class="sl-ink${index ? " sl-rule" : ""}" style="padding:12px 18px;font-family:${SANS};font-size:14px;line-height:20px;font-weight:600;color:${COLOR.ink};${index ? `border-top:1px solid ${COLOR.border};` : ""}">${escapeHtml(detail.value)}</td>
</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sl-panel" style="margin:8px 0 8px;background:${COLOR.panel};border-radius:14px">${rows}</table>`;
}

function actionHtml(action: { label: string; url: string }, note?: string): string {
  const url = escapeHtml(action.url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0"><tr>
<td class="sl-btn" bgcolor="${COLOR.ink}" style="border-radius:999px;background:${COLOR.ink}">
<a class="sl-btn-a" href="${url}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:15px;font-weight:600;line-height:20px;color:${COLOR.card};text-decoration:none;border-radius:999px">${escapeHtml(action.label)}</a>
</td></tr></table>
${note ? `<p class="sl-muted" style="margin:16px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${COLOR.muted}">${escapeHtml(note)}</p>` : ""}
<p class="sl-muted" style="margin:20px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${COLOR.muted}">Button not working? Copy this link into your browser:<br>
<a class="sl-link" href="${url}" target="_blank" style="color:${COLOR.link};text-decoration:underline;word-break:break-all">${url}</a></p>`;
}

function headerHtml(appUrl: string): string {
  return `<tr><td style="padding:0 4px 24px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><img src="${escapeHtml(appUrl)}/email/sunleon-mark.png" width="32" height="32" alt="" style="display:block;border:0;border-radius:9px"></td>
<td style="padding-left:10px;vertical-align:middle;white-space:nowrap"><span class="sl-ink" style="font-family:${SERIF};font-size:25px;line-height:28px;color:${COLOR.ink}">Sunleon</span><span class="sl-muted" style="padding-left:4px;font-family:${SANS};font-size:10px;line-height:28px;font-weight:600;letter-spacing:0.08em;color:${COLOR.muted}">AI</span></td>
</tr></table></td></tr>`;
}

function footerHtml(input: Pick<LayoutInput, "reason" | "manage">, appUrl: string): string {
  const host = new URL(appUrl).host;
  const manage = input.manage
    ? ` <a class="sl-muted" href="${escapeHtml(input.manage.url)}" target="_blank" style="color:${COLOR.muted};text-decoration:underline">${escapeHtml(input.manage.label)}</a>`
    : "";
  return `<tr><td align="center" class="sl-muted" style="padding:28px 24px 0;font-family:${SANS};font-size:12px;line-height:19px;color:${COLOR.muted}">
${escapeHtml(input.reason)}${manage}<br>
<a class="sl-muted" href="${escapeHtml(appUrl)}" target="_blank" style="color:${COLOR.muted};text-decoration:underline">${escapeHtml(host)}</a> · Sunleon Router Enterprise, Accra, Ghana
</td></tr>`;
}

function cardHtml(input: LayoutInput): string {
  const greeting = input.greeting
    ? `<p class="sl-ink" style="margin:0 0 12px;font-family:${SANS};font-size:16px;line-height:26px;font-weight:600;color:${COLOR.ink}">${escapeHtml(input.greeting)}</p>`
    : "";
  const footnote = input.footnote
    ? `<tr><td class="sl-pad sl-rule sl-muted" style="padding:20px 44px 28px;border-top:1px solid ${COLOR.border};font-family:${SANS};font-size:13px;line-height:20px;color:${COLOR.muted}">${escapeHtml(input.footnote)}</td></tr>`
    : "";
  return `<tr><td class="sl-card" style="background:${COLOR.card};border:1px solid ${COLOR.border};border-radius:20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td class="sl-pad" style="padding:44px 44px ${input.footnote ? "32px" : "40px"}">
<h1 class="sl-ink sl-h1" style="margin:0 0 20px;font-family:${SERIF};font-size:36px;line-height:42px;font-weight:400;letter-spacing:-0.01em;color:${COLOR.ink}">${escapeHtml(input.heading)}</h1>
${greeting}${paragraphsHtml(input.paragraphs)}${input.details ? detailsHtml(input.details) : ""}${input.action ? actionHtml(input.action, input.note) : ""}
</td></tr>${footnote}
</table></td></tr>`;
}

function plainText(input: LayoutInput, appUrl: string): string {
  return [
    "SUNLEON AI",
    "",
    input.heading,
    "",
    ...(input.greeting ? [input.greeting, ""] : []),
    ...input.paragraphs.flatMap((line) => [line, ""]),
    ...(input.details ? [...input.details.map((detail) => `${detail.label}: ${detail.value}`), ""] : []),
    ...(input.action ? [`${input.action.label}:`, input.action.url, ""] : []),
    ...(input.note ? [input.note, ""] : []),
    ...(input.footnote ? [input.footnote, ""] : []),
    "---",
    input.reason,
    ...(input.manage ? [`${input.manage.label}: ${input.manage.url}`] : []),
    `SUNLEON AI · ${new URL(appUrl).host}`,
  ].join("\n");
}

function layout(input: LayoutInput): { html: string; text: string } {
  const appUrl = env().APP_URL;
  // Filler after the preview text stops clients pulling body copy into the inbox preview.
  const preheader = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;opacity:0;color:${COLOR.page}">${escapeHtml(input.preview)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>`;
  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(input.subject)}</title>
<style>${STYLES}</style>
</head>
<body class="sl-page" style="margin:0;padding:0;background:${COLOR.page};-webkit-text-size-adjust:100%">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="sl-page" bgcolor="${COLOR.page}" style="background:${COLOR.page}">
<tr><td align="center" style="padding:40px 16px 48px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
${headerHtml(appUrl)}
${cardHtml(input)}
${footerHtml(input, appUrl)}
</table>
</td></tr></table>
</body>
</html>`;
  return { html, text: plainText(input, appUrl) };
}

export function verificationEmail(input: { to: string; name: string; url: string }): EmailMessage {
  const subject = "Confirm your email for SUNLEON AI";
  const content = layout({
    subject,
    preview: "One click and your account is ready.",
    heading: "Confirm your email",
    greeting: `Hi ${input.name},`,
    paragraphs: ["Welcome to SUNLEON AI. Confirm that this is your email address to finish setting up your account."],
    action: { label: "Confirm email address", url: input.url },
    note: "This link expires in 24 hours.",
    footnote: "Didn't create an account? You can ignore this email. Nothing happens unless the address is confirmed.",
    reason: "You're receiving this because this address was used to sign up for SUNLEON AI.",
  });
  return { to: input.to, subject, template: "email_verification", ...content };
}

export function passwordResetEmail(input: { to: string; name: string; url: string }): EmailMessage {
  const subject = "Reset your SUNLEON AI password";
  const content = layout({
    subject,
    preview: "Choose a new password. The link works for 1 hour.",
    heading: "Reset your password",
    greeting: `Hi ${input.name},`,
    paragraphs: ["We received a request to reset the password for your SUNLEON AI account. Use the button below to choose a new one."],
    action: { label: "Choose a new password", url: input.url },
    note: "The link works once and expires in 1 hour.",
    footnote: "Didn't ask for this? Your password hasn't changed, and you can ignore this email.",
    reason: "You're receiving this because a password reset was requested for this address.",
  });
  return { to: input.to, subject, template: "password_reset", ...content };
}

export function invitationEmail(input: {
  to: string;
  businessName: string;
  inviterName: string;
  roleLabel: string;
  url: string;
  businessId: string;
}): EmailMessage {
  const subject = `You're invited to join ${input.businessName}`;
  const content = layout({
    subject,
    preview: `${input.inviterName} invited you to join ${input.businessName} on SUNLEON AI.`,
    heading: `Join ${input.businessName}`,
    paragraphs: [
      `${input.inviterName} has invited you to join ${input.businessName} on SUNLEON AI, where the team handles WhatsApp and Instagram conversations, orders and bookings together.`,
    ],
    details: [
      { label: "Workspace", value: input.businessName },
      { label: "Your role", value: input.roleLabel },
      { label: "Invited by", value: input.inviterName },
    ],
    action: { label: "Accept invitation", url: input.url },
    note: "The invitation expires in 7 days.",
    footnote: "Not expecting this? You can ignore it. You won't be added unless you accept.",
    reason: `You're receiving this because ${input.inviterName} invited this address to ${input.businessName}.`,
  });
  return { to: input.to, subject, template: "invitation", businessId: input.businessId, ...content };
}

export function notificationEmail(input: {
  to: string;
  title: string;
  body: string;
  url?: string;
  businessId?: string | null;
}): EmailMessage {
  const content = layout({
    subject: input.title,
    preview: input.body.slice(0, 140),
    heading: input.title,
    paragraphs: [input.body],
    action: input.url ? { label: "View in SUNLEON AI", url: input.url } : undefined,
    reason: "You're receiving this because email alerts are on for your workspace.",
    manage: { label: "Change alerts", url: `${env().APP_URL}/app/settings#notifications` },
  });
  return { to: input.to, subject: input.title, template: "notification", businessId: input.businessId, ...content };
}
