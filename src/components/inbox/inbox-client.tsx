"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FormAlert, SubmitButton, fieldErrors, Field } from "@/components/forms/form-controls";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/monitoring/errors";
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
    <form ref={ref} onSubmit={onSubmit} className="grid gap-2 border-t bg-card p-3">
      {state && !state.ok ? <FormAlert state={state} /> : null}
      <input type="hidden" name="conversationId" value={conversationId} />
      <Textarea name="text" rows={2} placeholder={disabledReason ?? "Write a reply… (sending takes over from the AI)"} disabled={Boolean(disabledReason)} aria-label="Reply" />
      <div className="flex justify-end">
        <SubmitButton size="sm" isPending={isPending} disabled={Boolean(disabledReason)} pendingLabel="Sending…">
          Send
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
        {control === "AI" ? "Take over" : "Return to AI"}
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
        <select name="status" defaultValue={status} className="h-8 rounded-md border bg-background px-2">
          {["OPEN", "PENDING", "RESOLVED", "CLOSED"].map((value) => (
            <option key={value} value={value}>
              {value.toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Assigned to</span>
        <select name="assignedToId" defaultValue={assignedToId ?? ""} className="h-8 rounded-md border bg-background px-2">
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
        <input name="tags" defaultValue={tags.join(", ")} className="h-8 rounded-md border bg-background px-2" />
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
      <Textarea name="body" rows={2} placeholder="Internal note — never sent to the customer" aria-label="Internal note" />
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
