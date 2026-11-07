import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { checkinFieldsSchema, type StructuredDraft } from "@/lib/checkin";
import { memory, withRedis } from "@/server/redis/client";
import { AI_MODEL, completeJson, plainProse, redactContacts } from "./client";
import { aiEnabled } from "@/server/env";
import { structureWithRules } from "./fallback";

/**
 * Free text (any language, typed or spoken) → structured recovery domains + a short
 * summary for the care team. The model reads; it does not judge. Triage is decided by
 * the deterministic safety engine, and the patient confirms every value before saving.
 */

const SYSTEM = `You help structure a cancer surgery patient's daily recovery check-in for their care team.
The patient or their family caregiver writes in their own words, English, Hindi, Hinglish (romanised Hindi) or a mix.

Extract ONLY what the text states or clearly implies. If a domain is not mentioned, return null. Never guess.

Scales, HIGHER = MORE TROUBLE:
- pain: 0–10 numeric rating (0 none, 2 mild, 4 uncomfortable, 6 hard to ignore, 8 severe, 10 worst). Use a number the patient gives. Words like "bahut dard" ≈ 7.
- appetite 0–4: 0 normal, 1 a little less, 2 about half, 3 very little, 4 can't eat/drink.
- nausea 0–4: 0 none, 1 mild, 2 nauseous no vomiting, 3 vomited once or twice, 4 can't keep fluids down.
- mobility 0–4: 0 as usual, 1 walking a bit slower, 2 short walks only, 3 mostly bed/chair, 4 can't get up without help.
- sleep 0–4: 0 slept well, 1 woke a few times, 2 restless, 3 hardly slept, 4 none.
- mood 0–4: 0 good, 1 okay, 2 low, 3 very low, 4 hopeless.
- anxiety 0–4: 0 calm, 1 a little worried, 2 worried, 3 very anxious, 4 overwhelmed/panicky.
- wound: one of no_wound, healing_well, redness, swelling, discharge, bleeding, opening, or null.
- temperatureC: a number in °C if a temperature is given (convert °F to °C), else null.
- medsTaken: all, some, none, not_applicable, or null.

summary (never use em dashes or en dashes): 1–2 plain English sentences for a busy clinician, third person ("Reports…"), faithful to the patient's words. No diagnosis, no advice, no reassurance.
concerns: short phrases for anything a clinician should notice (e.g. "new calf pain", "bleeding through dressing"). Empty if none.
evidence: for each non-null domain, the short phrase from the text that supports it (original language).
language: the main language of the text, e.g. "en", "hi", "hinglish".`;

const evidenceKeys = ["pain", "appetite", "nausea", "mobility", "sleep", "mood", "anxiety", "wound", "temperatureC", "medsTaken"] as const;

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fields", "summary", "concerns", "evidence", "language"],
  properties: {
    fields: {
      type: "object",
      additionalProperties: false,
      required: [...evidenceKeys],
      properties: {
        pain: { type: ["integer", "null"], minimum: 0, maximum: 10 },
        appetite: { type: ["integer", "null"], minimum: 0, maximum: 4 },
        nausea: { type: ["integer", "null"], minimum: 0, maximum: 4 },
        mobility: { type: ["integer", "null"], minimum: 0, maximum: 4 },
        sleep: { type: ["integer", "null"], minimum: 0, maximum: 4 },
        mood: { type: ["integer", "null"], minimum: 0, maximum: 4 },
        anxiety: { type: ["integer", "null"], minimum: 0, maximum: 4 },
        wound: { type: ["string", "null"], enum: ["no_wound", "healing_well", "redness", "swelling", "discharge", "bleeding", "opening", null] },
        temperatureC: { type: ["number", "null"] },
        medsTaken: { type: ["string", "null"], enum: ["all", "some", "none", "not_applicable", null] },
      },
    },
    summary: { type: "string" },
    concerns: { type: "array", items: { type: "string" } },
    evidence: {
      type: "object",
      additionalProperties: false,
      required: [...evidenceKeys],
      properties: Object.fromEntries(evidenceKeys.map((k) => [k, { type: ["string", "null"] }])),
    },
    language: { type: "string" },
  },
} as const;

const responseSchema = z.object({
  fields: checkinFieldsSchema.extend({ temperatureC: z.number().nullable() }),
  summary: z.string().max(1200),
  concerns: z.array(z.string().max(200)).max(12),
  evidence: z.record(z.string(), z.string().nullable()),
  language: z.string().max(20),
});

export type StructureOptions = { allowAi: boolean; context?: string };

const CACHE_TTL = 60 * 60;

/**
 * Returns the draft and never throws. Results are cached by text hash so the preview and
 * the final submit share one model call (and the client never supplies the summary).
 */
export async function structureCheckin(freeText: string, opts: StructureOptions): Promise<StructuredDraft> {
  const text = freeText.trim();
  if (!text) return { fields: {}, evidence: {}, summary: "", concerns: [], source: "none" };

  if (!opts.allowAi || !aiEnabled) return structureWithRules(text);

  const key = `praana:ai:structure:${createHash("sha256").update(`${AI_MODEL()}|${opts.context ?? ""}|${text}`).digest("hex")}`;
  const hit = await withRedis(
    (r) => r.get(key),
    () => memory().get(key),
  );
  if (hit) {
    try {
      return JSON.parse(hit) as StructuredDraft;
    } catch {
      /* ignore */
    }
  }

  try {
    const res = await completeJson({
      name: "recovery_checkin",
      schema: jsonSchema as unknown as Record<string, unknown>,
      maxTokens: 1500,
      messages: [
        { role: "system", content: SYSTEM },
        ...(opts.context ? [{ role: "system" as const, content: `Context (do not repeat): ${opts.context}` }] : []),
        { role: "user", content: redactContacts(text).slice(0, 4000) },
      ],
    });

    const parsed = responseSchema.parse(JSON.parse(res.content));

    const fields = Object.fromEntries(Object.entries(parsed.fields).filter(([, v]) => v !== null));
    const evidence = Object.fromEntries(Object.entries(parsed.evidence).filter(([k, v]) => v && k in fields));
    const draft: StructuredDraft = {
      fields,
      evidence,
      summary: plainProse(parsed.summary.trim()),
      concerns: parsed.concerns.map(plainProse),
      source: "ai",
      model: res.model,
      language: parsed.language,
    };

    const payload = JSON.stringify(draft);
    await withRedis(
      async (r) => {
        await r.set(key, payload, "EX", CACHE_TTL);
      },
      () => {
        memory().set(key, payload, CACHE_TTL);
      },
    );
    return draft;
  } catch (err) {
    console.warn("[ai] structure failed, using rules:", (err as Error).message);
    return structureWithRules(text);
  }
}
