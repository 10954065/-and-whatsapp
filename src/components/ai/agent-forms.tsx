"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion } from "motion/react";
import { Headset, OctagonX, Power, Send, User } from "lucide-react";
import { TypingDots } from "@/components/marketing/phone-chat";
import { toast } from "sonner";
import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { SelectField } from "@/components/onboarding/create-business-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import { cn } from "@/lib/utils";
import {
  saveAgentConfigAction,
  setAgentEnabledAction,
  setEmergencyStopAction,
  testConsoleAction,
} from "@/modules/ai/agent.actions";

export interface AgentFormValues {
  name: string;
  roleDescription: string | null;
  tone: string;
  language: string;
  greeting: string | null;
  customInstructions: string | null;
  escalationInstructions: string | null;
  escalationKeywords: string[];
  enabledChannels: string[];
  permittedTools: string[];
  approvalRequiredTools: string[];
  businessHoursOnly: boolean;
  outOfHoursMessage: string | null;
  maxDiscountPercent: number;
  dailyMessageLimit: number;
  dailySpendLimitUsd: number;
  monthlySpendLimitUsd: number;
  modelTierOverride: string | null;
}

export interface ToolOption {
  name: string;
  label: string;
  isWrite: boolean;
  isLocked: boolean;
}

function CheckboxRow({ name, value, label, defaultChecked, disabled }: { name: string; value: string; label: string; defaultChecked: boolean; disabled?: boolean }) {
  const id = `${name}-${value}`;
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} name={name} value={value} defaultChecked={defaultChecked} disabled={disabled} />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}

