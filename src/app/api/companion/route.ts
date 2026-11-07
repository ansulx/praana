import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { companionMessages } from "@/server/db/schema";
import { scanText } from "@/lib/safety/red-flags";
import { dayOffset } from "@/lib/dates";
import { openai, sarvam, modelParams, redactContacts } from "@/server/ai/client";
import { COMPANION_SYSTEM, clinicalRefusal, companionContext, libraryAnswer, needsClinicalJudgement } from "@/server/ai/companion";
import { env, openaiEnabled, sarvamEnabled } from "@/server/env";
import { limits } from "@/server/redis/rate-limit";
import { audit } from "@/server/audit";
import { notifyAlert, raiseAlert } from "@/server/services/alerts";
import { getCareTeam, getLatestCheckin } from "@/server/services/patient";
import { getHelpContacts } from "@/server/services/help-contacts";
import { enforceRateLimit, handleError, readJson, requirePatientActor } from "@/server/http";
import type { SarvamAI } from "sarvamai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ message: z.string().trim().min(1, "Please type a message.").max(2000, "Please keep messages under 2000 characters.") });

export async function POST(req: Request) {
  try {
    const { user, ctx, ip } = await requirePatientActor();
    await enforceRateLimit(`companion:${user.id}`, limits.companion, "Let's take a short pause. You can ask again in a few minutes. For anything urgent, call your care team.");
    const { message } = bodySchema.parse(await readJson(req, 16_000));
    const locale = user.locale;
    const patientId = ctx.patient.id;

    // 1) Safety first — deterministic, before any model sees the message.
    const flags = scanText(message);
    const urgent = flags.filter((f) => f.level === "urgent");
    const flaggedLevel = urgent.length ? "urgent" : flags.some((f) => f.level === "review") ? "review" : "none";
    await db.insert(companionMessages).values({ patientId, userId: user.id, role: "user", content: message, flagged: flaggedLevel });

    if (urgent.length) {
      const contacts = await getHelpContacts(patientId);
      const mental = urgent.some((f) => f.action === "mental_health");
      const emergency = urgent.some((f) => f.action !== "mental_health");
      const hi = locale === "hi";
      const parts: string[] = [];
      if (emergency) {
        parts.push(
          hi
            ? `आपने जो बताया उसे जल्दी किसी व्यक्ति को देखना चाहिए। कृपया अभी अपनी केयर टीम को कॉल करें${contacts.primary ? ` (${contacts.primary.name}: ${contacts.primary.phone})` : ""}। अगर बात न हो पाए या तबीयत बहुत ख़राब लगे, तो ${contacts.emergency} पर कॉल करें या नज़दीकी इमरजेंसी जाएं।`
            : `What you've described needs a person to look at it quickly. Please call your care team now${contacts.primary ? ` (${contacts.primary.name}: ${contacts.primary.phone})` : ""}. If you can't reach them, or you feel very unwell, call ${contacts.emergency} or go to the nearest emergency department.`,
        );
      }
      if (mental) {
        parts.push(
          hi
            ? `आप जो महसूस कर रहे हैं वह मायने रखता है, और आपको यह अकेले नहीं सहना है। कृपया अभी किसी से बात करें, ${contacts.helplineName} ${contacts.helpline} (मुफ़्त, 24×7)। किसी भरोसेमंद व्यक्ति को भी अपने पास बुला लें।`
            : `What you're feeling matters, and you don't have to carry it alone. Please talk to someone right now, ${contacts.helplineName} on ${contacts.helpline} is free and open 24×7. If you can, ask someone you trust to be with you.`,
        );
      }
      parts.push(hi ? "मैंने आपकी केयर टीम को भी सूचित कर दिया है।" : "I've also let your care team know.");
      const text = parts.join("\n\n");

      const alert = await db.transaction((tx) => raiseAlert(tx, { patientId, level: "urgent", reasons: urgent, source: "companion" }));
      await db.insert(companionMessages).values({ patientId, userId: user.id, role: "assistant", content: text, flagged: "urgent", source: "safety" });
      await Promise.allSettled([
        notifyAlert(patientId, alert.id, "urgent"),
        audit({ actorId: user.id, patientId, action: "companion.safety_escalation", ip, meta: { codes: urgent.map((f) => f.code) } }),
      ]);
      return Response.json({ mode: "safety", text, actions: [...new Set(urgent.map((f) => f.action).filter(Boolean))] });
    }

    // 2) Clinical judgement questions — refuse before any model (panel-critical).
    if (needsClinicalJudgement(message)) {
      const ans = clinicalRefusal(locale);
      await db.insert(companionMessages).values({ patientId, userId: user.id, role: "assistant", content: ans.text, source: "safety" });
      return Response.json({ mode: "clinical_refusal", text: ans.text, sources: ans.sources });
    }

    // 3) No AI (no key, or patient declined) → curated library answer.
    const canAi = ctx.patient.consentAi && (sarvamEnabled || openaiEnabled);
    if (!canAi) {
      const ans = libraryAnswer(message, locale);
      await db.insert(companionMessages).values({ patientId, userId: user.id, role: "assistant", content: ans.text, source: "library" });
      return Response.json({ mode: "library", text: ans.text, sources: ans.sources });
    }

    // 3) AI, streamed. Prefer Sarvam (prod key), then OpenAI. Grounded in library + check-ins.
    const [latest, team, history] = await Promise.all([
      getLatestCheckin(patientId),
      getCareTeam(patientId),
      db
        .select({ role: companionMessages.role, content: companionMessages.content })
        .from(companionMessages)
        .where(and(eq(companionMessages.patientId, patientId), eq(companionMessages.userId, user.id)))
        .orderBy(desc(companionMessages.createdAt))
        .limit(13),
    ]);
    const { context, sources } = companionContext({
      patient: ctx.patient,
      patientName: ctx.patientName,
      viewerRelation: ctx.viewerRelation === "caregiver" ? "caregiver" : "self",
      dayOffset: dayOffset(ctx.patient.surgeryDate),
      latest,
      team,
      question: message,
      locale,
    });
    // history[0] is the message we just saved; send prior turns oldest-first.
    const prior = history.slice(1).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: redactContacts(m.content).slice(0, 2000) }));
    const messages = [
      { role: "system" as const, content: COMPANION_SYSTEM },
      { role: "system" as const, content: `Context:\n${context}` },
      ...prior,
      { role: "user" as const, content: redactContacts(message) },
    ];

    type ChunkStream = AsyncIterable<{ choices?: { delta?: { content?: string | null } }[] }>;
    let stream: ChunkStream | null = null;
    let provider: "sarvam" | "openai" = "openai";

    try {
      const sv = sarvam();
      if (sv) {
        stream = await sv.chat.completions(
          {
            model: env.SARVAM_MODEL as SarvamAI.SarvamModelIds,
            temperature: 0.3,
            max_tokens: 900,
            stream: true,
            messages,
          },
          { timeoutInSeconds: Math.ceil(env.SARVAM_TIMEOUT_MS / 1000), maxRetries: 1 },
        );
        provider = "sarvam";
      }
    } catch (err) {
      console.warn("[companion] Sarvam unavailable:", (err as Error).message);
      stream = null;
    }

    if (!stream) {
      try {
        const oa = openai();
        if (oa) {
          stream = await oa.chat.completions.create({
            ...modelParams(),
            stream: true,
            max_completion_tokens: 900,
            messages,
          });
          provider = "openai";
        }
      } catch (err) {
        console.warn("[companion] OpenAI unavailable:", (err as Error).message);
        stream = null;
      }
    }

    if (!stream) {
      const ans = libraryAnswer(message, locale);
      await db.insert(companionMessages).values({ patientId, userId: user.id, role: "assistant", content: ans.text, source: "library" });
      return Response.json({ mode: "library", text: ans.text, sources: ans.sources });
    }

    const encoder = new TextEncoder();
    let full = "";
    const active = stream;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of active) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              controller.enqueue(encoder.encode(delta));
            }
          }
        } catch (err) {
          const msg = locale === "hi" ? "\n\n(जवाब बीच में रुक गया। कृपया फिर से पूछें।)" : "\n\n(The answer was cut off. Please ask again.)";
          full += msg;
          controller.enqueue(encoder.encode(msg));
          console.warn("[companion] stream error", (err as Error).message);
        } finally {
          controller.close();
          if (full.trim()) {
            await db
              .insert(companionMessages)
              .values({ patientId, userId: user.id, role: "assistant", content: full.slice(0, 8000), source: "ai", flagged: flaggedLevel })
              .catch(() => undefined);
          }
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Praana-Sources": encodeURIComponent(JSON.stringify(sources)),
        "X-Praana-Flag": flaggedLevel,
        "X-Praana-Provider": provider,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
