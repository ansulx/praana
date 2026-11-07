"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { careLinks, inviteCodes, patients, users } from "@/server/db/schema";
import { env } from "@/server/env";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { clientIp, createSession, destroySession, getSessionUser, homeFor, refreshUserSessions } from "@/server/auth/session";
import { limits, rateLimit } from "@/server/redis/rate-limit";
import { invalidate, ns } from "@/server/redis/cache";
import { audit } from "@/server/audit";
import { isValidYmd, localYmd, daysBetween } from "@/lib/dates";
import { safeRedirectPath } from "@/lib/utils-safe";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean } | undefined;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address.")
  .max(200);

const fieldErrors = (err: z.ZodError) => {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = String(issue.path[0] ?? "form");
    out[k] ??= issue.message;
  }
  return out;
};

// ─── Login ──────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Please enter your password.").max(200),
  next: z.string().optional(),
});

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { email: em, password, next } = parsed.data;

  const ip = await clientIp();
  const rl = await rateLimit(`login:${ip}:${em}`, limits.login.limit, limits.login.windowSec);
  if (!rl.ok) {
    return { error: `Too many attempts. Please wait ${Math.ceil(rl.retryAfterSec / 60)} minutes and try again.` };
  }

  const [user] = await db.select().from(users).where(eq(users.email, em)).limit(1);
  if (user && !user.passwordHash) {
    return { error: "This account uses Google Sign-In. Tap Continue with Google below." };
  }
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) {
    await audit({ action: "auth.login_failed", ip, meta: { email: em } });
    return { error: "That email and password don't match. Please check and try again." };
  }

  await createSession(user.id);
  await audit({ actorId: user.id, action: "auth.login", ip });
  redirect(safeRedirectPath(next) ?? homeFor(user.role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ─── Register ───────────────────────────────────────────────────────────────

const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letters and at least one number.");

const registerSchema = z
  .object({
    role: z.enum(["patient", "caregiver", "clinician"]),
    name: z.string().trim().min(2, "Please enter your full name.").max(100),
    email,
    phone: z
      .string()
      .trim()
      .max(20)
      .optional()
      .transform((v) => v || undefined)
      .refine((v) => !v || /^\+?[\d\s-]{7,20}$/.test(v), "Please enter a valid phone number."),
    password,
    locale: z.enum(["en", "hi"]).default("en"),
    inviteCode: z.string().trim().toUpperCase().max(40).optional(),
    relationship: z.string().trim().max(40).optional(),
    clinicCode: z.string().trim().max(60).optional(),
    careRole: z
      .enum(["surgeon", "oncologist", "nurse", "physiotherapist", "nutritionist", "psychologist", "anaesthesiologist", "coordinator"])
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "caregiver" && !v.inviteCode) {
      ctx.addIssue({ code: "custom", path: ["inviteCode"], message: "Ask the patient for their family invite code (in their Settings)." });
    }
    if (v.role === "clinician") {
      if (!v.clinicCode) ctx.addIssue({ code: "custom", path: ["clinicCode"], message: "Enter your clinic access code." });
      if (!v.careRole) ctx.addIssue({ code: "custom", path: ["careRole"], message: "Choose your discipline." });
    }
  });

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const ip = await clientIp();
  const rl = await rateLimit(`register:${ip}`, limits.register.limit, limits.register.windowSec);
  if (!rl.ok) return { error: "Too many sign-ups from this network. Please try again later." };

  if (v.role === "clinician" && v.clinicCode !== env.CLINIC_INVITE_CODE) {
    return { fieldErrors: { clinicCode: "That clinic access code isn't valid." } };
  }

  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, v.email)).limit(1);
  if (exists) return { fieldErrors: { email: "An account with this email already exists. Try signing in." } };

  let invite: typeof inviteCodes.$inferSelect | undefined;
  if (v.role === "caregiver") {
    [invite] = await db
      .select()
      .from(inviteCodes)
      .where(and(eq(inviteCodes.code, v.inviteCode!), eq(inviteCodes.kind, "caregiver"), isNull(inviteCodes.usedAt), gt(inviteCodes.expiresAt, new Date())))
      .limit(1);
    if (!invite) return { fieldErrors: { inviteCode: "This invite code is invalid, used, or expired. Ask for a new one." } };
  }

  const passwordHash = await hashPassword(v.password);
  const userId = await db.transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ email: v.email, name: v.name, phone: v.phone, passwordHash, role: v.role, locale: v.locale, careRole: v.role === "clinician" ? v.careRole : null })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (!u) return null;
    if (v.role === "patient") await tx.insert(patients).values({ userId: u.id });
    if (v.role === "caregiver" && invite) {
      // Claim atomically: only one sign-up can use a code.
      const claimed = await tx
        .update(inviteCodes)
        .set({ usedAt: new Date(), usedBy: u.id })
        .where(and(eq(inviteCodes.code, invite.code), isNull(inviteCodes.usedAt)))
        .returning({ code: inviteCodes.code });
      if (!claimed.length) throw new Error("INVITE_TAKEN");
      await tx.insert(careLinks).values({ patientId: invite.patientId, userId: u.id, kind: "caregiver", relationship: v.relationship || null });
    }
    return u.id;
  }).catch((err: Error) => {
    if (err.message === "INVITE_TAKEN") return "INVITE_TAKEN" as const;
    throw err;
  });

  if (userId === "INVITE_TAKEN") return { fieldErrors: { inviteCode: "This invite code was just used. Ask for a new one." } };
  if (!userId) return { fieldErrors: { email: "An account with this email already exists. Try signing in." } };

  if (invite) await invalidate(ns.patient(invite.patientId));
  await createSession(userId);
  await audit({ actorId: userId, action: "auth.register", ip, meta: { role: v.role } });
  redirect(v.role === "patient" ? "/onboarding" : homeFor(v.role));
}

