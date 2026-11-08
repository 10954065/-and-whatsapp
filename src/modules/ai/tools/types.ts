import type { ZodType } from "zod";

export interface ToolContext {
  businessId: string;
  conversationId: string | null;
  customerId: string | null;
  aiRunId: string;
  /** "test" runs (test console) never write; write tools return a simulated result. */
  mode: "live" | "test";
  timezone: string;
  currency: string;
  maxDiscountPercent: number;
}

export interface ToolOutcome {
  ok: boolean;
  /** Plain-language result shown to the model as the tool_result. */
  message: string;
  data?: unknown;
  /** Facts the reply may quote (prices, stock, times). Feeds the post-reply price check. */
  verifiedFacts?: string[];
  paymentVerified?: boolean;
  escalated?: boolean;
}

export interface AiTool<I> {
  name: string;
  /** Detailed: what it does, when to use it and when not to. */
  description: string;
  schema: ZodType<I>;
  /** Write tools change data; they are simulated in test mode and can require approval. */
  isWrite: boolean;
  /** Short label for the business owner's settings screen. */
  label: string;
  execute(context: ToolContext, input: I): Promise<ToolOutcome>;
}

export type AnyAiTool = AiTool<unknown>;

export function defineTool<I>(tool: AiTool<I>): AnyAiTool {
  return tool as unknown as AnyAiTool;
}
