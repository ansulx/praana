"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { appointments, medications, notes, teamQuestions } from "@/server/db/schema";
import { assertPatientAccess } from "@/server/auth/access";
import { fail, type ActionResult } from "@/server/auth/actor";
import { clientIp, getSessionUser, type SessionUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { limits, rateLimit } from "@/server/redis/rate-limit";
import { invalidate, ns } from "@/server/redis/cache";
import { invalidateTeam, updateAlertStatus } from "@/server/services/alerts";
import { clinicianPatientIds } from "@/server/services/clinic";
import { redeemInvite } from "@/server/services/invites";
import { isValidYmd } from "@/lib/dates";

async function clinician(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.role !== "clinician") throw new Error("Please sign in with a care-team account.");
  const rl = await rateLimit(`clinic:${user.id}`, limits.generic.limit, limits.generic.windowSec);
  if (!rl.ok) throw new Error("Too many actions in a short time. Please wait a moment.");
  return user;
}

const uuid = z.string().uuid("Invalid id.");

function touch(patientId: string) {
  revalidatePath(`/clinic/patients/${patientId}`);
  revalidatePath("/clinic");
}

// ─── Alerts ────────────────────────────────────────────────────────────────

export async function acknowledgeAlert(alertId: string): Promise<ActionResult> {
  try {
    const user = await clinician();
    const id = uuid.parse(alertId);
    const row = await updateAlertStatus(id, await clinicianPatientIds(user.id), user.id, "acknowledged");
    if (!row) throw new Error("That alert is no longer available.");
    await audit({ actorId: user.id, patientId: row.patientId, action: "alert.acknowledge", meta: { alertId: id }, ip: await clientIp() });
    touch(row.patientId);
    return { ok: true, message: "Alert acknowledged" };
  } catch (err) {
    return fail(err);
  }
}

export async function resolveAlert(alertId: string, note: string): Promise<ActionResult> {
  try {
    const user = await clinician();
    const id = uuid.parse(alertId);
    const body = z.string().trim().min(3, "Add a short note on what was done.").max(2000).parse(note);
    const row = await updateAlertStatus(id, await clinicianPatientIds(user.id), user.id, "resolved", body);
    if (!row) throw new Error("That alert is no longer available.");
    await audit({ actorId: user.id, patientId: row.patientId, action: "alert.resolve", meta: { alertId: id }, ip: await clientIp() });
    touch(row.patientId);
    return { ok: true, message: "Alert resolved" };
  } catch (err) {
    return fail(err);
  }
}

// ─── Notes & questions ─────────────────────────────────────────────────────

const noteSchema = z.object({
  patientId: uuid,
  body: z.string().trim().min(2, "Write a note first.").max(4000, "Please keep notes under 4000 characters."),
  visibility: z.enum(["team", "shared"]),
});

export async function addNote(patientId: string, body: string, visibility: "team" | "shared"): Promise<ActionResult> {
  try {
    const user = await clinician();
    const v = noteSchema.parse({ patientId, body, visibility });
    await assertPatientAccess(user, v.patientId);
    await db.insert(notes).values({ patientId: v.patientId, authorId: user.id, body: v.body, visibility: v.visibility });
    await invalidateTeam(v.patientId);
    await audit({ actorId: user.id, patientId: v.patientId, action: "note.add", meta: { visibility: v.visibility } });
    touch(v.patientId);
    return { ok: true, message: v.visibility === "shared" ? "Note shared with the patient" : "Note saved for the team" };
  } catch (err) {
    return fail(err);
  }
}

export async function answerQuestion(questionId: string, answer: string): Promise<ActionResult> {
  try {
    const user = await clinician();
    const id = uuid.parse(questionId);
    const text = z.string().trim().min(2, "Write an answer first.").max(2000).parse(answer);
    const [q] = await db.select({ patientId: teamQuestions.patientId }).from(teamQuestions).where(eq(teamQuestions.id, id)).limit(1);
    if (!q) throw new Error("That question no longer exists.");
    await assertPatientAccess(user, q.patientId);
    const updated = await db
      .update(teamQuestions)
      .set({ answer: text, answeredBy: user.id, answeredAt: new Date() })
      .where(and(eq(teamQuestions.id, id), isNull(teamQuestions.answer)))
      .returning({ id: teamQuestions.id });
    if (!updated.length) throw new Error("A colleague has already answered this question.");
    await invalidateTeam(q.patientId);
    await audit({ actorId: user.id, patientId: q.patientId, action: "question.answer", meta: { questionId: id } });
    touch(q.patientId);
    return { ok: true, message: "Answer sent to the patient" };
  } catch (err) {
    return fail(err);
  }
}

// ─── Medications ───────────────────────────────────────────────────────────

const ymd = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => !v || isValidYmd(v), "Choose a valid date.");

const medSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the medicine name.").max(120),
    dose: z.string().trim().max(60).optional(),
    times: z
      .array(z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times must be HH:mm (24-hour)."))
      .transform((t) => [...new Set(t)].sort())
      .pipe(z.array(z.string()).min(1, "Add at least one time.").max(8, "At most 8 times a day.")),
    instructions: z.string().trim().max(500).optional(),
    startDate: ymd,
    endDate: ymd,
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "End date can't be before the start date." });

export type MedicationInput = z.input<typeof medSchema>;

