# SUNLEON AI — AI System

All model calls go through `src/modules/ai`. `client.ts` is the only file that imports the
Anthropic SDK (`@anthropic-ai/sdk` 1.6.0, beta Messages API).

## Request lifecycle (`orchestrator.ts → runAgent`)

1. **Load context** — business, AI agent (created from the industry template on first use),
   platform kill switch (`PlatformSetting ai.globalEnabled`), today's/month's estimated spend,
   plan limits, today's/month's AI message counts, conversation control.
2. **Preflight (`policy.ts`)** — provider configured → platform enabled → business active →
   emergency stop → agent enabled* → human takeover* → business-hours rule* (optional
   out-of-hours auto-reply) → daily message limit* → daily budget → monthly budget → plan
   allowance. (*not applied to the test console.) A blocked run spends no tokens.
3. **Route (`router.ts`)** — cheapest suitable tier:

   | Tier | Default model (env) | Effort | Used when |
   | --- | --- | --- | --- |
   | fast | `ANTHROPIC_MODEL_FAST` = `claude-haiku-5-5` | low | routine enquiries (default) |
   | standard | `ANTHROPIC_MODEL_STANDARD` = `claude-sonnet-5-5` | low | > 600 chars, > 2 questions, multi-part, > 16 turns |
   | advanced | `ANTHROPIC_MODEL_ADVANCED` = `claude-opus-5-5` | medium | complaint / dispute language |

   Businesses can force a tier (`AiAgent.modelTierOverride`). Sonnet/Opus requests include
   the server-side safety fallback (`betas: ["server-side-fallback-2026-07-01"]`,
   `fallbacks: "default"`).
4. **Prompt (`prompts.ts`, `context.ts`)** — versioned system prompt (`PromptVersion` key
   `customer-agent`, built-in v1 as fallback) rendered with tone, business facts, industry
   guidance and owner instructions. It contains nothing volatile, so top-level
   `cache_control: ephemeral` caches it. The final user turn carries local time, open/closed
   state, retrieved knowledge inside `<business_knowledge>` (declared untrusted) and the
   customer's text inside `<customer_message>`; `<`/`>` in untrusted text are neutralised so
   delimiters cannot be forged.
5. **Tool loop** — at most 5 model calls, `tool_choice: auto` (forced tool choice is rejected
   by 5.5 models), `max_tokens: 1024`. No `temperature`/`top_p` (rejected by the API).
   Every tool call goes through `tools/registry.ts → executeTool`:
   * tool must exist and be permitted for the business (`search_knowledge`,
     `get_business_info`, `escalate_to_human` are always on);
   * input validated with the tool's Zod schema (errors returned as `is_error` results);
   * write tools listed in `approvalRequiredTools` create an `ApprovalRequest` instead;
   * test-console runs simulate write tools;
   * the business id comes from server context only, and writes run in `withTenantTx` (RLS).
6. **Post-check (`policy.ts → postcheck`)** — blocks replies containing money amounts not found
   in business facts, retrieved knowledge or tool results; payment confirmations without a
   verified payment; and medical advice. Blocked replies are replaced with a holding message
   and the conversation is escalated. Replies are clamped to channel limits.
7. **Refusals and failures** — `stop_reason: "refusal"`, empty replies and provider errors
   escalate to a human with a polite holding reply (live mode).
8. **Accounting** — `AiRun` (tier, model, prompt version, tokens, cost, latency, flags),
   `AiAction` per tool call, `AiUsageRecord`, and `UsageCounter` (`AI_MESSAGE`, monthly + daily).

## Tools available in this release

| Tool | Kind | Notes |
| --- | --- | --- |
| `search_knowledge` | read | Full-text search over the business's own READY knowledge chunks |
| `get_business_info` | read | Profile, contact details, hours |
| `escalate_to_human` | write | Sets conversation control to HUMAN and notifies the team |
| `capture_lead` | write | Creates/updates an open lead for the customer |
| `create_follow_up` | write | Creates a follow-up task |

Commerce and booking tools are registered by their modules (Phase 7). Refunds, transfers,
deletion and account-security changes are intentionally **not** exposed as tools.

## Cost estimates

`pricing.ts` (USD / MTok): Haiku 5.5 0.10 in / 0.50 out; Sonnet 5.5 2 / 10 (cache read 0.20);
Opus 5.5 4 / 20 (cache read 0.20). Cache writes priced at 1.25× input. Unknown models are
priced at the Opus rate. Values are estimates; the provider invoice is authoritative.

## Controls for business owners (`/app/ai-agents`)

Name, tone, language, greeting, owner instructions, channels, permitted tools, approval
rules, escalation keywords/rules, business-hours-only + auto-reply, max discount, daily reply
limit, daily/monthly USD budgets, model tier, activation (requires verified email, configured
provider and a successful test) and an emergency stop that also halts tests.
