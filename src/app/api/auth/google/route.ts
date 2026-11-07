import { NextResponse } from "next/server";
import { googleAuthEnabled, isProd } from "@/server/env";
import {
  GOOGLE_NEXT_COOKIE,
  GOOGLE_STATE_COOKIE,
  googleAuthorizeUrl,
  newOAuthState,
} from "@/server/auth/google";
import { safeRedirectPath } from "@/lib/utils-safe";
import { clientIp } from "@/server/auth/session";
import { rateLimit, limits } from "@/server/redis/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!googleAuthEnabled) {
    return NextResponse.redirect(new URL("/login?error=google_off", req.url));
  }

  const ip = await clientIp();
  const rl = await rateLimit(`oauth-google:${ip}`, limits.login.limit, limits.login.windowSec);
  if (!rl.ok) {
    return NextResponse.redirect(new URL("/login?error=rate", req.url));
  }

  const url = new URL(req.url);
  const next = safeRedirectPath(url.searchParams.get("next") ?? undefined);
  const state = newOAuthState();

  const res = NextResponse.redirect(googleAuthorizeUrl(state));
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  if (next) {
    res.cookies.set(GOOGLE_NEXT_COOKIE, next, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  } else {
    res.cookies.delete(GOOGLE_NEXT_COOKIE);
  }
  return res;
}