export async function addMedication(patientId: string, input: MedicationInput): Promise<ActionResult> {
  try {
    const user = await clinician();
    const pid = uuid.parse(patientId);
    await assertPatientAccess(user, pid);
    const v = medSchema.parse(input);
    await db.insert(medications).values({
      patientId: pid,
      name: v.name,
      dose: v.dose || null,
      times: v.times,
      instructions: v.instructions || null,
      startDate: v.startDate ?? null,
      endDate: v.endDate ?? null,
      addedBy: user.id,
    });
    await invalidateTeam(pid);
    await audit({ actorId: user.id, patientId: pid, action: "medication.add", meta: { name: v.name } });
    touch(pid);
    return { ok: true, message: `${v.name} added` };
  } catch (err) {
    return fail(err);
  }
}

export async function stopMedication(medicationId: string): Promise<ActionResult> {
  try {
    const user = await clinician();
    const id = uuid.parse(medicationId);
    const [m] = await db.select({ patientId: medications.patientId, name: medications.name }).from(medications).where(eq(medications.id, id)).limit(1);
    if (!m) throw new Error("That medicine no longer exists.");
    await assertPatientAccess(user, m.patientId);
    await db.update(medications).set({ active: false }).where(eq(medications.id, id));
    await invalidateTeam(m.patientId);
    await audit({ actorId: user.id, patientId: m.patientId, action: "medication.stop", meta: { medicationId: id } });
    touch(m.patientId);
    return { ok: true, message: `${m.name} stopped` };
  } catch (err) {
    return fail(err);
  }
}

// ─── Appointments ──────────────────────────────────────────────────────────

const apptSchema = z.object({
  title: z.string().trim().min(2, "Give the appointment a title.").max(120),
  kind: z.enum(["in_person", "tele_physio", "video", "phone"]),
  withName: z.string().trim().max(100).optional(),
  startsAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Choose a valid date and time.")
    .transform((v) => new Date(v))
    .refine((d) => d.getTime() > Date.now() - 86_400_000, "That time is more than a day in the past.")
    .refine((d) => d.getTime() < Date.now() + 400 * 86_400_000, "That's more than a year away."),
  durationMin: z.coerce.number().int().min(5, "At least 5 minutes.").max(240, "At most 4 hours."),
  location: z.string().trim().max(200).optional(),
  joinUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => {
      if (!v) return true;
      try {
        return new URL(v).protocol === "https:";
      } catch {
        return false;
      }
    }, "The video link must start with https://"),
  notes: z.string().trim().max(500).optional(),
});

export type AppointmentInput = z.input<typeof apptSchema>;

export async function addAppointment(patientId: string, input: AppointmentInput): Promise<ActionResult> {
  try {
    const user = await clinician();
    const pid = uuid.parse(patientId);
    await assertPatientAccess(user, pid);
    const v = apptSchema.parse(input);
    if ((v.kind === "tele_physio" || v.kind === "video") && !v.joinUrl) throw new Error("Add a video link for online sessions.");
    await db.insert(appointments).values({
      patientId: pid,
      title: v.title,
      kind: v.kind,
      withName: v.withName || user.name,
      startsAt: v.startsAt,
      durationMin: v.durationMin,
      location: v.location || null,
      joinUrl: v.joinUrl ?? null,
      notes: v.notes || null,
      createdBy: user.id,
    });
    await invalidateTeam(pid);
    await audit({ actorId: user.id, patientId: pid, action: "appointment.add", meta: { kind: v.kind } });
    touch(pid);
    return { ok: true, message: "Appointment added" };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelAppointment(appointmentId: string): Promise<ActionResult> {
  try {
    const user = await clinician();
    const id = uuid.parse(appointmentId);
    const [a] = await db.select({ patientId: appointments.patientId }).from(appointments).where(eq(appointments.id, id)).limit(1);
    if (!a) throw new Error("That appointment no longer exists.");
    await assertPatientAccess(user, a.patientId);
    await db.update(appointments).set({ cancelledAt: new Date() }).where(and(eq(appointments.id, id), isNull(appointments.cancelledAt)));
    await invalidateTeam(a.patientId);
    await audit({ actorId: user.id, patientId: a.patientId, action: "appointment.cancel", meta: { appointmentId: id } });
    touch(a.patientId);
    return { ok: true, message: "Appointment cancelled" };
  } catch (err) {
    return fail(err);
  }
}

// ─── Linking ───────────────────────────────────────────────────────────────

export async function linkPatientByCode(code: string): Promise<ActionResult<{ patientId: string }>> {
  try {
    const user = await clinician();
    const rl = await rateLimit(`clinic-link:${user.id}`, limits.invite.limit, limits.invite.windowSec);
    if (!rl.ok) throw new Error("Too many attempts. Please try again later.");
    const clean = z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{6,20}$/, "That code doesn't look right. It's 8 letters and numbers, like ABCD-EF23.")
      .parse(code);
    const patientId = await redeemInvite(clean, "clinician", user.id, null);
    await invalidate(ns.clinician(user.id));
    await audit({ actorId: user.id, patientId, action: "clinician.linked", ip: await clientIp() });
    revalidatePath("/clinic");
    return { ok: true, data: { patientId }, message: "Patient added to your list" };
  } catch (err) {
    return fail(err);
  }
}
