"use client";

import Script from "next/script";
import { startTransition, useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import { FormAlert } from "@/components/forms/form-controls";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { META_FREE_REPLIES_PER_MONTH } from "@/config/whatsapp-fees";
import { formatNumber } from "@/lib/format";
import { readEmbeddedSignupMessage } from "@/modules/integrations/embedded-signup";
import { connectWhatsAppEmbeddedAction } from "@/modules/messaging/messaging.actions";

interface FacebookSdk {
  init(options: { appId: string; version: string; autoLogAppEvents: boolean; xfbml: boolean }): void;
  login(callback: (response: { authResponse?: { code?: string } | null }) => void, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}

/** Meta sends the sign-in code and the account details separately; this is how long to wait for both. */
const DETAILS_WAIT_MS = 10_000;
let initialisedAppId: string | null = null;

type Props = { appId: string; configId: string; graphVersion: string };

/**
 * Opens Meta's WhatsApp Embedded Signup. The owner logs in with Facebook, picks or creates their
 * business and adds their number; the server then swaps the 30-second code for their token.
 */
export function WhatsAppEmbeddedSignup({ appId, configId, graphVersion }: Props) {
  const [state, dispatch, isPending] = useActionState(connectWhatsAppEmbeddedAction, null);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const details = useRef<{ wabaId: string; phoneNumberId: string } | null>(null);
  const code = useRef<string | null>(null);
  const checkboxId = useId();

  const submitWhenReady = useCallback(() => {
    if (!code.current || !details.current) return;
    const formData = new FormData();
    formData.set("code", code.current);
    formData.set("wabaId", details.current.wabaId);
    formData.set("phoneNumberId", details.current.phoneNumberId);
    formData.set("metaFeesAcknowledged", "on");
    code.current = null;
    details.current = null;
    startTransition(() => dispatch(formData));
  }, [dispatch]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const signup = readEmbeddedSignupMessage(event.origin, event.data);
      if (!signup) return;
      if (signup.kind === "finish") {
        details.current = { wabaId: signup.wabaId, phoneNumberId: signup.phoneNumberId };
        submitWhenReady();
      } else if (signup.kind === "no_number") {
        setNotice("Meta saved your WhatsApp account, but no number was added. Click Connect WhatsApp again and add your number.");
      } else if (signup.kind === "cancel") {
        setNotice("Meta's window closed before you finished. Click Connect WhatsApp to start again.");
      } else {
        setNotice(signup.message ? `Meta reported a problem: ${signup.message}` : "Meta reported a problem. Click Connect WhatsApp to try again.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [submitWhenReady]);

  const initSdk = () => {
    if (!window.FB) return;
    if (initialisedAppId !== appId) {
      window.FB.init({ appId, version: graphVersion, autoLogAppEvents: false, xfbml: false });
      initialisedAppId = appId;
    }
    setIsSdkReady(true);
  };

  const connect = () => {
    if (!window.FB) return;
    setNotice(null);
    details.current = null;
    code.current = null;
    window.FB.login(
      (response) => {
        const received = response.authResponse?.code;
        if (!received) {
          // Meta returns a code only when the owner presses Finish. A cancel or error message explains the rest.
          setNotice((current) => current ?? "Meta's window closed without finishing. Press Finish on Meta's last screen to connect.");
          return;
        }
        code.current = received;
        submitWhenReady();
        window.setTimeout(() => {
          if (code.current !== received) return;
          code.current = null;
          setNotice("Meta did not send your number's details. Click Connect WhatsApp and try again.");
        }, DETAILS_WAIT_MS);
      },
      { config_id: configId, response_type: "code", override_default_response_type: true, extras: { setup: {}, sessionInfoVersion: "3" } },
    );
  };

  return (
    <div className="grid gap-4">
      <Script src="https://connect.facebook.net/en_US/sdk.js" strategy="afterInteractive" crossOrigin="anonymous" onReady={initSdk} />
      <FormAlert state={state} />
      {notice ? (
        <p role="status" className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
          {notice}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Meta opens a window where you log in with Facebook, choose or create your business, and add your number with a code sent by text message.
      </p>
      <div className="flex items-start gap-2.5">
        <Checkbox id={checkboxId} checked={isAcknowledged} onCheckedChange={(value) => setIsAcknowledged(value === true)} />
        <Label htmlFor={checkboxId} className="text-sm leading-5 font-normal text-muted-foreground">
          I understand that Meta bills my WhatsApp Business account for replies after the free {formatNumber(META_FREE_REPLIES_PER_MONTH)} each month, separately from my SUNLEON plan.
        </Label>
      </div>
      <div>
        <Button type="button" onClick={connect} disabled={!isSdkReady || !isAcknowledged || isPending}>
          {isPending ? "Finishing with Meta…" : "Connect WhatsApp"}
        </Button>
      </div>
    </div>
  );
}
