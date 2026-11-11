# SUNLEON AI — Connecting a WhatsApp number (for businesses)

## Connect with Facebook (when the platform has Embedded Signup configured)

1. Open **Integrations → WhatsApp Business Platform**, tick the Meta fees box and press
   **Connect WhatsApp**.
2. In Meta's window, log in with Facebook, choose or create the business, then add the phone
   number and type the code Meta sends to it. Press **Finish** on the last screen: closing the
   window there connects nothing.
3. SUNLEON AI swaps Meta's one-time code (valid for 30 seconds) for the business's token,
   checks the number belongs to the WhatsApp account chosen in Meta, registers the number with
   the Cloud API if it is new to it (setting a random two-step verification PIN, stored
   encrypted with the token), links the account to the platform's webhooks, and saves the
   connection. Nothing is saved if any step fails, and the page says which one.
4. Add a payment method for the WhatsApp account in Meta's WhatsApp Manager before the free
   replies run out.

A number that is still active in the WhatsApp or WhatsApp Business phone app cannot be added
this way yet: keeping the phone app on the same number ("coexistence") is not supported.

## Connect with IDs and a token (manual)

Shown under **Connect with IDs and a token instead** when Embedded Signup is configured, and
on its own when it is not.

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
* Embedded Signup needs the platform to be a Meta Tech Provider with `META_WHATSAPP_CONFIG_ID`
  set (see `META_INTEGRATION_GUIDE.md`). Until then, the manual connection is the only path.
