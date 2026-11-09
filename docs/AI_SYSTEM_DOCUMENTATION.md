# SUNLEON AI — AI System

All model calls go through `src/modules/ai`. The orchestrator talks to one provider-neutral
interface, `LlmClient` (`llm/types.ts`): messages, tools, tool calls, a normalised stop reason
and token usage. `llm/index.ts` picks the adapter from `AI_PROVIDER`:

| Adapter | Provider | Notes |
| --- | --- | --- |
| `llm/anthropic.ts` | Claude through the native Messages API (`@anthropic-ai/sdk` 1.6.0, beta) | The only file importing the SDK. Prompt caching, effort, server-side fallback. |
| `llm/openai-compatible.ts` | Anything that speaks OpenAI Chat Completions: OpenAI, Gemini, OpenRouter, Groq, DeepSeek, Mistral, Ollama | Plain `fetch`; responses validated with Zod; 429 and 5xx retried twice with backoff (honours `Retry-After`); 60 s timeout. |

Each adapter replays its own assistant turns verbatim (Claude content blocks, or the raw
`tool_calls` including provider extras such as Gemini thought signatures), so multi-step tool
use keeps whatever state the provider needs. Configuration: `ENVIRONMENT_VARIABLES.md`.

## Request lifecycle (`orchestrator.ts → runAgent`)

1. **Load context** — business, AI agent (created from the industry template on first use),
   platform kill switch (`PlatformSetting ai.globalEnabled`), today's/month's estimated spend,
   plan limits, today's/month's AI message counts, conversation control.
2. **Preflight (`policy.ts`)** — provider configured → platform enabled → business active →
   emergency stop → agent enabled* → human takeover* → business-hours rule* (optional
   out-of-hours auto-reply) → daily message limit* → daily budget → monthly budget → plan
   allowance. (*not applied to the test console.) A blocked run spends no tokens.
3. **Route (`router.ts`)** — cheapest suitable tier:

   | Tier | Model (env; Anthropic default) | Effort | Used when |
   | --- | --- | --- | --- |
   | fast | `AI_MODEL_FAST` or `AI_MODEL`; `claude-haiku-5-5` | low | routine enquiries (default) |
   | standard | `AI_MODEL_STANDARD` or `AI_MODEL`; `claude-sonnet-5-5` | low | > 600 chars, > 2 questions, multi-part, > 16 turns |
   | advanced | `AI_MODEL_ADVANCED` or `AI_MODEL`; `claude-opus-5-5` | medium | complaint / dispute language |

   Businesses can force a tier (`AiAgent.modelTierOverride`). On Anthropic, Sonnet/Opus
   requests include the server-side safety fallback (`betas: ["server-side-fallback-2026-07-01"]`,
   `fallbacks: "default"`). Effort is sent to Anthropic only.
4. **Prompt (`prompts.ts`, `context.ts`)** — versioned system prompt (`PromptVersion` key
   `customer-agent`, built-in v1 as fallback) rendered with tone, business facts (including
   the industry-template answers in `Business.knowledgeProfile`, neutralised), industry
   guidance and owner instructions. It contains nothing volatile, so top-level
   `cache_control: ephemeral` caches it on Anthropic; cached tokens that OpenAI-compatible providers report are recorded too. The final user turn carries local time, open/closed
   state, retrieved knowledge inside `<business_knowledge>` (declared untrusted) and the
   customer's text inside `<customer_message>`; `<`/`>` in untrusted text are neutralised so
   delimiters cannot be forged.
5. **Tool loop** — at most 5 model calls, `tool_choice: auto` (forced tool choice is rejected
   by Claude 5.5 models), 1,024 output tokens (`max_completion_tokens` on OpenAI's own
   endpoints, `max_tokens` elsewhere). No `temperature`/`top_p` (rejected by Claude 5.5).
   Every tool call goes through `tools/registry.ts → executeTool`:
   * tool must exist and be permitted for the business (`search_knowledge`,
     `get_business_info`, `escalate_to_human` are always on);
   * input validated with the tool's Zod schema (errors, including malformed JSON arguments, are returned to the model as error tool results;
     optional fields also accept `null`, which counts as not provided, because several models send
     it and Groq rejects tool calls that break the schema; such a rejection is retried);
   * write tools listed in `approvalRequiredTools` create an `ApprovalRequest` instead;
   * test-console runs simulate write tools;
   * the business id comes from server context only, and writes run in `withTenantTx` (RLS).
6. **Post-check (`policy.ts → postcheck`)** — blocks replies containing money amounts not found
   in business facts, retrieved knowledge or tool results; payment confirmations without a
   verified payment; and medical advice. Blocked replies are replaced with a holding message
   and the conversation is escalated. Before that, `removeDashes` rewrites dashes used as
   punctuation (em and en dashes, `--`, a spaced ` - `) into commas, ranges into "to" and
   `- item` lists into bullets; hyphens inside words, numbers, dates and links stay. Replies
   are clamped to channel limits.
7. **Refusals and failures** — refusals (Claude `refusal`; OpenAI-style `refusal` or
   `content_filter`), empty replies and provider errors escalate to a human with a polite
   holding reply (live mode). The provider's error message is stored on the `AiRun`.
8. **Accounting** — `AiRun` (tier, model, prompt version, tokens, cost, latency, flags),
   `AiAction` per tool call, `AiUsageRecord`, and `UsageCounter` (`AI_MESSAGE`, monthly + daily).
   A reply counts against the plan whenever the model answered, even from providers that
   report no token usage.

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
Opus 5.5 4 / 20 (cache read 0.20). Cache writes priced at 1.25× input. Other providers' models
are priced from `AI_MODEL_PRICES`; anything unpriced is estimated at the Opus rate so daily and
monthly spend limits never under-count. Values are estimates; the provider invoice is
authoritative.

## Controls for business owners (`/app/ai-agents`)

Name, tone, language, greeting, owner instructions, channels, permitted tools, approval
rules, escalation keywords/rules, business-hours-only + auto-reply, max discount, daily reply
limit, daily/monthly USD budgets, model tier, activation (requires verified email, configured
provider and a successful test) and an emergency stop that also halts tests.
