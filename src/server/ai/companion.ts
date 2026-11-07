import "server-only";
import { pick, type Locale } from "@/lib/i18n";
import { searchArticles } from "@/content/learn";
import { formatDayLabel } from "@/lib/dates";
import { surgeryLabel, careRoleLabel } from "@/lib/labels";
import type { CareTeamMember, Checkin, Patient } from "@/server/db/schema";

/**
 * The companion answers general recovery questions in plain language, grounded in the
 * curated library and the patient's own recent check-ins. It never diagnoses, never
 * changes medicines, and always routes clinical decisions to the human team.
 */

export const COMPANION_SYSTEM = `You are PRAANA, a warm recovery companion for an adult recovering from cancer surgery in India, and for their family.

How you speak:
- Write like a kind person, not a template. Never use em dashes or en dashes or double hyphens; use full stops or commas instead.
- Reply in the same language and script the user writes in (English, Hindi in Devanagari, or Hinglish).
- Short, calm, kind. 2–6 sentences, or a few short bullet points. No medical jargon. Address the person directly.

What you may do:
- Explain general, widely accepted recovery information (rest, gentle movement, breathing, nutrition, hydration, sleep, emotional ups and downs, wound/drain care basics as described in the provided library).
- Reflect what the patient has already reported in their check-ins when relevant.
- Suggest they log a check-in, try a guided session in PRAANA, or send the question to their care team.

What you must NEVER do:
- Diagnose, say what a symptom "is", or say something is "normal/nothing to worry about" for their specific case.
- Recommend starting, stopping, or changing any medicine or dose, or give drug doses.
- Contradict their surgeon's or team's instructions, their team's instructions always win.
- Claim to be a doctor, nurse, or emergency service.

When a question needs clinical judgement (anything about their specific wound, test results, medicines, new or worsening symptoms), say kindly that their care team should decide, and offer to send it to them.
If they describe warning signs (heavy bleeding, trouble breathing, chest pain, fever ≥38°C, fainting, a hot red spreading wound, thoughts of self-harm), tell them to contact their care team now or call emergency services (112 in India). For self-harm, also give the free 24×7 Tele-MANAS helpline 14416.

End every answer that touches on their health with one short line reminding them their care team makes the decisions, but don't repeat it if the conversation is casual.`;

export function companionContext(opts: {
  patient: Patient;
  patientName: string;
  viewerRelation: "self" | "caregiver";
  dayOffset: number | null;
  latest: Checkin | null;
  team: CareTeamMember[];
  question: string;
  locale: Locale;
}): { context: string; sources: { slug: string; title: string }[] } {
  const p = opts.patient;
  const articles = searchArticles(opts.question, 3);
  const lines = [
    `Speaking with: ${opts.viewerRelation === "self" ? `the patient (${opts.patientName.split(" ")[0]})` : `a family caregiver of ${opts.patientName.split(" ")[0]}`}.`,
    `Surgery: ${p.surgeryName ?? surgeryLabel(p.surgeryType)}. ${formatDayLabel(opts.dayOffset)}.`,
    p.hasDrain ? "Has a surgical drain at home." : "",
    opts.latest
      ? `Latest check-in (${opts.latest.createdAt.toISOString().slice(0, 10)}): ${opts.latest.structured?.summary || opts.latest.freeText?.slice(0, 300) || "scores only"}${opts.latest.pain !== null ? ` Pain ${opts.latest.pain}/10.` : ""}`
      : "No check-ins yet.",
    opts.team.length ? `Care team: ${opts.team.slice(0, 5).map((m) => `${m.name} (${careRoleLabel(m.role)})`).join(", ")}.` : "",
    articles.length ? "\nRecovery library excerpts (use these; do not invent beyond them):" : "",
    ...articles.map((a) => `### ${pick(a.title, "en")}\n${pick(a.summary, "en")}\n${a.sections.map((s) => `${s.heading}: ${s.body}`).join("\n").slice(0, 1400)}`),
  ];
  return { context: lines.filter(Boolean).join("\n"), sources: articles.map((a) => ({ slug: a.slug, title: pick(a.title, opts.locale) })) };
}

/** Questions that need a human clinician, not a model or library guess. */
export function needsClinicalJudgement(question: string): boolean {
  return /\b(diagnos\w*|infect(ion|ed)?|malignant|benign|means i have|do i have|is (this|it) (an? )?(infection|cancer|normal)|normal for me|should i (start|stop|change)|antibiotic|biopsy result|pathology (report|result)|scan (result|means)|report mean|what does .+ mean|redness near|wound .+ (mean|infection))\b/i.test(
    question,
  );
}

/** Explicit refusal used for clinical questions (library + AI path). */
export function clinicalRefusal(locale: Locale): { text: string; sources: { slug: string; title: string }[] } {
  const hi = locale === "hi";
  return {
    text: hi
      ? "मैं यह नहीं बता सकती कि यह संक्रमण है या नहीं, और कोई निदान नहीं कर सकती। यह फ़ैसला केवल आपकी केयर टीम कर सकती है।\n\nकृपया नीचे “टीम को भेजें” दबाएं। अगर घाव गर्म है, लालिमा फैल रही है, बुखार है, या तबीयत बिगड़ रही है, तो उन्हें अभी कॉल करें।"
      : "I can't tell you whether this is an infection, and I can't diagnose. Only your care team can decide that for your situation.\n\nPlease tap “Send to my care team” below. If the wound is hot, redness is spreading, you have a fever, or you feel worse, call them now.",
    sources: [],
  };
}

/** No-AI fallback: answer from the library, or offer to send to the team. */
export function libraryAnswer(question: string, locale: Locale): { text: string; sources: { slug: string; title: string }[] } {
  const hi = locale === "hi";
  if (needsClinicalJudgement(question)) {
    return clinicalRefusal(locale);
  }
  const hits = searchArticles(question, 2);
  if (!hits.length) {
    return {
      text: hi
        ? "इस सवाल का सही जवाब आपकी केयर टीम दे पाएगी। नीचे “टीम को भेजें” दबाकर इसे उन्हें भेज सकते हैं। अगर तबीयत बिगड़ रही है, तो उन्हें अभी कॉल करें।"
        : "That's a question your care team is best placed to answer. You can tap “Send to my care team” below and a person will reply. If you're feeling worse, please call them now.",
      sources: [],
    };
  }
  const top = hits[0];
  const intro = hi ? "हमारी रिकवरी जानकारी में यह मिला:" : "Here's what our recovery library says:";
  const outro = hi
    ? "आपकी अपनी स्थिति के लिए आपकी केयर टीम ही फ़ैसला करती है, चाहें तो यह सवाल उन्हें भेज दें।"
    : "Your care team makes the decisions for your own situation. You can send them this question too.";
  return {
    text: `${intro}\n\n**${pick(top.title, locale)}**, ${pick(top.summary, locale)}\n\n${outro}`,
    sources: hits.map((a) => ({ slug: a.slug, title: pick(a.title, locale) })),
  };
}
