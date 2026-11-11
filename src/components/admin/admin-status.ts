import type { BusinessStatus, Channel, IntegrationStatus, PaymentTxStatus, SubscriptionStatus } from "@/generated/prisma/enums";

export const CHANNEL_LABEL: Record<Channel, string> = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", SANDBOX: "Test channel" };

export const INTEGRATION_STATUS: Record<IntegrationStatus, { dot: string; label: string }> = {
  CONNECTED: { dot: "bg-success", label: "Connected" },
  PENDING: { dot: "bg-warning", label: "Pending" },
  ERROR: { dot: "bg-destructive", label: "Error" },
  EXPIRED: { dot: "bg-destructive", label: "Expired" },
  DISCONNECTED: { dot: "bg-foreground/30", label: "Disconnected" },
};

export const PAYMENT_STATUS: Record<PaymentTxStatus, { dot: string; label: string }> = {
  SUCCESS: { dot: "bg-success", label: "Paid" },
  PENDING: { dot: "bg-warning", label: "Pending" },
  FAILED: { dot: "bg-destructive", label: "Failed" },
  REVERSED: { dot: "bg-destructive", label: "Reversed" },
  ABANDONED: { dot: "bg-foreground/30", label: "Abandoned" },
};

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
