# SUNLEON AI — Meta Integration Guide (WhatsApp + Instagram)

SUNLEON AI uses only Meta's official platforms: the **WhatsApp Business Platform (Cloud API)**
and the **Instagram API with Unified Login**. No browser automation or unofficial libraries.

> Status: implemented and covered by tests with recorded payload shapes. **Not live-verified** —
> it requires a Meta app, App Review approval and real credentials (see "Blocked by" below).

## 1. One-time platform setup (Sunleon)

1. Create a Meta app (type **Business**) at developers.facebook.com and complete
   **Business Verification** for Sunleon Router Enterprise.
2. Add the **WhatsApp** and **Instagram** products.
3. Webhooks — callback URL `https://<APP_URL>/api/webhooks/meta`, verify token = `META_WEBHOOK_VERIFY_TOKEN`.
   * WhatsApp (`whatsapp_business_account`): subscribe to `messages`. Each business's WhatsApp
     Business Account is linked to the app automatically when it connects (`subscribed_apps`).
   * Instagram (`instagram`, on the *API setup with Unified login* tab): subscribe to `messages`,
     `messaging_seen`. Each connected Instagram account is linked automatically
     (`POST /{instagram-account-id}/subscribed_apps`).
4. Instagram → *API setup with Unified login* → create a configuration: login variation
   **General**, **System-user access token**, expiration **Never**, asset **Instagram account**
   only, permissions `instagram_basic` and `instagram_manage_messages`. Register the redirect URL
   `https://<APP_URL>/api/integrations/instagram/callback` and set the configuration's id as
   `META_INSTAGRAM_CONFIG_ID`. Owners then connect by logging in with Instagram or Facebook; no
   Facebook Page is needed.
5. Set env vars: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`,
   `META_GRAPH_API_VERSION` (default `v27.0`), `META_INSTAGRAM_CONFIG_ID`. All webhooks, WhatsApp
   and Instagram, are signed with `META_APP_SECRET`.
6. App Review: request `whatsapp_business_messaging`, `whatsapp_business_management`,
   `instagram_basic`, `instagram_manage_messages` (Advanced Access).
7. WhatsApp Embedded Signup (the **Connect WhatsApp** button), once Business Verification and
   App Review are approved:
   * Complete Meta's Tech Provider onboarding for the app.
   * Add the **Facebook Login for Business** product. In its settings turn on
     **Login with the JavaScript SDK** and add `<APP_URL>`'s domain (for example
     `www.sunleon-ai.com`) to **Allowed domains for the JavaScript SDK**.
   * Under **Configurations**, create one with the **WhatsApp Embedded Signup** login variation
     and the `whatsapp_business_management` and `whatsapp_business_messaging` permissions.
   * Set its id as `META_WHATSAPP_CONFIG_ID` and redeploy. The button appears when
     `META_APP_ID`, `META_APP_SECRET` and `META_WHATSAPP_CONFIG_ID` are all set; the manual form
     stays available under it.

## 2. Security

* Every webhook POST is verified with `X-Hub-Signature-256` (HMAC-SHA256 of the **raw** body with the
  app secret, constant-time compare) before anything is stored. Invalid signatures get `401`.
* Events are persisted to `WebhookEvent` with a dedupe key derived from message/status ids, so Meta
  retries never create duplicate messages; `Message(channel, providerMessageId)` is also unique.
* The endpoint answers immediately; processing happens in the `webhook.meta` job.
* Access tokens are stored AES-256-GCM encrypted (`Integration.credentialsEnc`), never logged or sent to
  the browser. Instagram OAuth uses a hashed, single-use, 10-minute `state` bound to the user.

## 3. Messaging rules enforced

* **24-hour customer-service window** — free-form replies only within 24 h of the customer's last
  message (tracked in `Conversation.lastInboundAt`). Outside it, WhatsApp needs an approved template;
  Instagram refuses.
* **Opt-out** — `STOP`/`UNSUBSCRIBE` set consent to `OPTED_OUT` (recorded in `ConsentRecord`); sending is
  then refused. `START` opts back in.
* **Preview safety** — Vercel preview deployments are always in sandbox mode; outbound messages are
  recorded as `SANDBOXED` and never sent.

## 4. Testing without Meta

Integrations → **Turn on test channel**, then use *Simulate a customer* in the inbox. The message goes
through the same inbound pipeline, AI reply job, inbox and takeover flow.

## 5. Blocked by (external)

Meta Business Verification, App Review for the permissions above, a WhatsApp Business Account with a
registered phone number, and an Instagram professional account. Until then, the Integrations page shows
that the platform credentials are not configured.
