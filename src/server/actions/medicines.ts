"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { medicationLogs, medications } from "@/server/db/schema";
import { fail, patientActor, type ActionResult } from "@/server/auth/actor";
import { rateLimit } from "@/server/redis/rate-limit";
import { audit } from "@/server/audit";
import { invalidateTeam } from "@/server/services/alerts";
import { addDaysYmd, isValidYmd, localYmd } from "@/lib/dates";

const slotRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const logSchema = z.object({
  medicationId: z.string().uuid(),
  slot: z.string().regex(slotRe),
  status: z.enum(["taken", "skipped"]).nullable(), // null = undo
  forDate: z.string().optional(),
});

/** Mark a dose taken/skipped (or undo). Allowed for today and yesterday only. */
export async function logDose(input: z.input<typeof logSchema>): Promise<ActionResult> {
  try {
    const { user, ctx } = await patientActor();
    const v = logSchema.parse(input);
    const today = localYmd();
    const forDate = v.forDate && isValidYmd(v.forDate) ? v.forDate : today;
    if (forDate !== today && forDate !== addDaysYmd(today, -1)) throw new Error("You can only update today's or yesterday's doses.");
    const rl = await rateLimit(`dose:${user.id}`, 200, 3600);
    if (!rl.ok) throw new Error("Please slow down a little and try again.");

    const [med] = await db
      .select()
      .from(medications)
      .where(and(eq(medications.id, v.medicationId), eq(medications.patientId, ctx.patient.id)))
      .limit(1);
    if (!med) throw new Error("That medicine isn't on your list any more.");
    if (!med.times.includes(v.slot)) throw new Error("That dose time has changed. Please refresh.");

    if (v.status === null) {
      await db.delete(medicationLogs).where(and(eq(medicationLogs.medicationId, med.id), eq(medicationLogs.forDate, forDate), eq(medicationLogs.slot, v.slot)));
    } else {
      await db
        .insert(medicationLogs)
        .values({ medicationId: med.id, patientId: ctx.patient.id, forDate, slot: v.slot, status: v.status, loggedBy: user.id })
        .onConflictDoUpdate({ target: [medicationLogs.medicationId, medicationLogs.forDate, medicationLogs.slot], set: { status: v.status, loggedBy: user.id } });
    }
    await invalidateTeam(ctx.patient.id);
    revalidatePath("/medicines");
    revalidatePath("/home");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

const medSchema = z
  .object({
    name: z.string().trim().min(2, "Please enter the medicine name.").max(80),
    dose: z.string().trim().max(40).optional(),
    times: z
      .array(z.string().regex(slotRe, "Use times like 08:00"))
      .min(1, "Add at least one time.")
      .max(8, "That's a lot of doses. Please check with your team.")
      .transform((t) => [...new Set(t)].sort()),
    instructions: z.string().trim().max(300).optional(),
    endDate: z.string().optional(),
  })
  .refine((v) => !v.endDate || (isValidYmd(v.endDate) && v.endDate >= localYmd()), { message: "End date must be today or later.", path: ["endDate"] });

/** Patients/families can add medicines from their discharge papers; the team sees who added them. */
export async function addMyMedication(input: z.input<typeof medSchema>): Promise<ActionResult> {
  try {
    const { user, ctx } = await patientActor();
    const v = medSchema.parse(input);
    await db.insert(medications).values({
      patientId: ctx.patient.id,
      name: v.name,
      dose: v.dose || null,
      times: v.times,
      instructions: v.instructions || null,
      startDate: localYmd(),
      endDate: v.endDate || null,
      addedBy: user.id,
    });
    await invalidateTeam(ctx.patient.id);
    await audit({ actorId: user.id, patientId: ctx.patient.id, action: "medication.add.self", meta: { name: v.name } });
    revalidatePath("/medicines");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function stopMyMedication(medicationId: string): Promise<ActionResult> {
  try {
    const { user, ctx } = await patientActor();
    const id = z.string().uuid().parse(medicationId);
    const res = await db
      .update(medications)
      .set({ active: false, endDate: localYmd() })
      .where(and(eq(medications.id, id), eq(medications.patientId, ctx.patient.id)))
      .returning({ name: medications.name });
    if (!res.length) throw new Error("That medicine isn't on your list.");
    await invalidateTeam(ctx.patient.id);
    await audit({ actorId: user.id, patientId: ctx.patient.id, action: "medication.stop.self", meta: { name: res[0].name } });
    revalidatePath("/medicines");
    return { ok: true, message: "Removed from today's list. Please tell your care team if you stopped it on your own." };
  } catch (err) {
    return fail(err);
  }
}
