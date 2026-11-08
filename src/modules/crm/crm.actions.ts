"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Permission } from "@/config/permissions";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { addCustomerNote, completeTask, createCustomer, createLead, customerSchema, updateLeadStatus } from "@/modules/crm/crm.service";

async function actorWith(permission: Permission) {
  const context = await requireTenantAction(permission);
  return toActor(context, (await getRequestMeta()).ipAddress);
}

export async function createCustomerAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => void (await createCustomer(await actorWith("customers.write"), parseInput(customerSchema, formData)), revalidatePath("/app/customers")), {
    source: "crm.customer",
    successMessage: "Customer added.",
  });
}

const noteSchema = z.object({ customerId: z.string().min(1), body: z.string().trim().min(1).max(2_000) });

export async function addCustomerNoteAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const input = parseInput(noteSchema, formData);
      await addCustomerNote(await actorWith("customers.write"), input.customerId, input.body);
      revalidatePath("/app/customers");
    },
    { source: "crm.note", successMessage: "Note added." },
  );
}

const leadSchema = z.object({
  customerId: z.string().min(1),
  interest: z.string().trim().min(3).max(300),
  value: z.coerce.number().min(0).max(10_000_000).optional().transform((value) => (value ? Math.round(value * 100) : null)),
});

export async function createLeadAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const input = parseInput(leadSchema, formData);
      await createLead(await actorWith("leads.write"), input.customerId, input.interest, input.value);
      revalidatePath("/app/leads");
    },
    { source: "crm.lead", successMessage: "Lead created." },
  );
}

const leadStatusSchema = z.object({ leadId: z.string().min(1), status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]) });

export async function updateLeadStatusAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      const input = parseInput(leadStatusSchema, formData);
      await updateLeadStatus(await actorWith("leads.write"), input.leadId, input.status);
      revalidatePath("/app/leads");
    },
    { source: "crm.lead_status", successMessage: "Lead updated." },
  );
}

export async function completeTaskAction(_previous: ActionResult<unknown> | null, formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(
    async () => {
      await completeTask(await actorWith("customers.write"), parseInput(z.object({ taskId: z.string().min(1) }), formData).taskId);
      revalidatePath("/app/leads");
    },
    { source: "crm.task", successMessage: "Task completed." },
  );
}
