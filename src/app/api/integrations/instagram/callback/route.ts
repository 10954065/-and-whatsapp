import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/current";
import { env } from "@/lib/env";
import { isAppError } from "@/lib/monitoring/errors";
import { reportError } from "@/lib/monitoring/report";
import { completeInstagramConnect } from "@/modules/integrations/integration.service";

export const dynamic = "force-dynamic";

/** OAuth redirect target for Instagram Login. State is validated against the signed-in user. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = new URL("/app/integrations", env().APP_URL);
  const session = await getCurrentSession();
  if (!session) return NextResponse.redirect(new URL("/login", env().APP_URL));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code || !state) {
    back.searchParams.set("instagram", "cancelled");
    return NextResponse.redirect(back);
  }
  try {
    await completeInstagramConnect(session.user.id, state, code.replace(/#_$/, ""));
    back.searchParams.set("instagram", "connected");
  } catch (error) {
    if (!isAppError(error)) await reportError(error, { source: "integration.instagram_callback" });
    back.searchParams.set("instagram", "failed");
  }
  return NextResponse.redirect(back);
}
