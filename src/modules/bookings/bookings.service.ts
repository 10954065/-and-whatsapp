import { z } from "zod";
import type { ActorType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withTenantTx } from "@/lib/db/tenant";
import type { TenantActor } from "@/lib/auth/tenant";
import { AppError, fail } from "@/lib/monitoring/errors";
import { recordAudit } from "@/modules/administration/audit.service";

const SLOT_STEP_MINUTES = 15;

/** UTC instant for a wall-clock time in an IANA timezone (handles DST/offset changes). */
export function localToUtc(date: string, minutes: number, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60));
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(guess)
      .map((part) => [part.type, part.value]),
  );
  const asLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

export function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export interface Slot {
  staffId: string;
  staffName: string;
  startsAt: Date;
  endsAt: Date;
}

interface Interval {
  start: number;
  end: number;
}

/** Pure slot generator: working intervals minus busy intervals, aligned to 15-minute steps. */
export function generateSlots(input: { working: Interval[]; busy: Interval[]; durationMs: number; bufferMs: number; notBefore: number; stepMs?: number }): Interval[] {
  const step = input.stepMs ?? SLOT_STEP_MINUTES * 60_000;
  const slots: Interval[] = [];
  for (const window of input.working) {
    for (let start = window.start; start + input.durationMs + input.bufferMs <= window.end; start += step) {
      const blockedUntil = start + input.durationMs + input.bufferMs;
      if (start < input.notBefore) continue;
      if (input.busy.some((busy) => start < busy.end && blockedUntil > busy.start)) continue;
      slots.push({ start, end: start + input.durationMs });
    }
  }
  return slots;
}

/**
 * Real availability for a service on a business-local date: staff who offer the service,
 * their working hours, time off and existing active bookings (with buffers).
 */
export async function findAvailability(businessId: string, serviceId: string, date: string, options: { staffId?: string; now?: Date } = {}): Promise<Slot[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail.validation("Use a date like 2026-11-14.");
  const [business, service] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { timezone: true } }),
    prisma.service.findFirst({ where: { id: serviceId, businessId, isActive: true } }),
  ]);
  if (!service) throw fail.notFound("Service");
  const dayStart = localToUtc(date, 0, business.timezone);
  const dayEnd = localToUtc(date, 24 * 60, business.timezone);
  const staff = await prisma.staffMember.findMany({
    where: { businessId, isActive: true, services: { some: { serviceId } }, ...(options.staffId ? { id: options.staffId } : {}) },
    include: {
      workingHours: { where: { dayOfWeek: weekdayOf(date) } },
      timeOff: { where: { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } } },
      bookings: { where: { status: { in: ["PENDING", "CONFIRMED"] }, startsAt: { lt: dayEnd }, blockedUntil: { gt: dayStart } } },
    },
  });
  const notBefore = (options.now ?? new Date()).getTime() + 30 * 60_000;
  return staff.flatMap((member) =>
    generateSlots({
      working: member.workingHours.map((hours) => ({ start: localToUtc(date, hours.startMinute, business.timezone).getTime(), end: localToUtc(date, hours.endMinute, business.timezone).getTime() })),
      busy: [
        ...member.timeOff.map((off) => ({ start: off.startsAt.getTime(), end: off.endsAt.getTime() })),
        ...member.bookings.map((booking) => ({ start: booking.startsAt.getTime(), end: booking.blockedUntil.getTime() })),
      ],
      durationMs: service.durationMinutes * 60_000,
      bufferMs: service.bufferMinutes * 60_000,
      notBefore,
    }).map((slot) => ({ staffId: member.id, staffName: member.name, startsAt: new Date(slot.start), endsAt: new Date(slot.end) })),
  );
}

export interface CreateBookingInput {
  businessId: string;
  serviceId: string;
  staffId: string;
  customerId: string;
  startsAt: Date;
  conversationId?: string | null;
  notes?: string | null;
  createdByType: ActorType;
  createdById?: string | null;
  idempotencyKey?: string | null;
}

/**
 * Books a slot only if it is genuinely available right now. The database exclusion
 * constraint (Booking_no_overlap) is the final guard against concurrent double booking.
 */
