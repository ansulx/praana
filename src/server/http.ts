import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccessError, getActivePatient, type PatientContext } from "@/server/auth/access";
import { clientIp, getSessionUser, type SessionUser } from "@/server/auth/session";
import { rateLimit } from "@/server/redis/rate-limit";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const json = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

/** Uniform error responses — friendly message for the UI, no stack traces. */
export function handleError(err: unknown) {
  if (err instanceof HttpError) {
    return json({ error: err.message, code: err.code }, { status: err.status, headers: err.headers });
  }
  if (err instanceof ZodError) {
    return json({ error: err.issues[0]?.message ?? "Please check your entry.", code: "invalid" }, { status: 400 });
  }
  if (err instanceof AccessError) return json({ error: err.message, code: "forbidden" }, { status: 403 });
  console.error("[api] unhandled", err);
  return json({ error: "Something went wrong on our side. Your information is safe. Please try again.", code: "server" }, { status: 500 });
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Your session has ended. Please sign in again.", "unauthenticated");
  return user;
}

export async function requirePatientActor(): Promise<{ user: SessionUser; ctx: PatientContext; ip: string }> {
  const user = await requireApiUser();
  if (user.role !== "patient" && user.role !== "caregiver") throw new HttpError(403, "This action is for patients and family.", "forbidden");
  const ctx = await getActivePatient(user);
  if (!ctx) throw new HttpError(409, "No patient record is linked to this account yet.", "no_patient");
  return { user, ctx, ip: await clientIp() };
}

export async function enforceRateLimit(bucket: string, limit: { limit: number; windowSec: number }, message?: string) {
  const r = await rateLimit(bucket, limit.limit, limit.windowSec);
  if (!r.ok) {
    throw new HttpError(429, message ?? `You're doing that a lot. Please wait ${Math.ceil(r.retryAfterSec / 60)} minute(s).`, "rate_limited", {
      "Retry-After": String(r.retryAfterSec),
    });
  }
}

export async function readJson(req: Request, maxBytes = 64_000): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413, "That's too much to send at once.", "too_large");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "That's too much to send at once.", "too_large");
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "We couldn't read that request.", "bad_json");
  }
}
