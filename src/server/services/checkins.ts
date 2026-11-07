import "server-only";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { checkins, photos, type Checkin } from "@/server/db/schema";
import { EMPTY_FIELDS, hasAnyContent, type CheckinFields, type StructuredDraft, type SubmitInput } from "@/lib/checkin";
import { dayOffset } from "@/lib/dates";
import { triage, type PreviousCheckin, type TriageResult } from "@/lib/safety/red-flags";
import type { PatientContext } from "@/server/auth/access";
import type { SessionUser } from "@/server/auth/session";
import { structureCheckin } from "@/server/ai/structure";
import { claim, release } from "@/server/redis/idempotency";
import { publish } from "@/server/redis/pubsub";
import { audit } from "@/server/audit";
import { invalidateTeam, notifyAlert, raiseAlert } from "./alerts";

export class CheckinError extends Error {
  constructor(
    message: string,
    public code: "empty" | "duplicate_inflight" | "not_onboarded" | "bad_photo",
  ) {
    super(message);
  }
}

/** Last few check-ins, newest first — the safety engine compares against these. */
export async function recentForTriage(patientId: string, limit = 3): Promise<PreviousCheckin[]> {
  return db
    .select({
      pain: checkins.pain,
      appetite: checkins.appetite,
      nausea: checkins.nausea,
      mobility: checkins.mobility,
      sleep: checkins.sleep,
      mood: checkins.mood,
      anxiety: checkins.anxiety,
      createdAt: checkins.createdAt,
    })
    .from(checkins)
    .where(and(eq(checkins.patientId, patientId), gte(checkins.createdAt, new Date(Date.now() - 10 * 86_400_000))))
    .orderBy(desc(checkins.createdAt))
    .limit(limit);
}

function aiContext(ctx: PatientContext): string {
  const p = ctx.patient;
  const day = dayOffset(p.surgeryDate);
  return [
    p.surgeryName || p.surgeryType ? `Surgery: ${p.surgeryName ?? p.surgeryType}` : null,
    day !== null ? `Day ${day} relative to surgery` : null,
    p.hasDrain ? "Has a surgical drain at home" : null,
  ]
    .filter(Boolean)
    .join(". ");
}

/** Explicit patient answers always win; the structurer only fills what they left blank. */
export function mergeFields(explicit: CheckinFields, draft: StructuredDraft): { fields: CheckinFields; prefilled: (keyof CheckinFields)[] } {
  const fields = { ...EMPTY_FIELDS, ...explicit };
  const prefilled: (keyof CheckinFields)[] = [];
  for (const [k, v] of Object.entries(draft.fields) as [keyof CheckinFields, CheckinFields[keyof CheckinFields]][]) {
    if (fields[k] === null && v !== null && v !== undefined) {
      (fields as Record<string, unknown>)[k] = v;
      prefilled.push(k);
    }
  }
  return { fields, prefilled };
}

export type PreviewResult = {
  draft: StructuredDraft;
  fields: CheckinFields;
  prefilled: (keyof CheckinFields)[];
  triage: TriageResult;
};

export async function previewCheckin(ctx: PatientContext, freeText: string, explicit: CheckinFields): Promise<PreviewResult> {
  const [draft, previous] = await Promise.all([
    structureCheckin(freeText, { allowAi: ctx.patient.consentAi, context: aiContext(ctx) }),
    recentForTriage(ctx.patient.id),
  ]);
  const { fields, prefilled } = mergeFields(explicit, draft);
  const result = triage({ ...fields, freeText, surgeryType: ctx.patient.surgeryType, dayOffset: dayOffset(ctx.patient.surgeryDate) }, previous);
  return { draft, fields, prefilled, triage: result };
}

export type SubmitResult = {
  checkin: Pick<Checkin, "id" | "createdAt" | "triage" | "dayOffset">;
  triage: TriageResult;
  alertId: string | null;
  duplicate: boolean;
};

