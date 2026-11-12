/**
 * Pages whose forms Vercel BotID guards. Their Server Actions POST to the page's own path, so the
 * browser attaches BotID's proof to those requests and `assertHuman` checks it on the server.
 * A path missing here makes every submission on that page look like a bot.
 */
export const BOT_PROTECTED_FORMS = [
  { path: "/login", method: "POST" },
  { path: "/register", method: "POST" },
  { path: "/forgot-password", method: "POST" },
  { path: "/contact", method: "POST" },
] as const;
