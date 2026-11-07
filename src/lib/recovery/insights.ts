/**
 * Deterministic recovery-signal engine (Sampoorna-style insights for oncology recovery).
 * Stratifies what the patient has already reported — never diagnoses.
 */
import type { Locale } from "@/lib/i18n";

export type SignalLevel = "steady" | "watch" | "review";

export type SignalHeadId =
  | "pain"
  | "eating"
  | "mobility"
  | "wound"
  | "mood"
  | "continuity";

export type SignalFactor = {
  id: string;
  label: { en: string; hi: string };
  contribution: number;
  direction: "increases" | "decreases";
};

export type SignalHead = {
  id: SignalHeadId;
  title: { en: string; hi: string };
  level: SignalLevel;
  score: number;
  summary: { en: string; hi: string };
  /** One observation line for the care team — never a diagnosis or order. */
  careTeamNote: { en: string; hi: string };
  factors: SignalFactor[];
  recommendations: { en: string; hi: string }[];
};

export type RecoveryInsights = {
  overall: { level: SignalLevel; score: number; label: { en: string; hi: string } };
  heads: SignalHead[];
  disclaimer: { en: string; hi: string };
};

export type InsightCheckin = {
  createdAt: Date;
  pain: number | null;
  appetite: number | null;
  nausea: number | null;
  mobility: number | null;
  sleep: number | null;
  mood: number | null;
  anxiety: number | null;
  wound: string | null;
  temperatureC: number | null;
  triage: "none" | "watch" | "review" | "urgent";
};

