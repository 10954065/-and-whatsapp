"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowUp, CheckCheck, Clock, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { FormAlert, SubmitButton, fieldErrors, Field } from "@/components/forms/form-controls";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/monitoring/errors";
import { cn } from "@/lib/utils";
import {
  addNoteAction,
  replyAction,
  returnToAiAction,
  simulateMessageAction,
  takeOverAction,
  updateConversationAction,
} from "@/modules/messaging/messaging.actions";

/** Polling fallback for live updates (no websocket infrastructure required). */
export function InboxAutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);
  return null;
}

export interface ThreadMessage {
  id: string;
  isOutbound: boolean;
  sender: "CUSTOMER" | "AI" | "STAFF" | "SYSTEM" | "AUTOMATION";
  text: string;
  time: string;
  status: string;
  error: string | null;
}

const SENDER_LABEL: Record<ThreadMessage["sender"], string> = {
  CUSTOMER: "Customer",
  AI: "Assistant",
  STAFF: "Team",
  SYSTEM: "System",
  AUTOMATION: "Automation",
};

function DeliveryMark({ status }: { status: string }) {
  if (status === "FAILED") return <TriangleAlert className="size-3 text-destructive" aria-label="Failed" />;
  if (status === "PENDING") return <Clock className="size-3" aria-label="Sending" />;
  return <CheckCheck className={cn("size-3.5", status === "READ" && "text-info")} aria-label={status.toLowerCase()} />;
}

/** Chat thread that opens at the newest message and animates messages that arrive while it is open. */
export function MessageThread({ messages }: { messages: ThreadMessage[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [initialIds] = useState(() => new Set(messages.map((message) => message.id)));
  const hasScrolled = useRef(false);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: hasScrolled.current ? "smooth" : "auto" });
    hasScrolled.current = true;
  }, [messages.length]);

  return (
    <ol
      ref={listRef}
      aria-label="Messages"
      className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-5 sm:px-8"
      style={{ backgroundImage: "radial-gradient(color-mix(in oklch, var(--foreground) 7%, transparent) 1px, transparent 1.2px)", backgroundSize: "16px 16px" }}
    >
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const isGroupStart = !previous || previous.isOutbound !== message.isOutbound || previous.sender !== message.sender;
        const isNew = !initialIds.has(message.id);
        return (
          <motion.li
            key={message.id}
            initial={isNew ? { opacity: 0, y: 12, scale: 0.96 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
            style={{ originX: message.isOutbound ? 1 : 0, originY: 1 }}
            className={cn("flex flex-col", message.isOutbound ? "items-end" : "items-start", isGroupStart && index > 0 && "pt-3")}
          >
            {isGroupStart && message.isOutbound ? (
              <span className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">{SENDER_LABEL[message.sender]}</span>
            ) : null}
            <div
              className={cn(
                "max-w-[78%] rounded-[18px] px-3.5 py-2 text-[14px] leading-snug whitespace-pre-wrap",
                message.isOutbound
                  ? message.sender === "STAFF"
                    ? "rounded-br-[6px] bg-sun text-[#1d1a16]"
                    : "rounded-br-[6px] bg-foreground text-background"
                  : "rounded-bl-[6px] bg-card shadow-[var(--shadow-hairline),0_1px_1px_rgb(0_0_0/0.04)]",
              )}
            >
              {message.text}
            </div>
            <span className={cn("mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground", message.isOutbound && "justify-end")}>
              {message.time}
              {message.isOutbound ? <DeliveryMark status={message.status} /> : null}
              {message.error ? <span className="text-destructive">· {message.error}</span> : null}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}

function useToast(state: ActionResult<unknown> | null) {
  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    if (state && !state.ok) toast.error(state.error);
  }, [state]);
}

export function ReplyComposer({ conversationId, disabledReason }: { conversationId: string; disabledReason: string | null }) {
  const { state, onSubmit, isPending } = useActionForm(replyAction);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="material grid gap-2 border-t px-4 py-3 sm:px-8">
      {state && !state.ok ? <FormAlert state={state} /> : null}
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex items-end gap-2">
        <Textarea
          name="text"
          rows={1}
          placeholder={disabledReason ?? "Write a reply. Sending takes over from the assistant."}
          disabled={Boolean(disabledReason)}
          aria-label="Reply"
          className="max-h-40 min-h-11 rounded-[1.4rem] py-2.5"
        />
        <SubmitButton className="h-11 shrink-0 px-4" isPending={isPending} disabled={Boolean(disabledReason)} pendingLabel="Sending…">
          Send <ArrowUp />
        </SubmitButton>
      </div>
    </form>
  );
}

export function ControlToggle({ conversationId, control }: { conversationId: string; control: "AI" | "HUMAN" }) {
  const take = useActionForm(takeOverAction);
  const back = useActionForm(returnToAiAction);
  useToast(take.state);
  useToast(back.state);
  const form = control === "AI" ? take : back;
  return (
    <form onSubmit={form.onSubmit}>
      <input type="hidden" name="conversationId" value={conversationId} />
      <SubmitButton size="sm" variant={control === "AI" ? "default" : "outline"} isPending={form.isPending}>
        {control === "AI" ? "Take over" : "Hand back to assistant"}
      </SubmitButton>
    </form>
  );
}

export function ConversationSettings({
  conversationId,
  status,
  assignedToId,
  tags,
  members,
}: {
  conversationId: string;
  status: string;
  assignedToId: string | null;
  tags: string[];
  members: { id: string; name: string }[];
}) {
  const { state, onSubmit, isPending } = useActionForm(updateConversationAction);
  useToast(state);
  return (
    <form onSubmit={onSubmit} className="grid gap-3 text-sm">
      <input type="hidden" name="conversationId" value={conversationId} />
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Status</span>
        <select name="status" defaultValue={status} className="h-9 w-full rounded-xl border pl-3 text-sm">
          {["OPEN", "PENDING", "RESOLVED", "CLOSED"].map((value) => (
            <option key={value} value={value}>
              {value.toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Assigned to</span>
        <select name="assignedToId" defaultValue={assignedToId ?? ""} className="h-9 w-full rounded-xl border pl-3 text-sm">
          <option value="">Unassigned</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Tags (comma-separated)</span>
        <input name="tags" defaultValue={tags.join(", ")} className="h-9 w-full rounded-xl border border-input bg-card px-3 text-sm" />
      </label>
      <SubmitButton size="sm" variant="outline" isPending={isPending}>
        Save
      </SubmitButton>
    </form>
  );
}

export function NoteForm({ conversationId }: { conversationId: string }) {
  const { state, onSubmit, isPending } = useActionForm(addNoteAction);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="grid gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <Textarea name="body" rows={2} placeholder="Internal note, never sent to the customer" aria-label="Internal note" />
      <SubmitButton size="sm" variant="outline" isPending={isPending}>
        Add note
      </SubmitButton>
    </form>
  );
}

export function SimulateMessageForm() {
  const { state, onSubmit, isPending } = useActionForm(simulateMessageAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <FormAlert state={state} />
      <Field label="Customer name" name="customerName" defaultValue="Test Customer" errors={fieldErrors(state, "customerName")} />
      <Field label="Message" name="text" multiline rows={3} placeholder="Hi, do you deliver to Osu?" errors={fieldErrors(state, "text")} />
      <SubmitButton size="sm" isPending={isPending} pendingLabel="Sending…">
        Send as customer
      </SubmitButton>
    </form>
  );
}
