import { z } from "zod";

export const WOUND_VALUES = ["no_wound", "healing_well", "redness", "swelling", "discharge", "bleeding", "opening"] as const;
export const MEDS_VALUES = ["all", "some", "none", "not_applicable"] as const;
export const INPUT_MODES = ["text", "voice", "form"] as const;

const scale = (max: number) => z.number().int().min(0).max(max).nullable();

export const checkinFieldsSchema = z.object({
  pain: scale(10),
  appetite: scale(4),
  nausea: scale(4),
  mobility: scale(4),
  sleep: scale(4),
  mood: scale(4),
  anxiety: scale(4),
  wound: z.enum(WOUND_VALUES).nullable(),
  /** Accepts °C or °F; the safety engine normalises and sanity-checks. */
  temperatureC: z.number().min(20).max(120).nullable(),
  medsTaken: z.enum(MEDS_VALUES).nullable(),
});

export type CheckinFields = z.infer<typeof checkinFieldsSchema>;
export type FieldKey = keyof CheckinFields;

export const EMPTY_FIELDS: CheckinFields = {
  pain: null,
  appetite: null,
  nausea: null,
  mobility: null,
  sleep: null,
  mood: null,
  anxiety: null,
  wound: null,
  temperatureC: null,
  medsTaken: null,
};

export const freeTextSchema = z
  .string()
  .max(4000, "Please keep it under 4000 characters. You can send another check-in after.")
  .transform((s) => s.replace(/\u0000/g, "").trim());

export const previewSchema = z.object({
  freeText: freeTextSchema,
  fields: checkinFieldsSchema,
});

export const submitSchema = z.object({
  freeText: freeTextSchema,
  fields: checkinFieldsSchema,
  inputMode: z.enum(INPUT_MODES),
  idempotencyKey: z.string().uuid(),
  photoIds: z.array(z.string().uuid()).max(4).default([]),
  /** Fields the patient confirmed after an AI/rule pre-fill (for the audit trail). */
  prefilled: z.array(z.string()).max(12).default([]),
});

export type SubmitInput = z.infer<typeof submitSchema>;

/** What the structurer (AI or rule-based) read from the patient's own words. */
export type StructuredDraft = {
  fields: Partial<CheckinFields>;
  evidence: Partial<Record<FieldKey, string>>;
  summary: string;
  concerns: string[];
  source: "ai" | "fallback" | "none";
  model?: string;
  language?: string;
};

export function hasAnyContent(freeText: string, fields: CheckinFields, photoCount = 0): boolean {
  return freeText.trim().length > 0 || photoCount > 0 || Object.values(fields).some((v) => v !== null);
}
