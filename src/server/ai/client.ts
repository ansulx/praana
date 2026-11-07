import "server-only";
import OpenAI from "openai";
import { SarvamAIClient, type SarvamAI } from "sarvamai";

type SarvamModel = SarvamAI.SarvamModelIds;
import { env, openaiEnabled, sarvamEnabled } from "@/server/env";

const g = globalThis as unknown as { __praanaOpenAI?: OpenAI | null; __praanaSarvam?: SarvamAIClient };

/** Shared OpenAI client, or null when no API key is configured. */
export function openai(): OpenAI | null {
  if (!openaiEnabled) return null;
  if (g.__praanaOpenAI === undefined) {
    g.__praanaOpenAI = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      timeout: env.OPENAI_TIMEOUT_MS,
      maxRetries: 1,
    });
  }
  return g.__praanaOpenAI;
}

/** Reasoning models take reasoning_effort; keep it low — these are short, latency-sensitive tasks. */
export function modelParams(model = env.OPENAI_MODEL) {
  const reasoning = /^(gpt-5|o\d)/.test(model);
  return reasoning ? { model, reasoning_effort: "low" as const } : { model, temperature: 0.2 };
}

/** Shared Sarvam client, or null when no API key is configured. */
export function sarvam(): SarvamAIClient | null {
  if (!sarvamEnabled) return null;
  g.__praanaSarvam ??= new SarvamAIClient({ apiSubscriptionKey: env.SARVAM_API_KEY! });
  return g.__praanaSarvam;
}

/** Name of the model that answers first; part of cache keys so switching models never serves stale drafts. */
export const AI_MODEL = () => (sarvamEnabled ? env.SARVAM_MODEL : env.OPENAI_MODEL);

export type JsonCompletion = { content: string; model: string; provider: "sarvam" | "openai" };

/**
 * One strict-JSON-schema completion. Tries Sarvam first, then OpenAI; throws only when every
 * configured provider fails (callers then fall back to the deterministic rule engine).
 * Callers must still validate the content — neither provider's schema enforcement is trusted.
 */
export async function completeJson(opts: {
  name: string;
  schema: Record<string, unknown>;
  messages: { role: "system" | "user"; content: string }[];
  maxTokens: number;
}): Promise<JsonCompletion> {
  const errors: string[] = [];

  const sv = sarvam();
  if (sv) {
    try {
      const res = await sv.chat.completions(
        {
          model: env.SARVAM_MODEL as SarvamModel,
          temperature: 0.2,
          max_tokens: opts.maxTokens,
          response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: opts.schema } },
          messages: opts.messages,
        },
        { timeoutInSeconds: Math.ceil(env.SARVAM_TIMEOUT_MS / 1000), maxRetries: 1 },
      );
      const content = res.choices?.[0]?.message?.content;
      if (!content) throw new Error("empty response");
      return { content, model: res.model ?? env.SARVAM_MODEL, provider: "sarvam" };
    } catch (err) {
      errors.push(`sarvam: ${(err as Error).message}`);
    }
  }

  const oa = openai();
  if (oa) {
    try {
      const res = await oa.chat.completions.create({
        ...modelParams(),
        max_completion_tokens: opts.maxTokens,
        response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: opts.schema } },
        messages: opts.messages,
      });
      const content = res.choices[0]?.message?.content;
      if (!content) throw new Error(res.choices[0]?.message?.refusal ?? "empty response");
      return { content, model: res.model ?? env.OPENAI_MODEL, provider: "openai" };
    } catch (err) {
      errors.push(`openai: ${(err as Error).message}`);
    }
  }

  throw new Error(errors.join(" | ") || "no AI provider configured");
}

/** Strips anything that looks like a phone number / email before text leaves the server. */
export function redactContacts(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/(?:\+?\d[\d\s-]{8,}\d)/g, "[phone]");
}

/** Model output reads as plain prose: dashes used as asides become commas. */
export function plainProse(text: string): string {
  return text.replace(/\s*—\s*|\s+–\s+/g, ", ").replace(/\s+--\s+/g, ", ").replace(/,\s*,/g, ",");
}
