import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleAuthEnabled, publicAppUrl } from "@/server/env";
import {
  GOOGLE_NEXT_COOKIE,
  GOOGLE_STATE_COOKIE,
  completeGoogleSignIn,
} from "@/server/auth/google";

export const runtime = "nodejs";

function loginError(code: string): NextResponse {
  const res = NextResponse.redirect(`${publicAppUrl()}/login?error=${code}`);
  res.cookies.delete(GOOGLE_STATE_COOKIE);
  res.cookies.delete(GOOGLE_NEXT_COOKIE);
  return res;
}

export async function GET(req: Request) {
  if (!googleAuthEnabled) return loginError("google_off");

  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  if (err) return loginError(err === "access_denied" ? "google_denied" : "google_failed");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return loginError("google_failed");

  const jar = await cookies();
  const expected = jar.get(GOOGLE_STATE_COOKIE)?.value;
  const next = jar.get(GOOGLE_NEXT_COOKIE)?.value;
  if (!expected || expected !== state) return loginError("google_state");

  try {
    const dest = await completeGoogleSignIn(code, next);
    const path = dest.startsWith("/") ? dest : `/${dest}`;
    const res = NextResponse.redirect(`${publicAppUrl()}${path}`);
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    res.cookies.delete(GOOGLE_NEXT_COOKIE);
    return res;
  } catch (e) {
    console.error("[google-oauth]", (e as Error).message);
    return loginError("google_failed");
  }
}
