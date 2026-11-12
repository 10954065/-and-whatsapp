import { checkBotId } from "botid/server";
import { fail } from "@/lib/monitoring/errors";
import { logger } from "@/lib/monitoring/logger";

export const BOT_BLOCKED_MESSAGE = "We couldn't confirm this came from a person. Refresh the page and try again.";

/**
 * Stops a form submission that Vercel BotID (Basic, free on every plan) says came from a bot.
 * The page must be listed in config/bot-protection.ts. BotID can only verify on Vercel, so local
 * development and `next start` (the e2e suite) skip the check.
 */
export async function assertHuman(source: string): Promise<void> {
  if (process.env.VERCEL !== "1") return;
  const verification = await checkBotId();
  if (!verification.isBot) return;
  logger.warn("security.bot_blocked", { source });
  throw fail.forbidden(BOT_BLOCKED_MESSAGE);
}
