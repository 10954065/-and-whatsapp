"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Permission } from "@/config/permissions";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { cancelBooking, createBooking, createService, createStaffMember, serviceSchema, staffSchema } from "@/modules/bookings/bookings.service";

async function actorWith(permission: Permission) {
  const context = await requireTenantAction(permission);
  return toActor(context, (await getRequestMeta()).ipAddress);
}

export async function createServiceAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => void (await createService(await actorWith("services.write"), parseInput(serviceSchema, formData)), revalidatePath("/app/services")), {
    source: "bookings.service",
    successMessage: "Service added.",
  });
}

export async function createStaffAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => void (await createStaffMember(await actorWith("services.write"), parseInput(staffSchema, formData)), revalidatePath("/app/services")), {
    source: "bookings.staff",
    successMessage: "Staff member added.",
  });
}

const bookSchema = z.object({ serviceId: z.string().min(1), staffId: z.string().min(1), customerId: z.string().min(1, "Choose a customer."), startsAt: z.iso.datetime() });

export async function bookSlotAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const actor = await actorWith("bookings.write");
      const input = parseInput(bookSchema, formData);
      await createBooking({ businessId: actor.businessId, serviceId: input.serviceId, staffId: input.staffId, customerId: input.customerId, startsAt: new Date(input.startsAt), createdByType: "USER", createdById: actor.userId });
      revalidatePath("/app/bookings");
    },
    { source: "bookings.book", successMessage: "Booking confirmed." },
  );
}

export async function cancelBookingAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      await cancelBooking(await actorWith("bookings.write"), parseInput(z.object({ bookingId: z.string().min(1) }), formData).bookingId);
      revalidatePath("/app/bookings");
    },
    { source: "bookings.cancel", successMessage: "Booking cancelled." },
  );
}
