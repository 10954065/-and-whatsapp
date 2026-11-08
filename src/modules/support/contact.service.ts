import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/monitoring/logger";
import { emailSchema } from "@/modules/auth/auth.schemas";

const CONTACT_RATE_LIMIT = { name: "contact:ip", limit: 5, windowSeconds: 3_600 };

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: emailSchema,
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).optional(),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(4_000),
  // Honeypot: real visitors never see or fill this field.
  website: z.string().max(0).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

export async function createContactInquiry(input: ContactInput, ipAddress: string | null): Promise<void> {
  await enforceRateLimit(CONTACT_RATE_LIMIT, ipAddress ?? "unknown");
  const inquiry = await prisma.contactInquiry.create({
    data: {
      name: input.name,
      email: input.email,
      company: input.company || null,
      phone: input.phone || null,
      message: input.message,
    },
    select: { id: true },
  });
  logger.info("contact.inquiry_received", { inquiryId: inquiry.id });
}