export async function createBooking(input: CreateBookingInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.booking.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
  }
  const business = await prisma.business.findUniqueOrThrow({ where: { id: input.businessId }, select: { timezone: true } });
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: business.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(input.startsAt);
  const slots = await findAvailability(input.businessId, input.serviceId, localDate, { staffId: input.staffId });
  if (!slots.some((slot) => slot.startsAt.getTime() === input.startsAt.getTime())) {
    throw fail.conflict("That time is no longer available. Please choose another slot.");
  }
  const service = await prisma.service.findFirstOrThrow({ where: { id: input.serviceId, businessId: input.businessId } });
  const endsAt = new Date(input.startsAt.getTime() + service.durationMinutes * 60_000);
  try {
    return await withTenantTx(input.businessId, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, businessId: input.businessId } });
      if (!customer) throw fail.notFound("Customer");
      const booking = await tx.booking.create({
        data: {
          businessId: input.businessId,
          serviceId: input.serviceId,
          staffId: input.staffId,
          customerId: input.customerId,
          conversationId: input.conversationId ?? null,
          startsAt: input.startsAt,
          endsAt,
          blockedUntil: new Date(endsAt.getTime() + service.bufferMinutes * 60_000),
          status: "CONFIRMED",
          priceMinor: service.priceMinor,
          notes: input.notes ?? null,
          createdByType: input.createdByType,
          createdById: input.createdById ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
        },
      });
      await recordAudit({ businessId: input.businessId, actorType: input.createdByType, actorId: input.createdById ?? null, action: "booking.created", entityType: "Booking", entityId: booking.id }, tx);
      return booking;
    });
  } catch (error) {
    const code = (error as { code?: string; meta?: { code?: string } }).code;
    if (code === "23P01" || String((error as Error).message).includes("Booking_no_overlap")) {
      throw new AppError("CONFLICT", "That time was just booked by someone else. Please choose another slot.");
    }
    throw error;
  }
}

export async function cancelBooking(actor: TenantActor, bookingId: string, reason?: string) {
  await withTenantTx(actor.businessId, async (tx) => {
    const result = await tx.booking.updateMany({
      where: { id: bookingId, businessId: actor.businessId, status: { in: ["PENDING", "CONFIRMED"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: reason ?? null },
    });
    if (!result.count) throw fail.notFound("Booking");
    await recordAudit({ businessId: actor.businessId, actorType: "USER", actorId: actor.userId, action: "booking.cancelled", entityType: "Booking", entityId: bookingId }, tx);
  });
}

export const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  durationMinutes: z.coerce.number().int().min(5).max(24 * 60),
  bufferMinutes: z.coerce.number().int().min(0).max(240).default(0),
  price: z.coerce.number().min(0).max(1_000_000).optional().transform((value) => (value === undefined ? null : Math.round(value * 100))),
});

export async function createService(actor: TenantActor, input: z.infer<typeof serviceSchema>) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: actor.businessId }, select: { currency: true } });
  return withTenantTx(actor.businessId, (tx) =>
    tx.service.create({ data: { businessId: actor.businessId, name: input.name, durationMinutes: input.durationMinutes, bufferMinutes: input.bufferMinutes, priceMinor: input.price, currency: business.currency } }),
  );
}

export const staffSchema = z.object({
  name: z.string().trim().min(2).max(80),
  serviceIds: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : Array.isArray(value) ? value : [value])),
  days: z.union([z.string(), z.array(z.string())]).optional().transform((value) => (value === undefined ? [] : (Array.isArray(value) ? value : [value]).map(Number))),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
});

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export async function createStaffMember(actor: TenantActor, input: z.infer<typeof staffSchema>) {
  const [startMinute, endMinute] = [toMinutes(input.start), toMinutes(input.end)];
  if (endMinute <= startMinute) throw fail.validation("End time must be after start time.", { end: ["Must be after start."] });
  const services = await prisma.service.findMany({ where: { id: { in: input.serviceIds }, businessId: actor.businessId } });
  return withTenantTx(actor.businessId, (tx) =>
    tx.staffMember.create({
      data: {
        businessId: actor.businessId,
        name: input.name,
        services: { create: services.map((service) => ({ businessId: actor.businessId, serviceId: service.id })) },
        workingHours: { create: input.days.filter((day) => day >= 0 && day <= 6).map((dayOfWeek) => ({ businessId: actor.businessId, dayOfWeek, startMinute, endMinute })) },
      },
    }),
  );
}
