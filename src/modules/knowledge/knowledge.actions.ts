"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/monitoring/errors";
import { fail } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  createFaq,
  createTextSource,
  deleteKnowledgeSource,
  faqSchema,
  importWebsite,
  reprocessKnowledgeSource,
  textSourceSchema,
  uploadDocument,
  websiteSchema,
} from "@/modules/knowledge/knowledge.service";

async function knowledgeActor() {
  const context = await requireTenantAction("knowledge.manage");
  return toActor(context, (await getRequestMeta()).ipAddress);
}

function done() {
  revalidatePath("/app/knowledge");
}

export async function createFaqAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await createFaq(await knowledgeActor(), parseInput(faqSchema, formData)), done()), {
    source: "knowledge.faq",
    successMessage: "FAQ added. It will be ready in a few seconds.",
  });
}

export async function createTextAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await createTextSource(await knowledgeActor(), parseInput(textSourceSchema, formData)), done()), {
    source: "knowledge.text",
    successMessage: "Text added. It will be ready in a few seconds.",
  });
}

export async function uploadDocumentAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      const actor = await knowledgeActor();
      await enforceRateLimit(RATE_LIMITS.upload, actor.businessId);
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) throw fail.validation("Choose a file to upload.", { file: ["Choose a file."] });
      await uploadDocument(actor, { name: file.name, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
      done();
    },
    { source: "knowledge.upload", successMessage: "Document uploaded. We're reading it now." },
  );
}

export async function importWebsiteAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await importWebsite(await knowledgeActor(), parseInput(websiteSchema, formData).url), done()), {
    source: "knowledge.website",
    successMessage: "Page queued for import.",
  });
}

const idSchema = z.object({ id: z.string().min(1).max(64) });

export async function deleteSourceAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await deleteKnowledgeSource(await knowledgeActor(), parseInput(idSchema, formData).id), done()), {
    source: "knowledge.delete",
    successMessage: "Removed from the knowledge base.",
  });
}

export async function reprocessSourceAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => void (await reprocessKnowledgeSource(await knowledgeActor(), parseInput(idSchema, formData).id), done()), {
    source: "knowledge.reprocess",
    successMessage: "Processing again.",
  });
}
