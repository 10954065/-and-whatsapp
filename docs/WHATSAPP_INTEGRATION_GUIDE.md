# SUNLEON AI — Connecting a WhatsApp number (for businesses)

1. In **Meta Business Suite → WhatsApp Manager**, add and verify the business phone number.
2. In **Business Settings → Users → System users**, create a system user, assign it the WhatsApp
   Business Account, and generate a **permanent token** with `whatsapp_business_messaging` and
   `whatsapp_business_management`.
3. Copy the **Phone number ID** and the **WhatsApp Business Account ID** from WhatsApp Manager →
   API setup.
4. In SUNLEON AI open **Integrations → WhatsApp Business Platform**, paste the three values and
   press **Connect WhatsApp**. SUNLEON AI checks them with Meta before saving; the token is stored
   encrypted.
5. Use **Check connection** at any time. Status `error` or `expired` means the token was revoked —
   generate a new one and connect again.

Notes

* Messages to customers who have not written in the last 24 hours require an approved template.
* Customers can reply **STOP** to opt out; SUNLEON AI will not message them until they reply **START**.
* Meta charges per conversation/template according to its current WhatsApp pricing; those charges are
  billed by Meta, not SUNLEON AI.
* The Embedded Signup flow (`META_WHATSAPP_CONFIG_ID`) is reserved for a later release; manual
  connection with a system-user token is the supported path today.
