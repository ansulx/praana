import "server-only";
import { z } from "zod";
import { summarizeRules, type AdherenceSummary, type TrendCheckin } from "@/lib/clinic/trends";
import { cached, ns } from "@/server/redis/cache";
import { aiEnabled } from "@/server/env";
import { completeJson, plainProse, redactContacts } from "./client";

export type RecoverySummary = { text: string; bullets: string[]; source: "ai" | "rules"; generatedAt: string };

type SummaryCheckin = TrendCheckin & { id: string; freeText: string | null; dayOffset: number | null };

const SYSTEM = `You write a short "since last review" recovery summary for a cancer surgery care team (surgeon, nurse, physiotherapist).
Input: the patient's check-ins over the last 7 days (scores where HIGHER = MORE TROUBLE: pain 0–10, other domains 0–4), safety-rule flags, and medicine adherence.

Rules:
- Plain clinical prose. Never use em dashes or en dashes or double hyphens; use full stops or commas.
- Observations only. Describe what was REPORTED and how it changed. Never diagnose, never name a condition, never suggest treatment, tests or actions.
- Be faithful: no invented numbers. Mention gaps (missed check-ins) and who reported (patient or caregiver) when relevant.
- text: 2–3 plain sentences. bullets: 3–6 short scannable lines, each starting with the domain (e.g. "Pain ↑ 3 → 7/10 over 4 days").`;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "bullets"],
  properties: { text: { type: "string" }, bullets: { type: "array", items: { type: "string" } } },
} as const;

const parsedSchema = z.object({ text: z.string().min(1).max(1500), bullets: z.array(z.string().max(300)).max(8) });

/**
 * Clinician-facing summary of the last 7 days. Uses AI only when a key is configured AND the
 * patient consented to AI processing; otherwise (or on any failure) the deterministic summary.
 * Never throws.
 */
export async function summarizeRecovery(
  patientId: string,
  newestFirst: SummaryCheckin[],
  opts: { allowAi: boolean; adherence?: AdherenceSummary | null; dayOffset?: number | null },
): Promise<RecoverySummary> {
  const rules = (): RecoverySummary => ({
    ...summarizeRules(newestFirst, { adherence: opts.adherence, dayOffset: opts.dayOffset }),
    source: "rules",
    generatedAt: new Date().toISOString(),
  });

    const since = Date.now() - 7 * 86_400_000;
  const window = newestFirst.filter((c) => new Date(c.createdAt).getTime() >= since);
  if (!opts.allowAi || !aiEnabled || window.length === 0) return rules();

  const latest = newestFirst[0]?.id ?? "none";
  const adherenceKey = opts.adherence ? `${opts.adherence.taken}-${opts.adherence.expected}` : "na";
  try {
    return await cached(`summary:${patientId}:${latest}:${adherenceKey}`, { ttlSec: 60 * 60 * 6, namespaces: [ns.patient(patientId)] }, async () => {
      {
        const payload = {
          dayOffsetToday: opts.dayOffset,
          adherence: opts.adherence,
          checkins: [...window].reverse().map((c) => ({
            at: new Date(c.createdAt).toISOString(),
            day: c.dayOffset,
            reporter: c.reporterRole,
            pain: c.pain,
            appetite: c.appetite,
            nausea: c.nausea,
            mobility: c.mobility,
            sleep: c.sleep,
            mood: c.mood,
            anxiety: c.anxiety,
            temperatureC: c.temperatureC,
            wound: c.wound,
            medsTaken: c.medsTaken,
            flags: c.triage === "none" ? [] : c.triageReasons,
            words: c.freeText ? redactContacts(c.freeText).slice(0, 600) : null,
          })),
        };
        const res = await completeJson({
          name: "recovery_summary",
          schema: schema as unknown as Record<string, unknown>,
          maxTokens: 1200,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: JSON.stringify(payload) },
          ],
        });
        const parsed = parsedSchema.parse(JSON.parse(res.content));
        return { text: plainProse(parsed.text.trim()), bullets: parsed.bullets.map(plainProse), source: "ai" as const, generatedAt: new Date().toISOString() };
      }
    });
  } catch (err) {
    // Not cached, so the next view retries the model.
    console.warn("[ai] summary failed, using rules:", (err as Error).message);
    return rules();
  }
}