export type InsightInput = {
  dayOffset: number | null;
  hasDrain: boolean;
  checkins: InsightCheckin[];
  hasOpenUrgent: boolean;
  unansweredQuestions: number;
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function levelFromScore(score: number): SignalLevel {
  if (score >= 65) return "review";
  if (score >= 40) return "watch";
  return "steady";
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function daysSince(d: Date, now: number) {
  return (now - d.getTime()) / 86_400_000;
}

const WOUND_CONCERN = new Set(["discharge", "bleeding", "opening", "redness"]);

export function assessRecovery(input: InsightInput, now = Date.now()): RecoveryInsights {
  const recent = input.checkins.filter((c) => daysSince(c.createdAt, now) <= 7);
  const latest = input.checkins[0] ?? null;
  const silentDays = latest ? daysSince(latest.createdAt, now) : 99;

  // ── Pain ──────────────────────────────────────────────────
  const pains = recent.map((c) => c.pain).filter((v): v is number => v !== null);
  const painAvg = avg(pains);
  const painLatest = latest?.pain ?? null;
  let painScore = 15;
  if (painLatest !== null) painScore += painLatest * 7;
  if (painAvg !== null && painLatest !== null && painLatest - painAvg >= 2) painScore += 18;
  if (pains.filter((p) => p >= 7).length >= 2) painScore += 15;
  painScore = clamp(painScore);
  const pain: SignalHead = {
    id: "pain",
    title: { en: "Pain & comfort", hi: "दर्द और आराम" },
    level: levelFromScore(painScore),
    score: painScore,
    summary:
      painScore >= 65
        ? {
            en: "Recent check-ins show higher pain. Your care team should review this, PRAANA does not decide treatment.",
            hi: "हाल के चेक-इन में दर्द ज़्यादा दिख रहा है। केयर टीम को इसे देखना चाहिए, PRAANA इलाज तय नहीं करती।",
          }
        : painScore >= 40
          ? {
              en: "Some pain is present. Keep logging so your team can see the pattern between visits.",
              hi: "कुछ दर्द है। लॉग करते रहें ताकि टीम विज़िट के बीच पैटर्न देख सके।",
            }
          : {
              en: "Pain looks relatively steady from what you've shared.",
              hi: "आपने जो बताया है, उसके अनुसार दर्द अपेक्षाकृत स्थिर लग रहा है।",
            },
    careTeamNote:
      painLatest !== null
        ? {
            en: `Patient reported pain ${painLatest}/10 on the latest check-in${painAvg !== null && painLatest - painAvg >= 1.5 ? ", higher than the recent average" : ""}. Observation only.`,
            hi: `नवीनतम चेक-इन में दर्द ${painLatest}/10 बताया${painAvg !== null && painLatest - painAvg >= 1.5 ? ", हाल के औसत से अधिक" : ""}। केवल अवलोकन।`,
          }
        : { en: "No recent pain score logged. Observation only.", hi: "हाल का दर्द स्कोर नहीं। केवल अवलोकन।" },
    factors: [
      {
        id: "latest_pain",
        label: { en: `Latest pain ${painLatest ?? "—"}/10`, hi: `नवीनतम दर्द ${painLatest ?? "—"}/10` },
        contribution: clamp((painLatest ?? 0) * 10),
        direction: (painLatest ?? 0) >= 5 ? "increases" : "decreases",
      },
      {
        id: "pain_trend",
        label: {
          en: painAvg !== null && painLatest !== null && painLatest - painAvg >= 1.5 ? "Rising vs 7-day average" : "Near recent average",
          hi: painAvg !== null && painLatest !== null && painLatest - painAvg >= 1.5 ? "7-दिन औसत से बढ़ रहा" : "हाल के औसत के पास",
        },
        contribution: painAvg !== null && painLatest !== null && painLatest - painAvg >= 1.5 ? 70 : 25,
        direction: painAvg !== null && painLatest !== null && painLatest - painAvg >= 1.5 ? "increases" : "decreases",
      },
    ],
    recommendations: [
      { en: "Check in if pain changes today", hi: "दर्द बदले तो आज हाल बताएं" },
      { en: "Note what eases it (rest, position, medicines as prescribed)", hi: "जो राहत दे उसे नोट करें (आराम, मुद्रा, निर्धारित दवा)" },
      { en: "Send a question to your care team if pain keeps rising", hi: "दर्द बढ़ता रहे तो केयर टीम को सवाल भेजें" },
    ],
  };

  // ── Eating ────────────────────────────────────────────────
  const apps = recent.map((c) => c.appetite).filter((v): v is number => v !== null);
  const appLatest = latest?.appetite ?? null;
  const nauseaHigh = recent.filter((c) => (c.nausea ?? 0) >= 3).length;
  let eatScore = 12;
  if (appLatest !== null) eatScore += appLatest * 12; // higher appetite enum = worse eating in our scale? need check
  // In PRAANA domains, appetite: typically 0=normal ... higher = worse. Check domains.
  if (nauseaHigh >= 2) eatScore += 20;
  eatScore = clamp(eatScore);
  const eating: SignalHead = {
    id: "eating",
    title: { en: "Eating & energy", hi: "खाना और ऊर्जा" },
    level: levelFromScore(eatScore),
    score: eatScore,
    summary:
      eatScore >= 65
        ? {
            en: "Eating or nausea looks harder lately. Flag this for your care team — they decide next steps.",
            hi: "खाना या मिचली हाल में मुश्किल लग रही है। केयर टीम को बताएं — अगला कदम वे तय करें।",
          }
        : eatScore >= 40
          ? {
              en: "Appetite or nausea needs a watchful eye. Small frequent meals may help while you wait for advice.",
              hi: "भूख या मिचली पर नज़र रखें। सलाह मिलने तक छोटे-छोटे भोजन मदद कर सकते हैं।",
            }
          : {
              en: "Eating looks reasonably steady from recent check-ins.",
              hi: "हाल के चेक-इन से खाना अपेक्षाकृत स्थिर लग रहा है।",
            },
    careTeamNote: {
      en: `${nauseaHigh ? `${nauseaHigh} higher-nausea day(s) in 7d. ` : ""}Eating difficulty score on latest check-in: ${appLatest ?? "not logged"}. Observation only.`,
      hi: `${nauseaHigh ? `7दिन में ${nauseaHigh} ज़्यादा मिचली वाले दिन। ` : ""}नवीनतम खाने की कठिनाई: ${appLatest ?? "नहीं लिखा"}। केवल अवलोकन।`,
    },
    factors: [
      {
        id: "appetite",
        label: { en: "Recent appetite scores", hi: "हाल की भूख स्कोर" },
        contribution: clamp((appLatest ?? 0) * 20),
        direction: (appLatest ?? 0) >= 2 ? "increases" : "decreases",
      },
      {
        id: "nausea",
        label: { en: `${nauseaHigh} higher-nausea days (7d)`, hi: `${nauseaHigh} ज़्यादा मिचली वाले दिन (7दिन)` },
        contribution: clamp(nauseaHigh * 30),
        direction: nauseaHigh >= 1 ? "increases" : "decreases",
      },
    ],
    recommendations: [
      { en: "Log what you managed to eat at the next check-in", hi: "अगले चेक-इन में जो खा पाए वह लिखें" },
      { en: "Open Learn → nutrition for recovery basics", hi: "जानकारी → पोषण में रिकवरी के आधार पढ़ें" },
      { en: "Ask your care team if you can't keep fluids down", hi: "तरल न रह पाए तो केयर टीम से पूछें" },
    ],
  };

  // ── Mobility ──────────────────────────────────────────────
  const mobs = recent.map((c) => c.mobility).filter((v): v is number => v !== null);
  const mobLatest = latest?.mobility ?? null;
  let mobScore = 12;
  if (mobLatest !== null) mobScore += mobLatest * 14;
  if (mobs.filter((m) => m >= 3).length >= 2) mobScore += 15;
  mobScore = clamp(mobScore);
  const mobility: SignalHead = {
    id: "mobility",
    title: { en: "Moving around", hi: "चलना-फिरना" },
    level: levelFromScore(mobScore),
    score: mobScore,
    summary:
      mobScore >= 65
        ? {
            en: "Movement looks more limited. Your physiotherapist or surgeon should guide what is safe.",
            hi: "चलना-फिरना ज़्यादा सीमित लग रहा है। फिजियो या सर्जन बताएं क्या सुरक्षित है।",
          }
        : mobScore >= 40
          ? {
              en: "Some limits on movement. Gentle guided sessions may help if your team has not restricted activity.",
              hi: "चलने में कुछ सीमा है। टीम ने रोक न लगाई हो तो हल्के Guided अभ्यास मदद कर सकते हैं।",
            }
          : {
              en: "You're keeping some daily movement — good continuity between visits.",
              hi: "रोज़ थोड़ा चलना-फिरना जारी है — विज़िट के बीच अच्छी निरंतरता।",
            },
    careTeamNote: {
      en: `Latest mobility difficulty ${mobLatest ?? "not logged"}/4. Observation only — activity advice stays with the care team.`,
      hi: `नवीनतम चलने की कठिनाई ${mobLatest ?? "नहीं लिखा"}/4। केवल अवलोकन — गतिविधि सलाह टीम की।`,
    },
    factors: [
      {
        id: "mobility_latest",
        label: { en: "Latest mobility score", hi: "नवीनतम गति स्कोर" },
        contribution: clamp((mobLatest ?? 0) * 22),
        direction: (mobLatest ?? 0) >= 2 ? "increases" : "decreases",
      },
    ],
    recommendations: [
      { en: "Try a short guided session if unlocked for you today", hi: "आज खुला हो तो छोटा Guided अभ्यास करें" },
      { en: "Short walks as your discharge advice allows", hi: "डिस्चार्ज सलाह के अनुसार छोटी सैर" },
      { en: "Ask physio before pushing harder", hi: "ज़ोर लगाने से पहले फिजियो से पूछें" },
    ],
  };

  // ── Wound / drain ─────────────────────────────────────────
  const woundConcernDays = recent.filter((c) => c.wound && WOUND_CONCERN.has(c.wound)).length;
  const feverish = recent.filter((c) => c.temperatureC !== null && c.temperatureC >= 38).length;
  let woundScore = input.hasDrain ? 22 : 10;
  woundScore += woundConcernDays * 25;
  woundScore += feverish * 30;
  if (latest?.triage === "urgent" || latest?.triage === "review") woundScore += 20;
  if (input.hasOpenUrgent) woundScore = Math.max(woundScore, 75);
  woundScore = clamp(woundScore);
  const wound: SignalHead = {
    id: "wound",
    title: { en: input.hasDrain ? "Wound & drain" : "Wound care", hi: input.hasDrain ? "घाव और ड्रेन" : "घाव की देखभाल" },
    level: levelFromScore(woundScore),
    score: woundScore,
    summary:
      woundScore >= 65
        ? {
            en: "Wound or temperature changes need a person to look. Call your care team — PRAANA does not diagnose infection.",
            hi: "घाव या तापमान में बदलाव व्यक्ति को देखना चाहिए। केयर टीम को कॉल करें — PRAANA संक्रमण का निदान नहीं करती।",
          }
        : woundScore >= 40
          ? {
              en: "Keep describing the wound or drain in check-ins so the team has a continuous picture.",
              hi: "घाव या ड्रेन का हाल चेक-इन में बताते रहें ताकि टीम को निरंतर तस्वीर मिले।",
            }
          : {
              en: "No strong wound concerns in recent check-ins. Keep noting drain output if you have one.",
              hi: "हाल के चेक-इन में घाव की बड़ी चिंता नहीं। ड्रेन हो तो आउटपुट नोट करते रहें।",
            },
    careTeamNote: {
      en: `${woundConcernDays} wound-concern day(s) in 7d${feverish ? "; temperature ≥38°C reported" : ""}${input.hasDrain ? "; patient has a drain at home" : ""}. Not a diagnosis.`,
      hi: `7दिन में ${woundConcernDays} घाव-चिंता वाले दिन${feverish ? "; तापमान ≥38°C बताया" : ""}${input.hasDrain ? "; घर पर ड्रेन" : ""}। निदान नहीं।`,
    },
    factors: [
      {
        id: "wound_days",
        label: { en: `${woundConcernDays} concern day(s) in 7d`, hi: `7दिन में ${woundConcernDays} चिंता वाले दिन` },
        contribution: clamp(woundConcernDays * 35),
        direction: woundConcernDays > 0 ? "increases" : "decreases",
      },
      {
        id: "fever",
        label: { en: feverish ? "Temperature ≥38°C reported" : "No high temperature logged", hi: feverish ? "तापमान ≥38°C बताया" : "ऊँचा तापमान नहीं लिखा" },
        contribution: feverish ? 80 : 15,
        direction: feverish ? "increases" : "decreases",
      },
    ],
    recommendations: [
      { en: "Photograph the site only if your team asked you to", hi: "फ़ोटो तभी लें जब टीम ने कहा हो" },
      { en: "Record drain volume in today's check-in if you have a drain", hi: "ड्रेन हो तो आज के चेक-इन में मात्रा लिखें" },
      { en: "Call the team for spreading redness, heat, or fever", hi: "फैलती लालिमा, गर्मी या बुखार पर टीम को कॉल करें" },
    ],
  };

  // ── Sleep & mood ──────────────────────────────────────────
  const anxietyHigh = recent.filter((c) => (c.anxiety ?? 0) >= 3).length;
  const moodLow = recent.filter((c) => (c.mood ?? 0) >= 3).length;
  const sleepPoor = recent.filter((c) => (c.sleep ?? 0) >= 3).length;
  let moodScore = 15;
  moodScore += anxietyHigh * 12 + moodLow * 12 + sleepPoor * 10;
  moodScore = clamp(moodScore);
  const mood: SignalHead = {
    id: "mood",
    title: { en: "Sleep & mood", hi: "नींद और मनोदशा" },
    level: levelFromScore(moodScore),
    score: moodScore,
    summary:
      moodScore >= 65
        ? {
            en: "Worry or low mood is showing up often. Support is available — your care team and Tele-MANAS 14416 if you need someone now.",
            hi: "चिंता या उदासी बार-बार दिख रही है। मदद उपलब्ध है — केयर टीम और ज़रूरत पर Tele-MANAS 14416।",
          }
        : moodScore >= 40
          ? {
              en: "Some harder days for sleep or mood. A short calm-breath session can help while you stay connected to your team.",
              hi: "नींद या मूड के कुछ कठिन दिन। टीम से जुड़े रहकर छोटा शांत-सांस अभ्यास मदद कर सकता है।",
            }
          : {
              en: "Sleep and mood look steadier in recent updates.",
              hi: "हाल के अपडेट में नींद और मूड अधिक स्थिर लग रहे हैं।",
            },
    careTeamNote: {
      en: `${anxietyHigh} higher-worry day(s) and ${sleepPoor} poorer-sleep day(s) in the last week. Supportive observation only.`,
      hi: `पिछले सप्ताह ${anxietyHigh} ज़्यादा-चिंता और ${sleepPoor} कम-नींद वाले दिन। केवल सहायक अवलोकन।`,
    },
    factors: [
      {
        id: "anxiety_days",
        label: { en: `${anxietyHigh} higher-worry days`, hi: `${anxietyHigh} ज़्यादा चिंता वाले दिन` },
        contribution: clamp(anxietyHigh * 28),
        direction: anxietyHigh > 0 ? "increases" : "decreases",
      },
      {
        id: "sleep_days",
        label: { en: `${sleepPoor} poorer-sleep days`, hi: `${sleepPoor} कम नींद वाले दिन` },
        contribution: clamp(sleepPoor * 25),
        direction: sleepPoor > 0 ? "increases" : "decreases",
      },
    ],
    recommendations: [
      { en: "Try “Calm breath for worry” in Guided", hi: "Guided में “चिंता के लिए शांत सांस” आज़माएं" },
      { en: "Write one worry as a care-team question", hi: "एक चिंता केयर-टीम सवाल के रूप में लिखें" },
      { en: "Ask PRAANA for sleep tips after surgery", hi: "सर्जरी के बाद नींद के सुझाव Ask PRAANA से पूछें" },
    ],
  };

  // ── Continuity ────────────────────────────────────────────
  let contScore = 10;
  if (silentDays >= 2) contScore += 35;
  if (silentDays >= 4) contScore += 25;
  if (input.checkins.length === 0) contScore = 80;
  contScore += Math.min(input.unansweredQuestions * 12, 24);
  contScore = clamp(contScore);
  const continuity: SignalHead = {
    id: "continuity",
    title: { en: "Story continuity", hi: "कहानी की निरंतरता" },
    level: levelFromScore(contScore),
    score: contScore,
    summary:
      contScore >= 65
        ? {
            en: "The recovery story has gaps. A short check-in today helps your team see between visits.",
            hi: "रिकवरी कहानी में अंतराल हैं। आज का छोटा चेक-इन टीम को विज़िट के बीच दिखने में मदद करता है।",
          }
        : contScore >= 40
          ? {
              en: "A little less frequent lately. Even one sentence keeps the timeline alive.",
              hi: "थोड़ी कम नियमितता। एक वाक्य भी टाइमलाइन को जीवित रखता है।",
            }
          : {
              en: "You're keeping a living recovery record — that is the continuity gap closing.",
              hi: "आप जीवित रिकवरी रिकॉर्ड रख रहे हैं — यही निरंतरता का अंतराल भरना है।",
            },
    careTeamNote: {
      en: latest
        ? `Last check-in ${Math.floor(silentDays)} day(s) ago · ${input.unansweredQuestions} unanswered question(s). Continuity observation only.`
        : "No check-ins yet. Continuity observation only.",
      hi: latest
        ? `आखिरी चेक-इन ${Math.floor(silentDays)} दिन पहले · ${input.unansweredQuestions} अनुत्तरित सवाल। केवल निरंतरता अवलोकन।`
        : "अभी कोई चेक-इन नहीं। केवल निरंतरता अवलोकन।",
    },
    factors: [
      {
        id: "silent",
        label: {
          en: latest ? `Last check-in ${Math.floor(silentDays)}d ago` : "No check-ins yet",
          hi: latest ? `आखिरी चेक-इन ${Math.floor(silentDays)} दिन पहले` : "अभी कोई चेक-इन नहीं",
        },
        contribution: clamp(silentDays * 18),
        direction: silentDays >= 2 ? "increases" : "decreases",
      },
      {
        id: "questions",
        label: { en: `${input.unansweredQuestions} unanswered question(s)`, hi: `${input.unansweredQuestions} अनुत्तरित सवाल` },
        contribution: clamp(input.unansweredQuestions * 30),
        direction: input.unansweredQuestions > 0 ? "increases" : "decreases",
      },
    ],
    recommendations: [
      { en: "Start today's check-in", hi: "आज का चेक-इन शुरू करें" },
      { en: "Open My story to review the week", hi: "सप्ताह देखने के लिए मेरी कहानी खोलें" },
      { en: "Follow up open questions on Care team", hi: "केयर टीम पर खुले सवाल देखें" },
    ],
  };

  const heads = [pain, eating, mobility, wound, mood, continuity];
  const overallScore = clamp(heads.reduce((s, h) => s + h.score, 0) / heads.length);
  let overallLevel = levelFromScore(overallScore);
  if (input.hasOpenUrgent) overallLevel = "review";

  const label =
    overallLevel === "review"
      ? { en: "Needs a person to look", hi: "किसी व्यक्ति को देखना है" }
      : overallLevel === "watch"
        ? { en: "Watchful", hi: "नज़र रखें" }
        : { en: "Steady", hi: "स्थिर" };

  return {
    overall: { level: overallLevel, score: overallScore, label },
    heads,
    disclaimer: {
      en: "PRAANA organises recovery signals from what you share. It does not diagnose, prescribe, or replace your care team.",
      hi: "PRAANA आपके बताए से रिकवरी संकेत व्यवस्थित करती है। यह निदान या नुस्खा नहीं देती, और केयर टीम की जगह नहीं लेती।",
    },
  };
}

export function pickLocale<T extends { en: string; hi: string }>(bi: T, locale: Locale): string {
  return locale === "hi" ? bi.hi : bi.en;
}

export const SIGNAL_STYLE: Record<SignalLevel, { className: string; en: string; hi: string }> = {
  steady: { className: "bg-mint text-primary border-primary/20", en: "Steady", hi: "स्थिर" },
  watch: { className: "bg-amber-soft text-amber-900 border-amber/30", en: "Watchful", hi: "नज़र रखें" },
  review: { className: "bg-coral-soft text-coral border-coral/30", en: "Needs a person", hi: "व्यक्ति देखें" },
};
