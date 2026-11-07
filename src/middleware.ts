import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge gate: bounce visitors without a session cookie away from app pages early.
 * Real verification (cookie → session → role) happens on the server for every request.
 */
const PROTECTED = ["/home", "/check-in", "/timeline", "/guided", "/companion", "/journey", "/medicines", "/care-team", "/learn", "/settings", "/onboarding", "/link-patient", "/clinic"];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (needsAuth && !req.cookies.has("praana_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
