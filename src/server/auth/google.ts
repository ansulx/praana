import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { oauthAccounts, patients, users } from "@/server/db/schema";
import { env, googleAuthEnabled, publicAppUrl } from "@/server/env";
import { createSession, homeFor } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { clientIp } from "@/server/auth/session";
import { safeRedirectPath } from "@/lib/utils-safe";

export const GOOGLE_STATE_COOKIE = "praana_oauth_state";
export const GOOGLE_NEXT_COOKIE = "praana_oauth_next";
export const GOOGLE_PROVIDER = "google";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
/** Google OpenID userinfo (note /v1 — bare /userinfo 404s). */
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const USERINFO_FALLBACK_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export function googleCallbackUrl(): string {
  return `${publicAppUrl()}/api/auth/callback/google`;
}

export function googleAuthorizeUrl(state: string): string {
  if (!googleAuthEnabled || !env.GOOGLE_CLIENT_ID) {
    throw new Error("Google Sign-In is not configured");
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: googleCallbackUrl(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function newOAuthState(): string {
  return randomBytes(24).toString("base64url");
}

type GoogleProfile = {
  sub: string;
  email?: string;
  /** Normalised to boolean | undefined after fetch. */
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
};

function asVerifiedFlag(value: unknown): boolean | undefined {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
}

async function exchangeCode(code: string): Promise<{ accessToken: string; idToken?: string }> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google Sign-In is not configured");
  }
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    redirect_uri: googleCallbackUrl(),
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token?: string; id_token?: string };
  if (!json.access_token) throw new Error("Google did not return an access token");
  return { accessToken: json.access_token, idToken: json.id_token };
}

function profileFromIdToken(idToken: string): GoogleProfile | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof json.sub !== "string" || !json.sub) return null;
    return {
      sub: json.sub,
      email: typeof json.email === "string" ? json.email : undefined,
      email_verified: asVerifiedFlag(json.email_verified),
      name: typeof json.name === "string" ? json.name : undefined,
      given_name: typeof json.given_name === "string" ? json.given_name : undefined,
      picture: typeof json.picture === "string" ? json.picture : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchProfile(accessToken: string, idToken?: string): Promise<GoogleProfile> {
  for (const url of [USERINFO_URL, USERINFO_FALLBACK_URL]) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) {
      const json = (await res.json()) as Record<string, unknown>;
      if (typeof json.sub !== "string" || !json.sub) continue;
      return {
        sub: json.sub,
        email: typeof json.email === "string" ? json.email : undefined,
        email_verified: asVerifiedFlag(json.email_verified),
        name: typeof json.name === "string" ? json.name : undefined,
        given_name: typeof json.given_name === "string" ? json.given_name : undefined,
        picture: typeof json.picture === "string" ? json.picture : undefined,
      };
    }
  }
  const fromId = idToken ? profileFromIdToken(idToken) : null;
  if (fromId) return fromId;
  throw new Error("Google userinfo failed");
}

/**
 * Upsert a PRAANA user from a verified Google profile.
 * New Google-only accounts become patients (caregiver/clinician stay invite/password).
 * Existing email accounts are linked so demo + Google can share the same person.
 */
export async function signInWithGoogleProfile(profile: GoogleProfile): Promise<{
  userId: string;
  role: "patient" | "caregiver" | "clinician";
  isNew: boolean;
  needsOnboarding: boolean;
}> {
  const email = profile.email?.trim().toLowerCase();
  // OpenID email scope should yield a verified address; reject only when Google says unverified.
  if (!email) {
    throw new Error("Google did not share an email. Please allow email access and try again.");
  }
  if (profile.email_verified === false) {
    throw new Error("Please verify your Google email, then try Continue with Google again.");
  }
  if (!profile.sub) throw new Error("Google profile missing subject");

  const name = (profile.name || profile.given_name || email.split("@")[0] || "Patient").slice(0, 100);
  const ip = await clientIp();

  const [linked] = await db
    .select({
      userId: oauthAccounts.userId,
      role: users.role,
    })
    .from(oauthAccounts)
    .innerJoin(users, eq(users.id, oauthAccounts.userId))
    .where(and(eq(oauthAccounts.provider, GOOGLE_PROVIDER), eq(oauthAccounts.providerAccountId, profile.sub)))
    .limit(1);

  if (linked) {
    await createSession(linked.userId);
    await audit({ actorId: linked.userId, action: "auth.login_google", ip });
    const needsOnboarding = await patientNeedsOnboarding(linked.userId, linked.role);
    return { userId: linked.userId, role: linked.role, isNew: false, needsOnboarding };
  }

  const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (byEmail) {
    await db
      .insert(oauthAccounts)
      .values({
        userId: byEmail.id,
        provider: GOOGLE_PROVIDER,
        providerAccountId: profile.sub,
        email,
      })
      .onConflictDoNothing();
    if (byEmail.name === byEmail.email.split("@")[0] && name) {
      await db.update(users).set({ name }).where(eq(users.id, byEmail.id));
    }
    await createSession(byEmail.id);
    await audit({ actorId: byEmail.id, action: "auth.login_google", ip, meta: { linked: true } });
    const needsOnboarding = await patientNeedsOnboarding(byEmail.id, byEmail.role);
    return { userId: byEmail.id, role: byEmail.role, isNew: false, needsOnboarding };
  }

  const userId = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({
        email,
        name,
        passwordHash: null,
        role: "patient",
        locale: "en",
      })
      .returning({ id: users.id });
    await tx.insert(patients).values({ userId: u.id });
    await tx.insert(oauthAccounts).values({
      userId: u.id,
      provider: GOOGLE_PROVIDER,
      providerAccountId: profile.sub,
      email,
    });
    return u.id;
  });

  await createSession(userId);
  await audit({ actorId: userId, action: "auth.register_google", ip });
  return { userId, role: "patient", isNew: true, needsOnboarding: true };
}

async function patientNeedsOnboarding(userId: string, role: string): Promise<boolean> {
  if (role !== "patient") return false;
  const [row] = await db
    .select({ onboardedAt: patients.onboardedAt })
    .from(patients)
    .where(eq(patients.userId, userId))
    .limit(1);
  return !row?.onboardedAt;
}

export async function completeGoogleSignIn(code: string, next?: string | null): Promise<string> {
  const { accessToken, idToken } = await exchangeCode(code);
  const profile = await fetchProfile(accessToken, idToken);
  const result = await signInWithGoogleProfile(profile);
  if (result.needsOnboarding) return "/onboarding";
  return safeRedirectPath(next) ?? homeFor(result.role);
}
