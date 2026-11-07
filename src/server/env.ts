import "server-only";
import { z } from "zod";

/**
 * Every runtime setting is read here once and validated.
 * Optional services (Redis, OpenAI, a real Postgres server) degrade gracefully when absent,
 * so the app keeps working for patients even when an integration is down or not yet configured.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** postgres://… — when empty, an embedded Postgres (PGlite) under ./.data is used. */
  DATABASE_URL: z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
  PGLITE_DIR: z.string().default("./.data/pglite"),

  /** redis://… — when empty or unreachable, an in-process fallback is used. */
  REDIS_URL: z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined)),

  /** OpenAI API key (platform.openai.com). Not the same thing as a ChatGPT subscription. */
  OPENAI_API_KEY: z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_TRANSCRIBE_MODEL: z.string().default("gpt-4o-mini-transcribe"),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),

  /** Sarvam AI key (dashboard.sarvam.ai). Preferred for text → structure/summary: Indic-language and Hinglish native. */
  SARVAM_API_KEY: z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
  SARVAM_MODEL: z.string().default("sarvam-105b-conversations"),
  SARVAM_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),

  /** Clinicians must enter this to register, so patients can't self-assign the clinician role. */
  CLINIC_INVITE_CODE: z.string().default("PRAANA-CARE-2026"),

  /** Regional emergency numbers shown on urgent screens. Defaults are for India. */
  EMERGENCY_NUMBER: z.string().default("112"),
  MENTAL_HEALTH_HELPLINE: z.string().default("14416"),
  MENTAL_HEALTH_HELPLINE_NAME: z.string().default("Tele-MANAS"),

  APP_URL: z.string().default("http://localhost:3000"),

  /**
   * Google OAuth (Sign in with Google) — free for normal consumer login.
   * Create a Web client at https://console.cloud.google.com/apis/credentials
   * Redirect URI: {APP_URL}/api/auth/callback/google
   */
  GOOGLE_CLIENT_ID: z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
  GOOGLE_CLIENT_SECRET: z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined)),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const openaiEnabled = Boolean(env.OPENAI_API_KEY);
export const sarvamEnabled = Boolean(env.SARVAM_API_KEY);
/** Any text-model provider is configured (companion prefers Sarvam, then OpenAI). Server voice still needs OpenAI. */
export const aiEnabled = openaiEnabled || sarvamEnabled;
/** Google Sign-In is available when both OAuth client credentials are set. */
export const googleAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Public origin used for OAuth redirect_uri (must match Google Console exactly). */
export function publicAppUrl(): string {
  const configured = env.APP_URL?.replace(/\/$/, "");
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured;
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return configured || "http://localhost:3000";
}
