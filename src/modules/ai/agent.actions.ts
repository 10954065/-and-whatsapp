"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/monitoring/errors";
import { parseInput, runAction } from "@/lib/http/action";
import { getRequestMeta } from "@/lib/auth/request";
import { requireTenantAction, toActor } from "@/lib/auth/tenant";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { agentConfigSchema, setAgentEnabled, setEmergencyStop, updateAgentConfig } from "@/modules/ai/agent.service";
import { runAgent, type AgentRunOutput } from "@/modules/ai/orchestrator";

async function aiActor() {
  const context = await requireTenantAction("ai.manage");
  return toActor(context, (await getRequestMeta()).ipAddress);
}

export async function saveAgentConfigAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      await updateAgentConfig(await aiActor(), parseInput(agentConfigSchema, formData));
      revalidatePath("/app/ai-agents");
    },
    { source: "ai.save_config", successMessage: "AI employee settings saved." },
  );
}

const toggleSchema = z.object({ value: z.enum(["on", "off"]) });

export async function setAgentEnabledAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      const { value } = parseInput(toggleSchema, formData);
      await setAgentEnabled(await aiActor(), value === "on");
      revalidatePath("/app/ai-agents");
    },
    { source: "ai.set_enabled", successMessage: "AI employee status updated." },
  );
}

export async function setEmergencyStopAction(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(
    async () => {
      const { value } = parseInput(toggleSchema, formData);
      await setEmergencyStop(await aiActor(), value === "on");
      revalidatePath("/app/ai-agents");
    },
    { source: "ai.emergency_stop", successMessage: "Emergency stop updated." },
  );
}

const testSchema = z.object({
  message: z.string().trim().min(1, "Type a message.").max(2_000),
  history: z
    .string()
    .max(40_000)
    .default("[]")
    .transform((value, context) => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        context.addIssue({ code: "custom", message: "Invalid history" });
        return z.NEVER;
      }
    })
    .pipe(z.array(z.object({ role: z.enum(["customer", "assistant"]), text: z.string().max(4_000) })).max(30)),
});

export type TestConsoleResult = Pick<
  AgentRunOutput,
  "status" | "reply" | "actions" | "tier" | "model" | "costMicros" | "policyFlags" | "blockedMessage" | "escalated"
>;

/** Test console: real model, real read tools, simulated write tools, nothing sent to customers. */
export async function testConsoleAction(
  _previous: ActionResult<TestConsoleResult> | null,
  formData: FormData,
): Promise<ActionResult<TestConsoleResult>> {
  return runAction(
    async () => {
      const context = await requireTenantAction("ai.read");
      const input = parseInput(testSchema, formData);
      await enforceRateLimit(RATE_LIMITS.aiTestConsole, context.businessId);
      const result = await runAgent({
        businessId: context.businessId,
        channel: "SANDBOX",
        trigger: "TEST_CONSOLE",
        history: input.history,
        inboundText: input.message,
        mode: "test",
      });
      revalidatePath("/app/ai-agents");
      return {
        status: result.status,
        reply: result.reply,
        actions: result.actions,
        tier: result.tier,
        model: result.model,
        costMicros: result.costMicros,
        policyFlags: result.policyFlags,
        blockedMessage: result.blockedMessage,
        escalated: result.escalated,
      };
    },
    { source: "ai.test_console" },
  );
}
