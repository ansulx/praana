import { toFile } from "openai";
import { env } from "@/server/env";
import { openai } from "@/server/ai/client";
import { limits } from "@/server/redis/rate-limit";
import { enforceRateLimit, handleError, HttpError, json, requirePatientActor } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Server-side speech-to-text for browsers without the Web Speech API (e.g. Firefox, some
 * Android webviews). Only used with the patient's AI consent; audio is not stored.
 */
export async function POST(req: Request) {
  try {
    const { user, ctx } = await requirePatientActor();
    const client = openai();
    if (!client || !ctx.patient.consentAi) throw new HttpError(503, "Voice typing isn't available right now. Please type instead.", "unavailable");
    await enforceRateLimit(`transcribe:${user.id}`, limits.transcribe);

    const form = await req.formData().catch(() => null);
    const audio = form?.get("audio");
    const lang = form?.get("lang") === "hi" ? "hi" : "en";
    if (!(audio instanceof File) || audio.size === 0) throw new HttpError(400, "We didn't catch any audio. Please try again.", "no_audio");
    if (audio.size > MAX_BYTES) throw new HttpError(413, "That recording is too long. Please keep it under 2 minutes.", "too_large");

    const file = await toFile(Buffer.from(await audio.arrayBuffer()), `checkin.${audio.type.includes("mp4") ? "mp4" : "webm"}`, { type: audio.type || "audio/webm" });
    const res = await client.audio.transcriptions.create({ file, model: env.OPENAI_TRANSCRIBE_MODEL, language: lang });
    return json({ text: res.text?.trim() ?? "" });
  } catch (err) {
    return handleError(err);
  }
}
