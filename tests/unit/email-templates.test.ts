import { describe, expect, it } from "vitest";
import { invitationEmail, notificationEmail, passwordResetEmail, verificationEmail } from "@/lib/email/templates";

const APP_URL = "http://localhost:3000";

const samples = {
  verification: verificationEmail({ to: "esi@example.com", name: "Esi", url: `${APP_URL}/verify-email?token=abc` }),
  reset: passwordResetEmail({ to: "esi@example.com", name: "Esi", url: `${APP_URL}/reset-password?token=def` }),
  invitation: invitationEmail({
    to: "kofi@example.com",
    businessName: "Ama's Fashion House",
    inviterName: "Ama Mensah",
    roleLabel: "Admin",
    url: `${APP_URL}/invite/ghi`,
    businessId: "business-1",
  }),
  notification: notificationEmail({ to: "ama@example.com", title: "New order #1042", body: "Esi ordered 2 items.", url: `${APP_URL}/app/orders` }),
};

describe("email templates", () => {
  it.each(Object.entries(samples))("%s carries the brand, the action link, a preview line and a text version", (_name, email) => {
    expect(email.html).toContain(`<title>${email.subject.replaceAll("'", "&#39;")}</title>`);
    expect(email.html).toContain(`src="${APP_URL}/email/sunleon-mark.png"`);
    expect(email.html).toContain('<meta name="color-scheme" content="light dark">');
    expect(email.html).toMatch(/<div style="display:none;[^"]*">[^<]+&#847;/);
    expect(email.text.startsWith("SUNLEON AI\n")).toBe(true);
    expect(email.text).toContain("localhost:3000");
  });

  it.each(Object.entries(samples))("%s copy uses no em or en dashes", (_name, email) => {
    expect(email.html).not.toMatch(/[–—]/);
    expect(email.text).not.toMatch(/[–—]/);
  });

  it("puts each link in the button, the fallback link and the plain text", () => {
    const url = `${APP_URL}/verify-email?token=abc`;
    expect(samples.verification.html.split(`href="${url}"`)).toHaveLength(3);
    expect(samples.verification.text).toContain(`Confirm email address:\n${url}`);
    expect(samples.verification.text).toContain("This link expires in 24 hours.");
    expect(samples.reset.text).toContain("expires in 1 hour");
    expect(samples.invitation.text).toContain("expires in 7 days");
  });

  it("escapes names and workspace names so they cannot inject markup", () => {
    const email = invitationEmail({
      to: "x@example.com",
      businessName: '<img src=x onerror="alert(1)">',
      inviterName: "Kojo & Sons",
      roleLabel: "Member",
      url: `${APP_URL}/invite/a?b=1&c=2`,
      businessId: "b",
    });
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(email.html).toContain("Kojo &amp; Sons");
    expect(email.html).toContain(`href="${APP_URL}/invite/a?b=1&amp;c=2"`);
    expect(email.text).toContain("Kojo & Sons");
  });

  it("lists the invitation's workspace, role and inviter", () => {
    expect(samples.invitation.text).toContain("Workspace: Ama's Fashion House\nYour role: Admin\nInvited by: Ama Mensah");
    expect(samples.invitation.html).toContain("Your role");
    expect(samples.invitation.businessId).toBe("business-1");
  });

  it("leaves the button out of a notification without a link and offers alert settings", () => {
    const email = notificationEmail({ to: "a@example.com", title: "Low stock", body: "Kente scarf is down to 2." });
    expect(email.html).not.toContain('class="sl-btn"');
    expect(email.html).toContain(`href="${APP_URL}/app/settings#notifications"`);
    expect(email.text).toContain(`Change alerts: ${APP_URL}/app/settings#notifications`);
  });
});
