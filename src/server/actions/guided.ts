"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { journeyTaskCompletions, sessionCompletions } from "@/server/db/schema";
import { fail, patientActor, type ActionResult } from "@/server/auth/actor";
import { getSession } from "@/content/guided";
import { ALL_TASK_KEYS } from "@/content/journey";
import { rateLimit } from "@/server/redis/rate-limit";
import { audit } from "@/server/audit";
import { invalidateTeam } from "@/server/services/alerts";

const completionSchema = z.object({
  slug: z.string().max(80).refine((s) => !!getSession(s), "Unknown session."),
  durationSec: z.number().finite(),
  completedFully: z.boolean(),
  feltAfter: z.enum(["better", "same", "worse"]).nullable(),
});

export async function logSessionCompletion(
  input: z.input<typeof completionSchema>,
): Promise<ActionResult<{ suggestCheckin: boolean }>> {
  try {
    const { user, ctx } = await patientActor();
    const v = completionSchema.parse(input);
    const rl = await rateLimit(`session:${user.id}`, 40, 3600);
    if (!rl.ok) throw new Error("You've logged a lot of sessions recently. Please try again a little later.");
    const durationSec = Math.round(Math.min(Math.max(v.durationSec, 10), 3 * 3600));

    await db.insert(sessionCompletions).values({
      patientId: ctx.patient.id,
      sessionSlug: v.slug,
      durationSec,
      completedFully: v.completedFully,
      feltAfter: v.feltAfter,
      loggedBy: user.id,
    });
    await invalidateTeam(ctx.patient.id);
    await audit({ actorId: user.id, patientId: ctx.patient.id, action: "guided.complete", meta: { slug: v.slug, durationSec, feltAfter: v.feltAfter } });
    revalidatePath("/guided");
    return { ok: true, data: { suggestCheckin: v.feltAfter === "worse" } };
  } catch (err) {
    return fail(err);
  }
}

const taskSchema = z.object({
  taskKey: z.string().max(60).refine((k) => ALL_TASK_KEYS.has(k), "Unknown task."),
  done: z.boolean(),
});

export async function toggleJourneyTask(taskKey: string, done: boolean): Promise<ActionResult> {
  try {
    const { user, ctx } = await patientActor();
    const v = taskSchema.parse({ taskKey, done });
    const rl = await rateLimit(`journey:${user.id}`, 120, 3600);
    if (!rl.ok) throw new Error("Please slow down a little and try again.");
    if (v.done) {
      await db
        .insert(journeyTaskCompletions)
        .values({ patientId: ctx.patient.id, taskKey: v.taskKey, completedBy: user.id })
        .onConflictDoNothing();
    } else {
      await db
        .delete(journeyTaskCompletions)
        .where(and(eq(journeyTaskCompletions.patientId, ctx.patient.id), eq(journeyTaskCompletions.taskKey, v.taskKey)));
    }
    await invalidateTeam(ctx.patient.id);
    revalidatePath("/journey");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
