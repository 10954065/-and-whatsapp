"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import type { Permission } from "@/config/permissions";
import {
  addConversationNote,
  noteSchema,
  replyAsStaff,
  replySchema,
  returnToAi,
  simulateSandboxMessage,
  simulateSchema,
  takeOver,
  updateConversation,
  updateConversationSchema,
} from "@/modules/messaging/inbox.service";
import {
  checkIntegrationHealth,
  connectSandbox,
  connectWhatsApp,
  disconnectIntegration,
  startInstagramConnect,
  whatsappConnectSchema,
} from "@/modules/integrations/integration.service";

async function actorWith(permission: Permission) {
  const context = await requireTenantAction(permission);
  return toActor(context, (await getRequestMeta()).ipAddress);
}

const conversationIdSchema = z.object({ conversationId: z.string().min(1) });
const idSchema = z.object({ id: z.string().min(1) });

export async function replyAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await replyAsStaff(await actorWith("inbox.reply"), parseInput(replySchema, formData)), revalidatePath("/app/inbox")), {
    source: "inbox.reply",
  });
}

export async function takeOverAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await takeOver(await actorWith("inbox.reply"), parseInput(conversationIdSchema, formData).conversationId), revalidatePath("/app/inbox")), {
    source: "inbox.takeover",
    successMessage: "You're handling this conversation. AI replies are paused.",
  });
}

export async function returnToAiAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await returnToAi(await actorWith("inbox.reply"), parseInput(conversationIdSchema, formData).conversationId), revalidatePath("/app/inbox")), {
    source: "inbox.return",
    successMessage: "The AI employee will handle new messages again.",
  });
}

export async function updateConversationAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await updateConversation(await actorWith("inbox.manage"), parseInput(updateConversationSchema, formData)), revalidatePath("/app/inbox")), {
    source: "inbox.update",
    successMessage: "Conversation updated.",
  });
}

export async function addNoteAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await addConversationNote(await actorWith("inbox.reply"), parseInput(noteSchema, formData)), revalidatePath("/app/inbox")), {
    source: "inbox.note",
  });
}

export async function simulateMessageAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      const result = await simulateSandboxMessage(await actorWith("inbox.reply"), parseInput(simulateSchema, formData));
      revalidatePath("/app/inbox");
      if (result) redirect(`/app/inbox?conversation=${result.conversationId}`);
    },
    { source: "inbox.simulate" },
  );
}

export async function connectWhatsAppAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await connectWhatsApp(await actorWith("integrations.manage"), parseInput(whatsappConnectSchema, formData)), revalidatePath("/app/integrations")), {
    source: "integrations.whatsapp",
    successMessage: "WhatsApp number connected.",
  });
}

export async function connectSandboxAction(): Promise<ActionResult> {
  return runAction(async () => void (await connectSandbox(await actorWith("integrations.manage")), revalidatePath("/app/integrations")), {
    source: "integrations.sandbox",
    successMessage: "Test channel ready. Simulate customer messages from the inbox.",
  });
}

export async function startInstagramAction(): Promise<void> {
  const url = await startInstagramConnect(await actorWith("integrations.manage"));
  redirect(url);
}

export async function disconnectAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await disconnectIntegration(await actorWith("integrations.manage"), parseInput(idSchema, formData).id), revalidatePath("/app/integrations")), {
    source: "integrations.disconnect",
    successMessage: "Disconnected.",
  });
}

export async function healthCheckAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      await checkIntegrationHealth(await actorWith("integrations.read"), parseInput(idSchema, formData).id);
      revalidatePath("/app/integrations");
    },
    { source: "integrations.health", successMessage: "Connection checked." },
  );
}