export function AgentConfigForm({ values, tools, disabled }: { values: AgentFormValues; tools: ToolOption[]; disabled: boolean }) {
  const { state, onSubmit, isPending } = useActionForm(saveAgentConfigAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-8" noValidate>
      <FormAlert state={state} />
      <fieldset disabled={disabled} className="grid gap-8">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Name" name="name" defaultValue={values.name} required errors={fieldErrors(state, "name")} />
          <SelectField
            label="Tone"
            name="tone"
            defaultValue={values.tone}
            options={[
              { value: "FRIENDLY", label: "Friendly" },
              { value: "PROFESSIONAL", label: "Professional" },
              { value: "WARM", label: "Warm" },
              { value: "CONCISE", label: "Concise" },
              { value: "PLAYFUL", label: "Playful" },
            ]}
          />
          <Field label="Default language" name="language" defaultValue={values.language} hint="e.g. en, fr, tw" errors={fieldErrors(state, "language")} />
        </div>
        <Field label="Role" name="roleDescription" defaultValue={values.roleDescription ?? ""} hint="One sentence on what this assistant does." errors={fieldErrors(state, "roleDescription")} />
        <Field label="Greeting" name="greeting" defaultValue={values.greeting ?? ""} placeholder="Hi! I'm Ama from Adwoa's Kitchen 👋 How can I help?" errors={fieldErrors(state, "greeting")} />
        <Field
          label="Instructions from the owner"
          name="customInstructions"
          multiline
          rows={5}
          defaultValue={values.customInstructions ?? ""}
          hint="House rules, upsell suggestions, phrases to use or avoid. Facts belong in the knowledge base."
          errors={fieldErrors(state, "customInstructions")}
        />

        <div className="grid gap-3">
          <p className="text-sm font-semibold">Channels</p>
          <div className="flex flex-wrap gap-6">
            <CheckboxRow name="enabledChannels" value="WHATSAPP" label="WhatsApp" defaultChecked={values.enabledChannels.includes("WHATSAPP")} />
            <CheckboxRow name="enabledChannels" value="INSTAGRAM" label="Instagram" defaultChecked={values.enabledChannels.includes("INSTAGRAM")} />
          </div>
        </div>

        <div className="grid gap-3">
          <p className="text-sm font-semibold">What it may do</p>
          <p className="text-sm text-muted-foreground">Tick an action to allow it. Tick “needs approval” to have a team member confirm it first.</p>
          <div className="divide-y rounded-xl border">
            {tools.map((tool) => (
              <div key={tool.name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <CheckboxRow
                  name="permittedTools"
                  value={tool.name}
                  label={tool.label}
                  defaultChecked={tool.isLocked || values.permittedTools.includes(tool.name)}
                  disabled={tool.isLocked}
                />
                {tool.isLocked ? (
                  <Badge variant="secondary">Always on</Badge>
                ) : tool.isWrite ? (
                  <CheckboxRow
                    name="approvalRequiredTools"
                    value={tool.name}
                    label="Needs approval"
                    defaultChecked={values.approvalRequiredTools.includes(tool.name)}
                  />
                ) : (
                  <Badge variant="outline">Read-only</Badge>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Refunds, money transfers and record deletion are never available to the AI.</p>
        </div>

        <div className="grid gap-5">
          <p className="text-sm font-semibold">Escalation</p>
          <Field
            label="Escalate when a customer mentions"
            name="escalationKeywords"
            defaultValue={values.escalationKeywords.join(", ")}
            hint="Comma-separated words, e.g. manager, refund, complaint."
          />
          <Field label="Other escalation rules" name="escalationInstructions" defaultValue={values.escalationInstructions ?? ""} />
        </div>

        <div className="grid gap-5">
          <p className="text-sm font-semibold">Hours & limits</p>
          <label className="flex items-center gap-3 text-sm">
            <Switch name="businessHoursOnly" value="on" defaultChecked={values.businessHoursOnly} /> Only reply during opening hours
          </label>
          <Field
            label="Out-of-hours auto-reply"
            name="outOfHoursMessage"
            defaultValue={values.outOfHoursMessage ?? ""}
            placeholder="Thanks for your message! We're closed now and will reply when we open at 8am."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Max discount (%)" name="maxDiscountPercent" type="number" min={0} max={50} defaultValue={values.maxDiscountPercent} errors={fieldErrors(state, "maxDiscountPercent")} />
            <Field label="AI replies per day" name="dailyMessageLimit" type="number" min={1} defaultValue={values.dailyMessageLimit} errors={fieldErrors(state, "dailyMessageLimit")} />
            <Field label="Daily AI budget (USD)" name="dailySpendLimitUsd" type="number" step="0.5" min={0} defaultValue={values.dailySpendLimitUsd} errors={fieldErrors(state, "dailySpendLimitUsd")} />
            <Field label="Monthly AI budget (USD)" name="monthlySpendLimitUsd" type="number" step="1" min={0} defaultValue={values.monthlySpendLimitUsd} errors={fieldErrors(state, "monthlySpendLimitUsd")} />
          </div>
          <SelectField
            label="Model selection"
            name="modelTierOverride"
            defaultValue={values.modelTierOverride ?? "auto"}
            options={[
              { value: "auto", label: "Automatic: cheapest suitable model (recommended)" },
              { value: "fast", label: "Always fast (lowest cost)" },
              { value: "standard", label: "Always standard" },
              { value: "advanced", label: "Always advanced (highest cost)" },
            ]}
          />
        </div>
      </fieldset>
      {disabled ? null : (
        <div>
          <SubmitButton isPending={isPending} pendingLabel="Saving…">
            Save assistant settings
          </SubmitButton>
        </div>
      )}
    </form>
  );
}

export function AgentStatusControls({ enabled, emergencyStop, canManage }: { enabled: boolean; emergencyStop: boolean; canManage: boolean }) {
  const activate = useActionForm(setAgentEnabledAction);
  const stop = useActionForm(setEmergencyStopAction);
  useEffect(() => {
    for (const state of [activate.state, stop.state]) {
      if (state && !state.ok) toast.error(state.error);
    }
  }, [activate.state, stop.state]);
  if (!canManage) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <form onSubmit={activate.onSubmit}>
        <input type="hidden" name="value" value={enabled ? "off" : "on"} />
        <SubmitButton variant={enabled ? "outline" : "default"} isPending={activate.isPending}>
          <Power /> {enabled ? "Deactivate" : "Activate assistant"}
        </SubmitButton>
      </form>
      <form onSubmit={stop.onSubmit}>
        <input type="hidden" name="value" value={emergencyStop ? "off" : "on"} />
        <SubmitButton variant={emergencyStop ? "outline" : "destructive"} isPending={stop.isPending}>
          <OctagonX /> {emergencyStop ? "Release emergency stop" : "Emergency stop"}
        </SubmitButton>
      </form>
    </div>
  );
}

interface Turn {
  role: "customer" | "assistant";
  text: string;
  meta?: string;
}

export function TestConsole({ isProviderConfigured }: { isProviderConfigured: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [isPending, startTestTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  const toTurn = (state: Awaited<ReturnType<typeof testConsoleAction>>): Turn => {
    if (!state.ok) return { role: "assistant", text: state.error, meta: "error" };
    const result = state.data;
    const meta = [
      result.model ? `${result.tier} · ${result.model}` : null,
      result.actions.length ? `tools: ${result.actions.map((action) => `${action.tool} (${action.status.toLowerCase()})`).join(", ")}` : null,
      result.policyFlags.length ? `policy: ${result.policyFlags.join(", ")}` : null,
      result.escalated ? "would escalate to a person" : null,
      `est. cost $${(result.costMicros / 1_000_000).toFixed(4)}`,
    ]
      .filter(Boolean)
      .join(" · ");
    return { role: "assistant", text: result.reply ?? result.blockedMessage ?? "(no reply)", meta };
  };

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), [turns]);

  const send = () => {
    const message = draft.trim();
    if (!message || isPending) return;
    const history = turns.filter((turn) => turn.meta !== "error").map(({ role, text }) => ({ role, text }));
    const formData = new FormData();
    formData.set("message", message);
    formData.set("history", JSON.stringify(history));
    setTurns((current) => [...current, { role: "customer", text: message }]);
    setDraft("");
    startTestTransition(async () => {
      const reply = toTurn(await testConsoleAction(null, formData));
      setTurns((current) => [...current, reply]);
    });
  };

  return (
    <div className="surface flex h-128 flex-col overflow-hidden rounded-[1.25rem]">
      <div
        className="flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
        style={{ backgroundImage: "radial-gradient(color-mix(in oklch, var(--foreground) 7%, transparent) 1px, transparent 1.2px)", backgroundSize: "16px 16px" }}
      >
        {turns.length === 0 ? (
          <p className="mx-auto max-w-xs pt-16 text-center text-sm text-muted-foreground">
            {isProviderConfigured
              ? "Write a message as if you were a customer. Write actions are simulated, so nothing is saved or sent."
              : "The AI provider is not configured on this platform yet, so test replies are unavailable."}
          </p>
        ) : null}
        {turns.map((turn, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
            style={{ originX: turn.role === "customer" ? 1 : 0, originY: 1 }}
            className={cn("flex gap-2", turn.role === "customer" ? "justify-end" : "justify-start")}
          >
            {turn.role === "assistant" ? <Headset className="mt-1 size-4 shrink-0 text-sun-ink" aria-hidden="true" /> : null}
            <div className="max-w-[80%]">
              <div
                className={cn(
                  "rounded-[18px] px-3.5 py-2 text-sm whitespace-pre-wrap",
                  turn.role === "customer" ? "rounded-br-[6px] bg-[#d9fdd3] text-[#111b21]" : "rounded-bl-[6px] bg-card shadow-[var(--shadow-hairline)]",
                  turn.meta === "error" && "border border-destructive/30 bg-destructive/10",
                )}
              >
                {turn.text}
              </div>
              {turn.meta && turn.meta !== "error" ? <p className="mt-1 px-1 text-[11px] text-muted-foreground">{turn.meta}</p> : null}
            </div>
            {turn.role === "customer" ? <User className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
          </motion.div>
        ))}
        {isPending ? (
          <div className="flex items-center gap-2" role="status" aria-label="The assistant is replying">
            <Headset className="size-4 shrink-0 text-sun-ink" aria-hidden="true" />
            <span className="rounded-[18px] rounded-bl-[6px] bg-card px-3.5 py-3 text-muted-foreground shadow-[var(--shadow-hairline)]">
              <TypingDots />
            </span>
          </div>
        ) : null}
        <div ref={bottom} />
      </div>
      <form
        className="material flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Do you deliver to Osu today?"
          aria-label="Test message"
          className="min-h-10 resize-none"
          disabled={!isProviderConfigured}
        />
        <Button type="submit" size="icon" aria-label="Send test message" disabled={!isProviderConfigured || isPending || !draft.trim()}>
          <Send />
        </Button>
        {turns.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setTurns([])} disabled={isPending} title="Clear this test conversation">
            Reset
          </Button>
        ) : null}
      </form>
    </div>
  );
}
