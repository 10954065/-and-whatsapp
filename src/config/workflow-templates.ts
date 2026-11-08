import type { WorkflowDefinition } from "@/modules/workflows/workflow.engine";
import type { TRIGGERS } from "@/modules/workflows/workflow.service";

export interface WorkflowTemplate {
  name: string;
  description: string;
  trigger: (typeof TRIGGERS)[number];
  definition: WorkflowDefinition;
}

/**
 * Starter workflows offered by industry templates. They are always created as drafts so the
 * business reviews them before anything runs. Only built-in triggers and actions are used.
 */
export const WORKFLOW_TEMPLATES = {
  new_lead_notify: {
    name: "Tell the team about new leads",
    description: "Alerts your team as soon as a new lead is captured, so someone can follow up while the customer is interested.",
    trigger: "NEW_LEAD",
    definition: { conditions: [], actions: [{ type: "notify_team", value: "New lead captured — reply while they're interested" }] },
  },
  follow_up_due: {
    name: "Follow up new leads within a day",
    description: "Creates a follow-up task due 24 hours after a lead is captured.",
    trigger: "NEW_LEAD",
    definition: { conditions: [], actions: [{ type: "create_follow_up", value: "Follow up with this lead|24" }] },
  },
  order_payment_reminder: {
    name: "Check payment on new orders",
    description: "Creates a task, due in 2 hours, to confirm payment for each new order.",
    trigger: "NEW_ORDER",
    definition: { conditions: [], actions: [{ type: "create_follow_up", value: "Confirm payment for this order|2" }] },
  },
  wholesale_enquiry: {
    name: "Route wholesale enquiries",
    description: "When a WhatsApp message mentions wholesale, tags the customer, captures a lead and alerts the team.",
    trigger: "WHATSAPP_MESSAGE",
    definition: {
      conditions: [{ field: "message_contains", value: "wholesale" }],
      actions: [
        { type: "add_customer_tag", value: "wholesale" },
        { type: "create_lead", value: "Wholesale pricing" },
        { type: "notify_team", value: "Wholesale enquiry" },
      ],
    },
  },
  booking_tag_customer: {
    name: "Tag customers who book",
    description: "Adds the “booked” tag to a customer when they make a booking, so you can find repeat clients.",
    trigger: "BOOKING_CREATED",
    definition: { conditions: [], actions: [{ type: "add_customer_tag", value: "booked" }] },
  },
} satisfies Record<string, WorkflowTemplate>;

export type WorkflowTemplateId = keyof typeof WORKFLOW_TEMPLATES;

export function isWorkflowTemplateId(id: string): id is WorkflowTemplateId {
  return Object.hasOwn(WORKFLOW_TEMPLATES, id);
}