// ─── Onboarding (patient profile + consent) ────────────────────────────────

const onboardingSchema = z
  .object({
    surgeryType: z.enum(["breast", "colorectal", "head_neck", "gynaecologic", "thoracic", "upper_gi", "urologic", "other"]),
    surgeryName: z.string().trim().max(160).optional(),
    surgeryDate: z.string().trim().optional(),
    dischargeDate: z.string().trim().optional(),
    hospital: z.string().trim().max(160).optional(),
    hasDrain: z.enum(["yes", "no"]).default("no"),
    dateOfBirth: z.string().trim().optional(),
    allergies: z.string().trim().max(500).optional(),
    emergencyContactName: z.string().trim().max(100).optional(),
    emergencyContactPhone: z
      .string()
      .trim()
      .max(20)
      .optional()
      .refine((v) => !v || /^\+?[\d\s-]{7,20}$/.test(v), "Please enter a valid phone number."),
    consentCareTeam: z.literal("on", { message: "PRAANA needs your permission to share your updates with your care team." }),
    consentAi: z.string().optional(),
    locale: z.enum(["en", "hi"]).optional(),
  })
  .superRefine((v, ctx) => {
    const today = localYmd();
    for (const key of ["surgeryDate", "dischargeDate", "dateOfBirth"] as const) {
      const val = v[key];
      if (val && !isValidYmd(val)) ctx.addIssue({ code: "custom", path: [key], message: "Please choose a valid date." });
    }
    if (v.surgeryDate && isValidYmd(v.surgeryDate)) {
      const d = daysBetween(today, v.surgeryDate);
      if (d > 365) ctx.addIssue({ code: "custom", path: ["surgeryDate"], message: "That's more than a year away. Please check the date." });
      if (d < -730) ctx.addIssue({ code: "custom", path: ["surgeryDate"], message: "That's more than two years ago. Please check the date." });
    }
    if (v.dischargeDate && v.surgeryDate && isValidYmd(v.dischargeDate) && isValidYmd(v.surgeryDate) && v.dischargeDate < v.surgeryDate) {
      ctx.addIssue({ code: "custom", path: ["dischargeDate"], message: "Discharge can't be before the surgery date." });
    }
    if (v.dischargeDate && isValidYmd(v.dischargeDate) && v.dischargeDate > today) {
      ctx.addIssue({ code: "custom", path: ["dischargeDate"], message: "Discharge date can't be in the future. Leave it empty until you go home." });
    }
    if (v.dateOfBirth && isValidYmd(v.dateOfBirth) && (v.dateOfBirth > today || v.dateOfBirth < "1900-01-01")) {
      ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Please check the date of birth." });
    }
  });

export async function onboardingAction(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user || user.role !== "patient") redirect("/login");

  const parsed = onboardingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const blank = (s?: string) => (s && s.length ? s : null);

  const [row] = await db
    .update(patients)
    .set({
      surgeryType: v.surgeryType,
      surgeryName: blank(v.surgeryName),
      surgeryDate: blank(v.surgeryDate),
      dischargeDate: blank(v.dischargeDate),
      hospital: blank(v.hospital),
      hasDrain: v.hasDrain === "yes",
      dateOfBirth: blank(v.dateOfBirth),
      allergies: blank(v.allergies),
      emergencyContactName: blank(v.emergencyContactName),
      emergencyContactPhone: blank(v.emergencyContactPhone),
      consentCareTeam: true,
      consentAi: v.consentAi === "on",
      consentAt: new Date(),
      onboardedAt: new Date(),
    })
    .where(eq(patients.userId, user.id))
    .returning({ id: patients.id });

  if (v.locale && v.locale !== user.locale) {
    await db.update(users).set({ locale: v.locale }).where(eq(users.id, user.id));
    await refreshUserSessions(user.id);
  }
  if (row) {
    await invalidate(ns.patient(row.id));
    await audit({ actorId: user.id, patientId: row.id, action: "patient.onboarded", meta: { consentAi: v.consentAi === "on" } });
  }
  redirect("/home");
}
