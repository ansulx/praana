import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { alerts, careLinks } from "@/server/db/schema";
import type { Reason } from "@/lib/safety/red-flags";
import { invalidate, ns } from "@/server/redis/cache";
import { publish } from "@/server/redis/pubsub";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Opens an alert for the care team. If the same patient already has an open alert of the
 * same level from the last 12 hours, the new reasons are merged into it instead — the team
 * sees one live item per patient, not a pile of near-duplicates.
 */
export async function raiseAlert(
  tx: Tx,
  input: { patientId: string; checkinId?: string | null; level: "review" | "urgent"; reasons: Reason[]; source?: string },
): Promise<{ id: string; merged: boolean }> {
  const since = new Date(Date.now() - 12 * 3600_000);
  const [existing] = await tx
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.patientId, input.patientId),
        eq(alerts.level, input.level),
        eq(alerts.status, "open"),
        gte(alerts.createdAt, since),
      ),
    )
    .orderBy(desc(alerts.createdAt))
    .limit(1);

  const reasonText = input.reasons.filter((r) => r.level === input.level || r.level === "urgent").map((r) => r.en);

  if (existing) {
    const merged = [...new Set([...existing.reasons, ...reasonText])].slice(0, 20);
    await tx.update(alerts).set({ reasons: merged, checkinId: input.checkinId ?? existing.checkinId }).where(eq(alerts.id, existing.id));
    return { id: existing.id, merged: true };
  }

  const [row] = await tx
    .insert(alerts)
    .values({
      patientId: input.patientId,
      checkinId: input.checkinId ?? null,
      level: input.level,
      reasons: reasonText.length ? reasonText : input.reasons.map((r) => r.en),
      source: input.source ?? "checkin",
    })
    .returning({ id: alerts.id });
  return { id: row.id, merged: false };
}

export async function notifyAlert(patientId: string, alertId: string, level: "review" | "urgent") {
  await invalidateTeam(patientId);
  await publish({ type: "alert", patientId, alertId, level, at: new Date().toISOString() });
}

/** Bust caches for the patient and every clinician on their team. */
export async function invalidateTeam(patientId: string) {
  const team = await db
    .select({ userId: careLinks.userId })
    .from(careLinks)
    .where(and(eq(careLinks.patientId, patientId), eq(careLinks.kind, "clinician")));
  await invalidate(ns.patient(patientId), ...team.map((t) => ns.clinician(t.userId)));
}

export async function updateAlertStatus(
  alertId: string,
  patientIds: string[],
  actorId: string,
  status: "acknowledged" | "resolved",
  note?: string,
) {
  const now = new Date();
  const [row] = await db
    .update(alerts)
    .set(
      status === "acknowledged"
        ? { status, acknowledgedBy: actorId, acknowledgedAt: now }
        : { status, resolvedBy: actorId, resolvedAt: now, resolutionNote: note?.slice(0, 2000) || null },
    )
    .where(and(eq(alerts.id, alertId), inArray(alerts.patientId, patientIds)))
    .returning({ id: alerts.id, patientId: alerts.patientId });
  if (!row) return null;
  await invalidateTeam(row.patientId);
  await publish({ type: "alert-updated", patientId: row.patientId, alertId, at: now.toISOString() });
  return row;
}
