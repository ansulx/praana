"use server";

import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { careLinks, careTeamMembers, inviteCodes, patients, teamQuestions, users } from "@/server/db/schema";
import { ACTIVE_PATIENT_COOKIE, listCaregiverPatients } from "@/server/auth/access";
import { fail, patientActor, type ActionResult } from "@/server/auth/actor";
import { redeemInvite } from "@/server/services/invites";
import { clientIp, getSessionUser, refreshUserSessions } from "@/server/auth/session";
import { limits, rateLimit } from "@/server/redis/rate-limit";
import { invalidate, ns } from "@/server/redis/cache";
import { publish } from "@/server/redis/pubsub";
import { audit } from "@/server/audit";
import { invalidateTeam } from "@/server/services/alerts";
import { isProd } from "@/server/env";
import { isValidYmd, localYmd } from "@/lib/dates";

// ─── Caregiver: switch / link ───────────────────────────────────────────────

export async function switchActivePatient(patientId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.role !== "caregiver") return;
  const linked = await listCaregiverPatients(user.id);
  if (!linked.some((p) => p.id === patientId)) return;
  (await cookies()).set(ACTIVE_PATIENT_COOKIE, patientId, { httpOnly: true, sameSite: "lax", secure: isProd, path: "/", maxAge: 60 * 60 * 24 * 180 });
  revalidatePath("/", "layout");
}

const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{6,20}$/, "That code doesn't look right. It's 8 letters and numbers.");

export async function linkPatientByCode(_: unknown, form: FormData): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "caregiver") throw new Error("Only family caregiver accounts can link this way.");
    const rl = await rateLimit(`link:${user.id}`, limits.invite.limit, limits.invite.windowSec);
    if (!rl.ok) throw new Error("Too many attempts. Please try again later.");
    const code = codeSchema.parse(form.get("code"));
    const relationship = z.string().trim().max(40).parse(form.get("relationship") ?? "");
    const linked = await redeemInvite(code, "caregiver", user.id, relationship || null);
    await audit({ actorId: user.id, patientId: linked, action: "caregiver.linked", ip: await clientIp() });
  } catch (err) {
    return fail(err);
  }
  redirect("/home");
}

// ─── Invites (patient side) ─────────────────────────────────────────────────

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion when read aloud

function makeCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function createInvite(kind: "caregiver" | "clinician"): Promise<ActionResult<{ code: string; expiresAt: string }>> {
  try {
    const { user, ctx } = await patientActor();
    if (user.role !== "patient") throw new Error("Only the patient can invite people to their record.");
    const rl = await rateLimit(`invite:${user.id}`, limits.invite.limit, limits.invite.windowSec);
    if (!rl.ok) throw new Error("You've created several codes recently. Please use one of those or try later.");
    const expiresAt = new Date(Date.now() + 72 * 3600_000);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();
      const [row] = await db
        .insert(inviteCodes)
        .values({ code, patientId: ctx.patient.id, kind, createdBy: user.id, expiresAt })
        .onConflictDoNothing()
        .returning({ code: inviteCodes.code });
      if (row) {
        await audit({ actorId: user.id, patientId: ctx.patient.id, action: `invite.create.${kind}` });
        return { ok: true, data: { code: row.code, expiresAt: expiresAt.toISOString() } };
      }
    }
    throw new Error("Couldn't create a code. Please try again.");
  } catch (err) {
    return fail(err);
  }
}

export async function removeCaregiver(linkId: string): Promise<ActionResult> {
  try {
    const { user, ctx } = await patientActor();
    if (user.role !== "patient") throw new Error("Only the patient can remove people from their record.");
    const res = await db
      .delete(careLinks)
      .where(and(eq(careLinks.id, linkId), eq(careLinks.patientId, ctx.patient.id), eq(careLinks.kind, "caregiver")))
      .returning({ userId: careLinks.userId });
    if (!res.length) throw new Error("That person is no longer linked.");
    await invalidate(ns.patient(ctx.patient.id), ns.user(res[0].userId));
    await audit({ actorId: user.id, patientId: ctx.patient.id, action: "caregiver.removed", meta: { userId: res[0].userId } });
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Settings ───────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  locale: z.enum(["en", "hi"]),
  consentAi: z.boolean(),
  hasDrain: z.boolean().optional(),
  dischargeDate: z.string().trim().optional(),
});

