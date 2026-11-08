import { Resend } from "resend";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/monitoring/logger";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Template identifier recorded in EmailLog. */
  template: string;
  businessId?: string | null;
}

interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string | null }>;
}

class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<{ id: string | null }> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) throw new Error(`Resend rejected the email: ${error.message}`);
    return { id: data?.id ?? null };
  }
}

/** Development fallback: prints the email (including links) to the server log. */
class LogEmailProvider implements EmailProvider {
  readonly name = "log";

  async send(message: EmailMessage): Promise<{ id: string | null }> {
    if (env().NODE_ENV === "production") {
      logger.warn("email.provider_not_configured", { template: message.template });
      throw new Error("Email delivery is not configured (RESEND_API_KEY missing).");
    }
    logger.info("email.dev_delivery", { to: message.to, subject: message.subject, body: message.text });
    return { id: null };
  }
}

let provider: EmailProvider | undefined;

function emailProvider(): EmailProvider {
  if (!provider) {
    const { RESEND_API_KEY, EMAIL_FROM } = env();
    provider = RESEND_API_KEY ? new ResendEmailProvider(RESEND_API_KEY, EMAIL_FROM) : new LogEmailProvider();
  }
  return provider;
}

/**
 * Sends an email and records the outcome. Returns false instead of throwing so a
 * delivery problem never breaks the user flow that triggered it.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const active = emailProvider();
  try {
    const { id } = await active.send(message);
    await prisma.emailLog.create({
      data: {
        to: message.to,
        template: message.template,
        subject: message.subject,
        status: active.name === "log" ? "logged" : "sent",
        providerId: id,
        businessId: message.businessId ?? null,
      },
    });
    return true;
  } catch (error) {
    logger.error("email.send_failed", { template: message.template, error });
    await prisma.emailLog
      .create({
        data: {
          to: message.to,
          template: message.template,
          subject: message.subject,
          status: "failed",
          error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
          businessId: message.businessId ?? null,
        },
      })
      .catch(() => undefined);
    return false;
  }
}
