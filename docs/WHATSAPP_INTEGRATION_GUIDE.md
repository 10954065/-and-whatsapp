# SUNLEON AI — Connecting a WhatsApp number (for businesses)

1. In **Meta Business Suite → WhatsApp Manager**, add and verify the business phone number.
2. In **Business Settings → Users → System users**, create a system user, assign it the WhatsApp
   Business Account, and generate a **permanent token for the SUNLEON AI app** with
   `whatsapp_business_messaging` and `whatsapp_business_management`. Meta only sends a number's
   messages to the app its token was made for, so a token from any other app is refused.
3. Copy the **Phone number ID** and the **WhatsApp Business Account ID** from WhatsApp Manager →
   API setup.
4. In SUNLEON AI open **Integrations → WhatsApp Business Platform**, paste the three values and
   press **Connect WhatsApp**. SUNLEON AI checks them with Meta, confirms the token belongs to the
   SUNLEON AI app, and subscribes the WhatsApp Business Account to the app's webhooks
   (`POST /{waba-id}/subscribed_apps`) before saving; the token is stored encrypted.
5. Use **Check connection** at any time. Status `error` or `expired` means the token was revoked —
   generate a new one and connect again.

Notes

* Messages to customers who have not written in the last 24 hours require an approved template.
* Customers can reply **STOP** to opt out; SUNLEON AI will not message them until they reply **START**.
* Meta bills each business's own WhatsApp Business account, not SUNLEON AI. Since 2026-10-01 every
  business number gets 1,000 free delivered replies (service messages) a month; Meta charges each
  delivered reply after that, and template messages by category. Replies stop after the free 1,000 when
  the business has no payment method in Meta Billing Hub. The rules live in
  `src/config/whatsapp-fees.ts`; the pricing page (`/pricing#whatsapp-fees`), sign-up, Terms and the
  Integrations page all show them, and connecting a number requires ticking an acknowledgment that is
  stored in the `integration.connected` audit entry.
* The Embedded Signup flow (`META_WHATSAPP_CONFIG_ID`) is reserved for a later release; manual
  connection with a system-user token is the supported path today.
