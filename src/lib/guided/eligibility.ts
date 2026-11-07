import type { SurgeryType } from "@/server/db/schema";
import { GUIDED_SESSIONS, type Bi, type GuidedSession } from "@/content/guided";

/**
 * Decides which guided sessions a person can do today, and why not if they can't.
 * Pure and client-safe. Safety first: when the latest check-in raised a concern,
 * movement waits for a human; breathing and meditation stay open.
 */

export type EligibilityContext = {
  dayOffset: number | null;
  surgeryType: SurgeryType;
  hasDrain: boolean;
  latest: {
    pain: number | null;
    anxiety: number | null;
    sleep: number | null;
    mood: number | null;
    temperatureC: number | null;
    wound: string | null;
    createdAt: Date;
  } | null;
  hasOpenUrgent: boolean;
  role: "patient" | "caregiver";
};

export type Eligibility = { status: "recommended" | "available" | "locked" | "hidden"; reason?: Bi };

const b = (en: string, hi: string): Bi => ({ en, hi });
const WOUND_CONCERNS = new Set(["discharge", "bleeding", "opening"]);
const DAY_MS = 86_400_000;

function isRecent(latest: EligibilityContext["latest"], now: number): boolean {
  return !!latest && now - new Date(latest.createdAt).getTime() <= DAY_MS;
}

export function evaluateSession(s: GuidedSession, ctx: EligibilityContext, now: number = Date.now()): Eligibility {
  // Who and what it's for
  if (s.audience === "caregiver" && ctx.role !== "caregiver") return { status: "hidden" };
  if (s.surgeryTypes && !s.surgeryTypes.includes(ctx.surgeryType)) return { status: "hidden" };
  if (s.excludeSurgeryTypes?.includes(ctx.surgeryType)) return { status: "hidden" };

  const { fromDay, toDay } = s.window;
  const day = ctx.dayOffset;
  if (toDay !== undefined && day !== null && day > toDay) return { status: "hidden" };

  // Safety gates (movement only)
  const recent = isRecent(ctx.latest, now);
  if (s.movement) {
    if (ctx.hasOpenUrgent) {
      return {
        status: "locked",
        reason: b(
          "Your care team needs to review your latest check-in first. Breathing and meditation are still open.",
          "पहले आपकी केयर टीम को आपका पिछला हाल देखना है। सांस और ध्यान के अभ्यास खुले हैं।",
        ),
      };
    }
    if (recent && ctx.latest) {
      if (ctx.latest.temperatureC !== null && ctx.latest.temperatureC >= 38) {
        return { status: "locked", reason: b("You reported a temperature of 38°C or more. Rest, and let your team guide you before exercising.", "आपने 38°C या ज़्यादा तापमान बताया है। आराम करें, और कसरत से पहले टीम की सलाह लें।") };
      }
      if (ctx.latest.wound && WOUND_CONCERNS.has(ctx.latest.wound)) {
        return { status: "locked", reason: b("You reported a change at your wound. Let your team check it before exercising.", "आपने घाव में बदलाव बताया है। कसरत से पहले टीम को जांचने दें।") };
      }
    }
  }

  if (s.maxPain !== undefined && recent && ctx.latest?.pain !== null && ctx.latest?.pain !== undefined && ctx.latest.pain > s.maxPain) {
    const p = ctx.latest.pain;
    return {
      status: "locked",
      reason: b(
        `Today's pain is ${p}/10, a gentle breathing session may be better. Let your team know if the pain isn't easing.`,
        `आज दर्द ${p}/10 है, हल्का सांस का अभ्यास बेहतर रहेगा। दर्द कम न हो तो टीम को बताएं।`,
      ),
    };
  }

  // Timing
  if (fromDay !== undefined && fromDay > 0 && day === null) {
    return { status: "locked", reason: b("Add your surgery date in your profile to unlock this.", "इसे खोलने के लिए प्रोफ़ाइल में सर्जरी की तारीख़ जोड़ें।") };
  }
  if (fromDay !== undefined && day !== null && day < fromDay) {
    if (day < 0 && fromDay >= 0) {
      return { status: "locked", reason: b("This is for after your surgery.", "यह सर्जरी के बाद के लिए है।") };
    }
    return { status: "locked", reason: b(`Opens on day ${fromDay} after surgery.`, `सर्जरी के बाद दिन ${fromDay} से खुलेगा।`) };
  }

  if (s.requiresNoDrain && ctx.hasDrain) {
    return { status: "locked", reason: b("Opens after your drain is removed and your physio agrees.", "ड्रेन निकलने और फ़िज़ियो की सहमति के बाद खुलेगा।") };
  }

  return { status: "available" };
}

