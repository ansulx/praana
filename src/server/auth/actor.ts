import "server-only";
import { z } from "zod";
import { getActivePatient, type PatientContext } from "@/server/auth/access";
import { getSessionUser, type SessionUser } from "@/server/auth/session";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Resolves the signed-in patient/caregiver and the record they act on, or throws a friendly error. */
export async function patientActor(): Promise<{ user: SessionUser; ctx: PatientContext }> {
  const user = await getSessionUser();
  if (!user || (user.role !== "patient" && user.role !== "caregiver")) throw new Error("Please sign in again.");
  const ctx = await getActivePatient(user);
  if (!ctx) throw new Error("No patient record is linked to this account yet.");
  return { user, ctx };
}

export const fail = (err: unknown): { ok: false; error: string } => ({
  ok: false,
  error: err instanceof z.ZodError ? (err.issues[0]?.message ?? "Please check your entry.") : err instanceof Error ? err.message : "Something went wrong. Please try again.",
});

