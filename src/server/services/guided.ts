import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/server/db";
import { journeyTaskCompletions, sessionCompletions } from "@/server/db/schema";
import { dayOffset } from "@/lib/dates";
import type { EligibilityContext } from "@/lib/guided/eligibility";
import type { PatientContext } from "@/server/auth/access";
import { cached, ns } from "@/server/redis/cache";
import { getLatestCheckin, getOpenAlertLevel } from "./patient";

export async function getEligibilityContext(ctx: PatientContext, role: "patient" | "caregiver"): Promise<EligibilityContext> {
  const p = ctx.patient;
  const [latest, openLevel] = await Promise.all([getLatestCheckin(p.id), getOpenAlertLevel(p.id)]);
  return {
    dayOffset: dayOffset(p.surgeryDate),
    surgeryType: p.surgeryType,
    hasDrain: p.hasDrain,
    latest: latest
      ? {
          pain: latest.pain,
          anxiety: latest.anxiety,
          sleep: latest.sleep,
          mood: latest.mood,
          temperatureC: latest.temperatureC,
          wound: latest.wound,
          createdAt: latest.createdAt,
        }
      : null,
    hasOpenUrgent: openLevel === "urgent",
    role,
  };
}

export async function getRecentCompletions(patientId: string, days = 14) {
  return cached(`completions:${patientId}:${days}`, { ttlSec: 300, namespaces: [ns.patient(patientId)] }, () =>
    db
      .select({
        id: sessionCompletions.id,
        sessionSlug: sessionCompletions.sessionSlug,
        durationSec: sessionCompletions.durationSec,
        completedFully: sessionCompletions.completedFully,
        feltAfter: sessionCompletions.feltAfter,
        createdAt: sessionCompletions.createdAt,
      })
      .from(sessionCompletions)
      .where(and(eq(sessionCompletions.patientId, patientId), gte(sessionCompletions.createdAt, new Date(Date.now() - days * 86_400_000))))
      .orderBy(desc(sessionCompletions.createdAt))
      .limit(50),
  );
}

export async function getCompletedTaskKeys(patientId: string): Promise<string[]> {
  return cached(`journeytasks:${patientId}`, { ttlSec: 600, namespaces: [ns.patient(patientId)] }, async () => {
    const rows = await db
      .select({ taskKey: journeyTaskCompletions.taskKey })
      .from(journeyTaskCompletions)
      .where(eq(journeyTaskCompletions.patientId, patientId));
    return rows.map((r) => r.taskKey);
  });
}