/** One-tap language switch from the patient header (EN ↔ हिन्दी). */
export async function setLocale(locale: "en" | "hi"): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "patient" && user.role !== "caregiver")) {
      throw new Error("Please sign in again.");
    }
    const next = z.enum(["en", "hi"]).parse(locale);
    if (next !== user.locale) {
      await db.update(users).set({ locale: next }).where(eq(users.id, user.id));
      await refreshUserSessions(user.id);
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function updateSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  try {
    const { user, ctx } = await patientActor();
    const v = settingsSchema.parse(input);
    if (v.locale !== user.locale) {
      await db.update(users).set({ locale: v.locale }).where(eq(users.id, user.id));
      await refreshUserSessions(user.id);
    }
    if (user.role === "patient") {
      const patch: Partial<typeof patients.$inferInsert> = {};
      if (v.consentAi !== ctx.patient.consentAi) {
        patch.consentAi = v.consentAi;
        patch.consentAt = new Date();
      }
      if (v.hasDrain !== undefined) patch.hasDrain = v.hasDrain;
      if (v.dischargeDate !== undefined && (v.dischargeDate || null) !== ctx.patient.dischargeDate) {
        const d = v.dischargeDate || null;
        if (d && (!isValidYmd(d) || d > localYmd())) throw new Error("Please choose a discharge date that isn't in the future.");
        if (d && ctx.patient.surgeryDate && d < ctx.patient.surgeryDate) throw new Error("Discharge can't be before the surgery date.");
        patch.dischargeDate = d;
      }
      if (Object.keys(patch).length) {
        await db.update(patients).set(patch).where(eq(patients.id, ctx.patient.id));
        await invalidateTeam(ctx.patient.id);
        await audit({ actorId: user.id, patientId: ctx.patient.id, action: "patient.settings", meta: patch as Record<string, unknown> });
      }
    }
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved" };
  } catch (err) {
    return fail(err);
  }
}

// ─── Questions for the human team ───────────────────────────────────────────

export async function askCareTeam(question: string): Promise<ActionResult> {
  try {
    const { user, ctx } = await patientActor();
    const q = z.string().trim().min(3, "Please write your question.").max(1000, "Please keep it under 1000 characters.").parse(question);
    const rl = await rateLimit(`ask:${user.id}`, 20, 3600);
    if (!rl.ok) throw new Error("You've sent several questions recently. Your team will reply soon, for anything urgent, please call them.");
    await db.insert(teamQuestions).values({ patientId: ctx.patient.id, askedBy: user.id, question: q });
    await invalidateTeam(ctx.patient.id);
    await publish({ type: "question", patientId: ctx.patient.id, at: new Date().toISOString() });
    await audit({ actorId: user.id, patientId: ctx.patient.id, action: "question.ask" });
    revalidatePath("/care-team");
    return { ok: true, message: "Sent to your care team. They usually reply within a working day." };
  } catch (err) {
    return fail(err);
  }
}

// ─── Care team contacts the patient maintains themselves ────────────────────

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter a name.").max(100),
  role: z.enum(["surgeon", "oncologist", "nurse", "physiotherapist", "nutritionist", "psychologist", "anaesthesiologist", "coordinator"]),
  phone: z.string().trim().max(20).refine((v) => !v || /^\+?[\d\s-]{7,20}$/.test(v), "Please enter a valid phone number.").optional(),
  availability: z.string().trim().max(120).optional(),
  isPrimaryContact: z.boolean().default(false),
});

export async function addCareContact(input: z.input<typeof contactSchema>): Promise<ActionResult> {
  try {
    const { user, ctx } = await patientActor();
    const v = contactSchema.parse(input);
    await db.transaction(async (tx) => {
      if (v.isPrimaryContact) {
        await tx.update(careTeamMembers).set({ isPrimaryContact: false }).where(eq(careTeamMembers.patientId, ctx.patient.id));
      }
      await tx.insert(careTeamMembers).values({ patientId: ctx.patient.id, name: v.name, role: v.role, phone: v.phone || null, availability: v.availability || null, isPrimaryContact: v.isPrimaryContact });
    });
    await invalidateTeam(ctx.patient.id);
    await audit({ actorId: user.id, patientId: ctx.patient.id, action: "careteam.add" });
    revalidatePath("/care-team");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
