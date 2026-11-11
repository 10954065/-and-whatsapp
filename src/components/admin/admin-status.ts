import type { BusinessStatus, SubscriptionStatus } from "@/generated/prisma/enums";

/** Dot colour and label for each state, shown with StatusLabel so colour never stands alone. */
export const BUSINESS_STATUS: Record<BusinessStatus, { dot: string; label: string }> = {
  ACTIVE: { dot: "bg-success", label: "Active" },
  SUSPENDED: { dot: "bg-destructive", label: "Suspended" },
  CLOSED: { dot: "bg-foreground/30", label: "Closed" },
};

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { dot: string; label: string }> = {
  ACTIVE: { dot: "bg-success", label: "Paying" },
  TRIALING: { dot: "bg-info", label: "Trialing" },
  PAST_DUE: { dot: "bg-warning", label: "Past due" },
  GRACE: { dot: "bg-warning", label: "In grace" },
  EXPIRED: { dot: "bg-destructive", label: "Expired" },
  CANCELLED: { dot: "bg-foreground/30", label: "Cancelled" },
};
