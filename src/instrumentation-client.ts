import { initBotId } from "botid/client/core";
import { BOT_PROTECTED_FORMS } from "@/config/bot-protection";

// Runs in the browser before the app starts: attaches BotID's proof to the protected form submissions.
initBotId({ protect: BOT_PROTECTED_FORMS.map((form) => ({ ...form })) });
