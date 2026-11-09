import type { Metadata } from "next";
import { AccessDenied, PageHeader } from "@/components/app/page-primitives";
import { QuickForm } from "@/components/operations/operations-forms";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/format";
import { requireTenant } from "@/lib/auth/tenant";
import { createServiceAction, createStaffAction } from "@/modules/bookings/bookings.actions";

export const metadata: Metadata = { title: "Services & staff" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const minutes = (value: number) => `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export default async function ServicesPage() {
  const context = await requireTenant();
  if (!context.can("bookings.read")) return <AccessDenied what="services" />;
  const [services, staff] = await Promise.all([
    prisma.service.findMany({ where: { businessId: context.businessId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.staffMember.findMany({ where: { businessId: context.businessId, isActive: true }, include: { services: { include: { service: true } }, workingHours: true }, orderBy: { name: "asc" } }),
  ]);
  const canWrite = context.can("services.write");
  return (
    <>
      <PageHeader title="Services & staff" description="What customers can book, who performs it and when they work. Availability is calculated from this." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Services</h2>
          <ul className="mt-3 divide-y text-sm">
            {services.map((service) => (
              <li key={service.id} className="flex justify-between py-2">
                <span>{service.name}</span>
                <span className="text-muted-foreground">
                  {service.durationMinutes} min{service.bufferMinutes ? ` + ${service.bufferMinutes} buffer` : ""} · {service.priceMinor !== null ? formatMoney(service.priceMinor, service.currency) : "price on request"}
                </span>
              </li>
            ))}
          </ul>
          {canWrite ? (
            <div className="mt-6">
              <QuickForm
                action={createServiceAction}
                submitLabel="Add service"
                columns={2}
                fields={[
                  { name: "name", label: "Service name" },
                  { name: "price", label: `Price (${context.business.currency})`, type: "number", step: "0.01" },
                  { name: "durationMinutes", label: "Duration (min)", type: "number", defaultValue: "60" },
                  { name: "bufferMinutes", label: "Buffer after (min)", type: "number", defaultValue: "0" },
                ]}
              />
            </div>
          ) : null}
        </section>
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-semibold">Staff</h2>
          <ul className="mt-3 divide-y text-sm">
            {staff.map((member) => (
              <li key={member.id} className="py-2">
                <p className="font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground">
                  {member.services.map((entry) => entry.service.name).join(", ") || "No services"} ·{" "}
                  {member.workingHours.map((hours) => `${DAYS[hours.dayOfWeek]} ${minutes(hours.startMinute)} to ${minutes(hours.endMinute)}`).join(", ") || "No hours"}
                </p>
              </li>
            ))}
          </ul>
          {canWrite ? (
            <div className="mt-6">
              <QuickForm
                action={createStaffAction}
                submitLabel="Add staff member"
                fields={[
                  { name: "name", label: "Name" },
                  { name: "serviceIds", label: "Performs", type: "checkboxes", options: services.map((service) => ({ value: service.id, label: service.name })) },
                  { name: "days", label: "Works on", type: "checkboxes", options: DAYS.map((day, index) => ({ value: String(index), label: day })) },
                  { name: "start", label: "From", type: "time", defaultValue: "09:00" },
                  { name: "end", label: "To", type: "time", defaultValue: "17:00" },
                ]}
              />
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