export async function submitCheckin(user: SessionUser, ctx: PatientContext, input: SubmitInput, ip?: string): Promise<SubmitResult> {
  const patientId = ctx.patient.id;
  if (!ctx.patient.onboardedAt) throw new CheckinError("Please finish setting up your profile first.", "not_onboarded");
  if (!hasAnyContent(input.freeText, input.fields, input.photoIds.length)) {
    throw new CheckinError("Tell us a little about today, choose an answer, or add a photo before sending.", "empty");
  }

  // Already saved? Return the original — retries and double taps are safe.
  const existing = await findByIdempotencyKey(input.idempotencyKey, patientId);
  if (existing) return existing;

  if (!(await claim(`checkin:${input.idempotencyKey}`, 60))) {
    throw new CheckinError("This check-in is already being sent. Please wait a moment.", "duplicate_inflight");
  }

  try {
    const [draft, previous] = await Promise.all([
      structureCheckin(input.freeText, { allowAi: ctx.patient.consentAi, context: aiContext(ctx) }),
      recentForTriage(patientId),
    ]);
    // The patient confirmed `input.fields` on the review screen; draft only fills remaining gaps.
    const { fields } = mergeFields(input.fields, draft);
    const day = dayOffset(ctx.patient.surgeryDate);
    const result = triage({ ...fields, freeText: input.freeText, surgeryType: ctx.patient.surgeryType, dayOffset: day }, previous);

    const aiStatus = draft.source === "ai" ? "done" : draft.source === "fallback" ? "fallback" : "skipped";

    const out = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(checkins)
        .values({
          patientId,
          submittedBy: user.id,
          reporterRole: user.role,
          dayOffset: day,
          inputMode: input.inputMode,
          freeText: input.freeText || null,
          ...fields,
          temperatureC: result.temperatureC,
          structured: draft.source === "none" ? null : {
            summary: draft.summary,
            domains: Object.fromEntries(
              Object.entries(draft.fields).map(([k, v]) => [k, { value: v as string | number | null, evidence: draft.evidence[k as keyof CheckinFields] ?? "" }]),
            ),
            concerns: draft.concerns,
            language: draft.language,
            model: draft.model,
          },
          aiStatus,
          triage: result.level,
          triageReasons: result.reasons.map((r) => r.en),
          idempotencyKey: input.idempotencyKey,
        })
        .onConflictDoNothing({ target: checkins.idempotencyKey })
        .returning({ id: checkins.id, createdAt: checkins.createdAt, triage: checkins.triage, dayOffset: checkins.dayOffset });

      if (!row) return null; // lost a race with an identical submit

      if (input.photoIds.length) {
        const linked = await tx
          .update(photos)
          .set({ checkinId: row.id })
          .where(and(inArray(photos.id, input.photoIds), eq(photos.patientId, patientId), isNull(photos.checkinId)))
          .returning({ id: photos.id });
        if (linked.length !== input.photoIds.length) {
          throw new CheckinError("One of the photos could not be attached. Please add it again.", "bad_photo");
        }
      }

      let alertId: string | null = null;
      if (result.level === "review" || result.level === "urgent") {
        alertId = (await raiseAlert(tx, { patientId, checkinId: row.id, level: result.level, reasons: result.reasons })).id;
      }
      return { row, alertId };
    });

    if (!out) {
      const again = await findByIdempotencyKey(input.idempotencyKey, patientId);
      if (again) return again;
      throw new Error("Check-in could not be saved");
    }

    // Side effects after commit — failures here must not lose the check-in.
    await Promise.allSettled([
      out.alertId ? notifyAlert(patientId, out.alertId, result.level as "review" | "urgent") : invalidateTeam(patientId),
      publish({ type: "checkin", patientId, checkinId: out.row.id, at: new Date().toISOString() }),
      audit({ actorId: user.id, patientId, action: "checkin.submit", ip, meta: { checkinId: out.row.id, triage: result.level, ai: aiStatus, prefilled: input.prefilled } }),
    ]);

    return { checkin: out.row, triage: result, alertId: out.alertId, duplicate: false };
  } finally {
    await release(`checkin:${input.idempotencyKey}`);
  }
}

async function findByIdempotencyKey(key: string, patientId: string): Promise<SubmitResult | null> {
  const [row] = await db
    .select({ id: checkins.id, createdAt: checkins.createdAt, triage: checkins.triage, dayOffset: checkins.dayOffset, reasons: checkins.triageReasons, patientId: checkins.patientId })
    .from(checkins)
    .where(eq(checkins.idempotencyKey, key))
    .limit(1);
  if (!row || row.patientId !== patientId) return null;
  return {
    checkin: { id: row.id, createdAt: row.createdAt, triage: row.triage, dayOffset: row.dayOffset },
    triage: {
      level: row.triage,
      reasons: row.reasons.map((en) => ({ code: "saved", level: row.triage === "none" ? "watch" : row.triage, en, hi: en })) as TriageResult["reasons"],
      actions: [],
      temperatureC: null,
    },
    alertId: null,
    duplicate: true,
  };
}

export async function listCheckins(patientId: string, opts: { sinceDays?: number; limit?: number } = {}) {
  const since = new Date(Date.now() - (opts.sinceDays ?? 60) * 86_400_000);
  const rows = await db
    .select()
    .from(checkins)
    .where(and(eq(checkins.patientId, patientId), gte(checkins.createdAt, since)))
    .orderBy(desc(checkins.createdAt))
    .limit(opts.limit ?? 200);
  if (!rows.length) return [];
  const pics = await db
    .select({ id: photos.id, checkinId: photos.checkinId })
    .from(photos)
    .where(inArray(photos.checkinId, rows.map((r) => r.id)));
  const byCheckin = new Map<string, string[]>();
  for (const p of pics) if (p.checkinId) byCheckin.set(p.checkinId, [...(byCheckin.get(p.checkinId) ?? []), p.id]);
  return rows.map((r) => ({ ...r, photoIds: byCheckin.get(r.id) ?? [] }));
}

export type CheckinWithPhotos = Awaited<ReturnType<typeof listCheckins>>[number];

export async function countCheckinsToday(patientId: string, todayStart: Date) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(checkins)
    .where(and(eq(checkins.patientId, patientId), gte(checkins.createdAt, todayStart)));
  return row?.n ?? 0;
}
