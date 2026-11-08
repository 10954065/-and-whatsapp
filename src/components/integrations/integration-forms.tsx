"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Field, FormAlert, SubmitButton, fieldErrors } from "@/components/forms/form-controls";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/hooks/use-action-form";
import {
  connectSandboxAction,
  connectWhatsAppAction,
  disconnectAction,
  healthCheckAction,
  startInstagramAction,
} from "@/modules/messaging/messaging.actions";

export function WhatsAppConnectForm() {
  const { state, onSubmit, isPending } = useActionForm(connectWhatsAppAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone number ID" name="phoneNumberId" inputMode="numeric" errors={fieldErrors(state, "phoneNumberId")} />
        <Field label="WhatsApp Business Account ID" name="wabaId" inputMode="numeric" errors={fieldErrors(state, "wabaId")} />
      </div>
      <Field
        label="Permanent access token"
        name="accessToken"
        type="password"
        autoComplete="off"
        hint="Create a system user in Meta Business Settings with whatsapp_business_messaging and whatsapp_business_management permissions. Stored encrypted."
        errors={fieldErrors(state, "accessToken")}
      />
      <div>
        <SubmitButton isPending={isPending} pendingLabel="Verifying with Meta…">
          Connect WhatsApp
        </SubmitButton>
      </div>
    </form>
  );
}

export function InstagramConnectButton({ disabled }: { disabled: boolean }) {
  return (
    <form action={startInstagramAction}>
      <Button type="submit" disabled={disabled}>
        Connect with Instagram
      </Button>
    </form>
  );
}

export function SandboxConnectButton() {
  const [state, dispatch, isPending] = useActionState(connectSandboxAction, null);
  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    if (state && !state.ok) toast.error(state.error);
  }, [state]);
  return (
    <form action={dispatch}>
      <Button type="submit" variant="outline" disabled={isPending}>
        Turn on test channel
      </Button>
    </form>
  );
}

export function IntegrationActions({ id }: { id: string }) {
  const health = useActionForm(healthCheckAction);
  const disconnect = useActionForm(disconnectAction);
  useEffect(() => {
    for (const state of [health.state, disconnect.state]) {
      if (state?.ok && state.message) toast.success(state.message);
      if (state && !state.ok) toast.error(state.error);
    }
  }, [health.state, disconnect.state]);
  return (
    <div className="flex gap-2">
      <form onSubmit={health.onSubmit}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton size="sm" variant="outline" isPending={health.isPending}>
          Check connection
        </SubmitButton>
      </form>
      <form onSubmit={disconnect.onSubmit}>
        <input type="hidden" name="id" value={id} />
        <SubmitButton size="sm" variant="ghost" className="text-destructive" isPending={disconnect.isPending}>
          Disconnect
        </SubmitButton>
      </form>
    </div>
  );
}
