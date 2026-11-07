import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import { sessions, users, type Role, type User } from "@/server/db/schema";
import { isProd } from "@/server/env";
import { memory, withRedis } from "@/server/redis/client";

export const SESSION_COOKIE = "praana_session";
const SESSION_DAYS = 30;
const CACHE_TTL_SEC = 60 * 10;

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "locale" | "careRole" | "phone">;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const cacheKey = (sid: string) => `praana:sess:${sid}`;

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const sid = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const ua = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  await db.insert(sessions).values({ id: sid, userId, expiresAt, userAgent: ua });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function loadUser(sid: string): Promise<SessionUser | null> {
  const cached = await withRedis(
    (r) => r.get(cacheKey(sid)),
    () => memory().get(cacheKey(sid)),
  );
  if (cached) {
    try {
      return JSON.parse(cached) as SessionUser;
    } catch {
      /* reload */
    }
  }

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      locale: users.locale,
      careRole: users.careRole,
      phone: users.phone,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sid), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;

  const payload = JSON.stringify(row);
  await withRedis(
    async (r) => {
      await r.set(cacheKey(sid), payload, "EX", CACHE_TTL_SEC);
    },
    () => {
      memory().set(cacheKey(sid), payload, CACHE_TTL_SEC);
    },
  );
  return row;
}

/** The signed-in user, or null. Memoised per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  return loadUser(hashToken(token));
});

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role): string {
  return role === "clinician" ? "/clinic" : "/home";
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const sid = hashToken(token);
    await db.delete(sessions).where(eq(sessions.id, sid));
    memory().del(cacheKey(sid));
    await withRedis(
      async (r) => {
        await r.del(cacheKey(sid));
      },
      () => undefined,
    );
  }
  jar.delete(SESSION_COOKIE);
}

/** Drop cached session payloads for a user after profile changes (name, locale…). */
export async function refreshUserSessions(userId: string): Promise<void> {
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  const keys = rows.map((r) => cacheKey(r.id));
  if (!keys.length) return;
  memory().del(...keys);
  await withRedis(
    async (r) => {
      await r.del(...keys);
    },
    () => undefined,
  );
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
