import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { AccessDenied, EmptyState, PageHeader } from "@/components/app/page-primitives";
import { ActionButton, QuickForm } from "@/components/operations/operations-forms";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { bookSlotAction, cancelBookingAction } from "@/modules/bookings/bookings.actions";
import { findAvailability } from "@/modules/bookings/bookings.service";

export const metadata: Metadata = { title: "Bookings" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Includes bookings that started within the last hour (still in progress). */
function oneHourAgo(): Date {
  return new Date(Date.now() - 3_600_000);
}

export default async function BookingsPage({ searchParams }: { searchParams: SearchParams }) {
  const context = await requireTenant();
  if (!context.can("bookings.read")) return <AccessDenied what="bookings" />;
  const params = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: context.business.timezone }).format(new Date());
  const serviceId = typeof params.service === "string" ? params.service : "";
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;
  const [upcoming, services, customers] = await Promise.all([
    prisma.booking.findMany({
      where: { businessId: context.businessId, startsAt: { gte: oneHourAgo() }, status: { in: ["PENDING", "CONFIRMED"] } },
      include: { customer: { select: { displayName: true } }, service: { select: { name: true } }, staff: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
      take: 100,
    }),
    prisma.service.findMany({ where: { businessId: context.businessId, isActive: true } }),
    prisma.customer.findMany({ where: { businessId: context.businessId, deletedAt: null }, select: { id: true, displayName: true }, take: 300 }),
  ]);
  const slots = serviceId ? await findAvailability(context.businessId, serviceId, date) : [];
  const canWrite = context.can("bookings.write");

  return (
    <>
      <PageHeader title="Bookings" description={`Times shown in ${context.business.timezone}. Double bookings are blocked by the database.`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="mb-3 font-semibold">Upcoming</h2>
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No upcoming bookings" description="Bookings made by your team or assistant appear here." />
          ) : (
            <ul className="divide-y text-sm">
              {upcoming.map((booking) => (
                <li key={booking.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1">
                    <p className="font-medium">
                      {formatDateTime(booking.startsAt, context.business.timezone)} · {booking.service.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {booking.customer.displayName} with {booking.staff.name} · by {booking.createdByType.toLowerCase()}
                    </p>
                  </div>
                  {canWrite ? <ActionButton action={cancelBookingAction} values={{ bookingId: booking.id }} label="Cancel" variant="ghost" /> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="mb-3 font-semibold">Find a time</h2>
          <form className="flex flex-wrap items-end gap-2" action="/app/bookings">
            <select name="service" defaultValue={serviceId} className="h-8 rounded-lg border bg-background px-2 text-sm" aria-label="Service">
              <option value="">Choose a service</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <input type="date" name="date" defaultValue={date} min={today} className="h-8 rounded-lg border bg-background px-2 text-sm" aria-label="Date" />
            <Button type="submit" size="sm" variant="outline">
              Show times
            </Button>
          </form>
          {serviceId ? (
            <ul className="mt-4 grid gap-3">
              {slots.length === 0 ? <li className="text-sm text-muted-foreground">No open times that day.</li> : null}
              {slots.slice(0, 12).map((slot) => (
                <li key={`${slot.staffId}-${slot.startsAt.toISOString()}`} className="rounded-xl border p-3">
                  <p className="mb-2 text-sm font-medium">
                    {formatDateTime(slot.startsAt, context.business.timezone)} · {slot.staffName}
                  </p>
                  {canWrite && customers.length ? (
                    <QuickForm
                      action={bookSlotAction}
                      submitLabel="Book"
                      hidden={{ serviceId, staffId: slot.staffId, startsAt: slot.startsAt.toISOString() }}
                      fields={[{ name: "customerId", label: "Customer", type: "select", options: customers.map((customer) => ({ value: customer.id, label: customer.displayName })) }]}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </>
  );
}
