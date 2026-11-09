import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/format";
import { isAppError } from "@/lib/monitoring/errors";
import { defineTool } from "@/modules/ai/tools/types";
import { createBooking, findAvailability } from "@/modules/bookings/bookings.service";

export const checkAvailabilityTool = defineTool({
  name: "check_availability",
  label: "Check appointment availability",
  description:
    "Lists real open appointment times for a service on a date (business-local, YYYY-MM-DD). Call with an empty service_id to list services. Never offer a time that this tool did not return.",
  isWrite: false,
  schema: z.strictObject({ service_id: z.string().max(64), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  async execute(context, input) {
    if (!input.service_id) {
      const services = await prisma.service.findMany({ where: { businessId: context.businessId, isActive: true }, take: 20 });
      const lines = services.map((service) => `${service.name} | ${service.durationMinutes} min | service_id ${service.id}`);
      return { ok: true, message: lines.join("\n") || "No bookable services are set up.", verifiedFacts: lines };
    }
    const slots = await findAvailability(context.businessId, input.service_id, input.date);
    if (slots.length === 0) return { ok: true, message: `No open times on ${input.date}.`, verifiedFacts: [] };
    const lines = slots.slice(0, 12).map((slot) => `${formatDateTime(slot.startsAt, context.timezone)} with ${slot.staffName} | start ${slot.startsAt.toISOString()} | staff_id ${slot.staffId}`);
    return { ok: true, message: lines.join("\n"), verifiedFacts: lines };
  },
});

export const createBookingTool = defineTool({
  name: "create_booking",
  label: "Create bookings",
  description: "Books an appointment slot returned by check_availability (use its exact start time and staff_id) after the customer confirms. Returns the confirmed time.",
  isWrite: true,
  schema: z.strictObject({ service_id: z.string().min(1).max(64), staff_id: z.string().min(1).max(64), start: z.iso.datetime(), notes: z.string().max(300).optional() }),
  async execute(context, input) {
    if (context.mode === "test") return { ok: true, message: `TEST MODE: a booking at ${input.start} would be created.` };
    if (!context.customerId) return { ok: false, message: "No customer is linked to this conversation." };
    try {
      const booking = await createBooking({
        businessId: context.businessId,
        serviceId: input.service_id,
        staffId: input.staff_id,
        customerId: context.customerId,
        startsAt: new Date(input.start),
        conversationId: context.conversationId,
        notes: input.notes ?? null,
        createdByType: "AI",
        idempotencyKey: `ai-booking:${context.aiRunId}:${input.start}:${input.staff_id}`,
      });
      const summary = `Booking confirmed for ${formatDateTime(booking.startsAt, context.timezone)}.`;
      return { ok: true, message: summary, verifiedFacts: [summary] };
    } catch (error) {
      if (isAppError(error)) return { ok: false, message: error.message };
      throw error;
    }
  },
});