type Scored = { session: GuidedSession; score: number; reason: Bi };

export function recommendSessions(ctx: EligibilityContext, n = 3, now: number = Date.now()): { session: GuidedSession; reason: Bi }[] {
  const day = ctx.dayOffset;
  const recent = isRecent(ctx.latest, now) ? ctx.latest : null;
  const preOp = day !== null && day < 0;
  const earlyPostOp = day !== null && day >= 0 && day <= 14;

  const scored: Scored[] = [];
  for (const s of GUIDED_SESSIONS) {
    if (evaluateSession(s, ctx, now).status !== "available") continue;
    let score = 0;
    let reason = b("Good for today", "आज के लिए अच्छा");
    let best = 0;
    const bump = (n: number, r: Bi) => {
      if (n > best) {
        best = n;
        reason = r;
      }
      score += n;
    };

    if (ctx.role === "caregiver" && s.audience === "caregiver") bump(6, b("A pause for you", "आपके लिए एक ठहराव"));
    if (recent?.anxiety !== null && recent?.anxiety !== undefined && recent.anxiety >= 2 && (s.slug === "calm-breath" || s.category === "meditation")) {
      bump(s.slug === "calm-breath" ? 6 : 4, b("You mentioned feeling worried", "आपने चिंता का ज़िक्र किया"));
    }
    if (recent?.mood !== null && recent?.mood !== undefined && recent.mood >= 2 && s.slug === "body-scan-healing") bump(3, b("For a low day", "उदास दिन के लिए"));
    if (recent?.sleep !== null && recent?.sleep !== undefined && recent.sleep >= 2 && s.slug === "sleep-wind-down") bump(6, b("You've had trouble sleeping", "आपको नींद में परेशानी रही है"));
    if (recent?.pain !== null && recent?.pain !== undefined && recent.pain >= 5 && s.category === "breathing") bump(3, b("Gentle on a painful day", "दर्द वाले दिन के लिए हल्का"));

    if (earlyPostOp) {
      if (s.slug === "deep-breathing-cough") bump(5, b("Lung care in the first weeks", "पहले हफ़्तों में फेफड़ों की देखभाल"));
      if (s.slug === "ankle-pumps") bump(4, b("Keeps circulation moving", "रक्त संचार बनाए रखता है"));
      if (s.slug === "bed-to-chair" && day !== null && day <= 7) bump(3, b("Getting up safely", "सुरक्षित उठना"));
      if (s.slug === "walking-plan") bump(2, b("Building up your walks", "सैर बढ़ाना"));
    }
    if (ctx.surgeryType === "breast" && s.slug.startsWith("breast-arm")) bump(5, b("Exercises for your shoulder", "आपके कंधे के लिए कसरत"));
    if (preOp) {
      if (s.slug === "prehab-walk") bump(5, b("Building stamina before surgery", "सर्जरी से पहले ताक़त बढ़ाना"));
      if (s.slug === "pre-surgery-calm") bump(day !== null && day >= -3 ? 6 : 3, b("For the days before surgery", "सर्जरी से पहले के दिनों के लिए"));
    }
    if (day !== null && day > 14 && s.slug === "walking-plan") bump(3, b("Keep building strength", "ताक़त बढ़ाते रहें"));
    if (s.slug === "diaphragmatic-breathing") bump(1, b("A calm start", "शांत शुरुआत"));

    scored.push({ session: s, score, reason });
  }

  return scored
    .sort((a, b2) => b2.score - a.score || a.session.minutes - b2.session.minutes)
    .slice(0, n)
    .map(({ session, reason }) => ({ session, reason }));
}

/** Evaluates the whole library, marking the recommended ones. */
export function evaluateAll(ctx: EligibilityContext, now: number = Date.now()) {
  const rec = new Set(recommendSessions(ctx, 3, now).map((r) => r.session.slug));
  return GUIDED_SESSIONS.map((s) => {
    const e = evaluateSession(s, ctx, now);
    return { session: s, eligibility: e.status === "available" && rec.has(s.slug) ? { ...e, status: "recommended" as const } : e };
  });
}
