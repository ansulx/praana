/**
 * PRAANA safety engine — deterministic, offline, auditable.
 *
 * Runs on every check-in and every companion message BEFORE any AI is involved, and its
 * verdict can only be raised by AI, never lowered. It does not diagnose; it decides how
 * quickly a HUMAN should look, and what the patient should be told to do meanwhile.
 *
 * Design rules:
 *  - When unsure, escalate. A false "please call your team" is cheaper than a missed bleed.
 *  - Reasons describe what was REPORTED ("Temperature 38.4°C"), never a diagnosis.
 *  - English, Hinglish (romanised Hindi) and Devanagari are matched.
 */

import type { ScaleDomain } from "@/lib/domains";

export type TriageLevel = "none" | "watch" | "review" | "urgent";
export type UrgentAction = "emergency" | "mental_health";

export type Reason = {
  code: string;
  level: Exclude<TriageLevel, "none">;
  en: string;
  hi: string;
  action?: UrgentAction;
};

export type TriageInput = {
  freeText?: string | null;
  pain?: number | null;
  appetite?: number | null;
  nausea?: number | null;
  mobility?: number | null;
  sleep?: number | null;
  mood?: number | null;
  anxiety?: number | null;
  wound?: string | null;
  temperatureC?: number | null;
  medsTaken?: string | null;
  surgeryType?: string | null;
  dayOffset?: number | null;
};

export type PreviousCheckin = Partial<Record<ScaleDomain, number | null>> & { createdAt?: Date | string };

export type TriageResult = {
  level: TriageLevel;
  reasons: Reason[];
  actions: UrgentAction[];
  /** Temperature after unit correction / sanity checks (null if implausible). */
  temperatureC: number | null;
};

const RANK: Record<TriageLevel, number> = { none: 0, watch: 1, review: 2, urgent: 3 };
export const maxLevel = (a: TriageLevel, b: TriageLevel): TriageLevel => (RANK[a] >= RANK[b] ? a : b);
export const levelRank = (l: TriageLevel) => RANK[l];

// ─── Text rules ─────────────────────────────────────────────────────────────

type TextRule = {
  code: string;
  level: Reason["level"];
  en: string;
  hi: string;
  action?: UrgentAction;
  phrases: string[];
  /** A negation BEFORE the phrase ("no fever") cancels it. */
  negatable?: boolean;
  /** A Hindi-style negation AFTER the phrase ("bukhar nahi hai") cancels it. */
  postNegatable?: boolean;
};

const TEXT_RULES: TextRule[] = [
  {
    code: "breathing",
    level: "urgent",
    action: "emergency",
    en: "Reported difficulty breathing",
    hi: "सांस लेने में तकलीफ़ बताई",
    negatable: true,
    postNegatable: false, // "saans nahi aa rahi" means CAN'T breathe
    phrases: [
      "short of breath", "shortness of breath", "can't breathe", "cant breathe", "cannot breathe",
      "can not breathe", "difficulty breathing", "trouble breathing", "hard to breathe", "struggling to breathe",
      "breathless", "breathlessness", "gasping", "not able to breathe", "unable to breathe",
      "saans nahi", "saans nahin", "saans lene mein", "saans lene me", "saans phool", "sans nahi", "sans lene me",
      "सांस नहीं", "साँस नहीं", "सांस लेने में", "साँस लेने में", "सांस फूल", "साँस फूल",
    ],
  },
  {
    code: "chest_pain",
    level: "urgent",
    action: "emergency",
    en: "Reported chest pain or tightness",
    hi: "सीने में दर्द या जकड़न बताई",
    negatable: true,
    postNegatable: true,
    phrases: [
      "chest pain", "pain in my chest", "pain in chest", "chest tightness", "tight chest", "chest is tight",
      "pressure in my chest", "pressure in chest", "chest feels heavy",
      "seene mein dard", "seene me dard", "sine me dard", "chhati mein dard", "chhati me dard",
      "सीने में दर्द", "छाती में दर्द", "सीने में जकड़न",
    ],
  },
  {
    code: "heavy_bleeding",
    level: "urgent",
    action: "emergency",
    en: "Reported heavy or non-stop bleeding",
    hi: "बहुत ज़्यादा या न रुकने वाला ख़ून बताया",
    negatable: true,
    postNegatable: false,
    phrases: [
      "bleeding a lot", "heavy bleeding", "lot of blood", "lots of blood", "soaked through", "soaking the dressing",
      "dressing is soaked", "blood everywhere", "won't stop bleeding", "wont stop bleeding", "bleeding won't stop",
      "bleeding wont stop", "can't stop the bleeding", "bleeding heavily",
      "bahut khoon", "khoon ruk nahi", "khoon nahi ruk", "khoon band nahi",
      "बहुत खून", "बहुत ख़ून", "खून रुक नहीं", "ख़ून रुक नहीं", "खून बंद नहीं",
    ],
  },
  {
    code: "blood_cough_vomit",
    level: "urgent",
    action: "emergency",
    en: "Reported coughing or vomiting blood, or black stools",
    hi: "ख़ून की खांसी/उल्टी या काला मल बताया",
    negatable: true,
    postNegatable: true,
    phrases: [
      "coughing blood", "coughing up blood", "cough up blood", "vomiting blood", "vomited blood", "blood in vomit",
      "black stool", "black stools", "black poop", "tarry stool",
      "khoon ki ulti", "khoon ki khansi", "खून की उल्टी", "ख़ून की उल्टी", "खून की खांसी",
    ],
  },
  {
    code: "collapse",
    level: "urgent",
    action: "emergency",
    en: "Reported fainting, collapse or confusion",
    hi: "बेहोशी, गिरना या भ्रम बताया",
    negatable: true,
    postNegatable: true,
    phrases: [
      "fainted", "passed out", "unconscious", "blacked out", "collapsed", "very confused", "is confused",
      "not making sense", "can't wake", "cant wake", "hard to wake",
      "behosh", "behoshi", "बेहोश", "बेहोशी",
    ],
  },
  {
    code: "stroke_signs",
    level: "urgent",
    action: "emergency",
    en: "Reported face drooping, slurred speech or one-sided weakness",
    hi: "चेहरा टेढ़ा, बोलने में दिक़्क़त या एक तरफ़ कमज़ोरी बताई",
    negatable: true,
    phrases: ["face drooping", "face is drooping", "slurred speech", "speech is slurred", "weakness on one side", "one side weak", "can't lift my arm"],
  },
  {
    code: "allergy_airway",
    level: "urgent",
    action: "emergency",
    en: "Reported swelling of throat, lips or face",
    hi: "गले, होंठ या चेहरे पर सूजन बताई",
    negatable: true,
    phrases: ["throat swelling", "throat is swelling", "throat closing", "lips swelling", "lips swollen", "face swelling", "face is swollen", "tongue swelling"],
  },
  {
    code: "leg_clot_signs",
    level: "urgent",
    action: "emergency",
    en: "Reported a painful or swollen leg",
    hi: "पैर में दर्द या सूजन बताई",
    negatable: true,
    postNegatable: true,
    phrases: [
      "calf pain", "pain in my calf", "swollen calf", "leg is swollen", "swollen leg", "leg swelling", "one leg swollen",
      "pair mein sujan", "pair me sujan", "pindli mein dard", "पैर में सूजन", "पिंडली में दर्द",
    ],
  },
  {
    code: "self_harm",
    level: "urgent",
    action: "mental_health",
    en: "Expressed thoughts of self-harm or not wanting to live",
    hi: "ख़ुद को नुक़सान या जीना न चाहने की बात कही",
    negatable: false, // never cancel: "I don't want to die like this" still deserves a human
    postNegatable: false,
    phrases: [
      "kill myself", "end my life", "end it all", "want to die", "wanna die", "suicide", "suicidal",
      "don't want to live", "dont want to live", "do not want to live", "no reason to live", "better off dead",
      "hurt myself", "harm myself", "self harm", "self-harm", "no point living",
      "marna chahti", "marna chahta", "mar jana chahti", "mar jana chahta", "jeena nahi chahti", "jeena nahi chahta",
      "jeene ka mann nahi", "khudkushi", "aatmahatya",
      "आत्महत्या", "ख़ुदकुशी", "खुदकुशी", "मरना चाहती", "मरना चाहता", "जीना नहीं चाहती", "जीना नहीं चाहता", "जीने का मन नहीं",
    ],
  },
  {
    code: "high_fever_text",
    level: "urgent",
    action: "emergency",
    en: "Reported high fever, chills or shivering",
    hi: "तेज़ बुख़ार, ठंड लगना या कंपकंपी बताई",
    negatable: true,
    postNegatable: true,
    phrases: [
      "high fever", "high temperature", "fever with chills", "chills", "shivering", "rigors", "shaking with cold",
      "tez bukhar", "tej bukhar", "kapkapi", "thand lag", "तेज़ बुखार", "तेज बुखार", "कंपकंपी", "ठंड लग",
    ],
  },
  {
    code: "wound_opened",
    level: "urgent",
    action: "emergency",
    en: "Reported the wound opening or stitches coming apart",
    hi: "घाव खुलना या टांके निकलना बताया",
    negatable: true,
    postNegatable: true,
    phrases: [
      "wound opened", "wound has opened", "wound is open", "wound split", "stitches opened", "stitches came out",
      "stitches came apart", "staples came out", "incision opened",
      "taanke khul", "tanke khul", "ghaav khul", "ghav khul", "टांके खुल", "घाव खुल",
    ],
  },
  // ── review ──
  {
    code: "fever_text",
    level: "review",
    en: "Mentioned fever",
    hi: "बुख़ार का ज़िक्र",
    negatable: true,
    postNegatable: true,
    phrases: ["fever", "feverish", "feeling hot", "bukhar", "bukhaar", "बुखार", "बुख़ार"],
  },
  {
    code: "wound_concern_text",
    level: "review",
    en: "Described changes at the wound (redness, swelling, fluid or smell)",
    hi: "घाव में बदलाव बताया (लालिमा, सूजन, पानी या बदबू)",
    negatable: true,
    postNegatable: true,
    phrases: [
      "pus", "smells bad", "bad smell", "foul smell", "smelly", "red around", "redness", "oozing", "leaking",
      "wound is swollen", "swelling around", "hot to touch", "warm to touch",
      "mavaad", "mawad", "sujan", "soojan", "laal ho", "badboo", "मवाद", "सूजन", "लाल हो", "बदबू",
    ],
  },
  {
    code: "bleeding_text",
    level: "review",
    en: "Mentioned bleeding",
    hi: "ख़ून आने का ज़िक्र",
    negatable: true,
    postNegatable: true,
    phrases: ["bleeding", "blood", "khoon", "khun", "खून", "ख़ून"],
  },
  {
    code: "vomiting_text",
    level: "review",
    en: "Mentioned vomiting",
    hi: "उल्टी का ज़िक्र",
    negatable: true,
    postNegatable: true,
    phrases: ["vomiting", "vomited", "throwing up", "threw up", "ulti", "ultee", "उल्टी"],
  },
  {
    code: "severe_pain_text",
    level: "review",
    en: "Described severe pain",
    hi: "तेज़ दर्द बताया",
    negatable: true,
    postNegatable: true,
    phrases: ["unbearable", "severe pain", "excruciating", "worst pain", "terrible pain", "bahut dard", "bahut zyada dard", "असहनीय", "बहुत दर्द"],
  },
  {
    code: "drain_problem",
    level: "review",
    en: "Described a problem with the drain",
    hi: "ड्रेन में समस्या बताई",
    negatable: true,
    phrases: ["drain fell out", "drain came out", "drain is leaking", "drain leaking", "cloudy drain", "drain stopped", "drain is blocked", "drain blocked"],
  },
  {
    code: "arm_swelling",
    level: "review",
    en: "Described arm or hand swelling",
    hi: "हाथ या बांह में सूजन बताई",
    negatable: true,
    postNegatable: true,
    phrases: ["arm swelling", "swollen arm", "arm is swollen", "hand is swollen", "swollen hand", "haath mein sujan", "haath me sujan", "हाथ में सूजन", "बांह में सूजन"],
  },
  {
    code: "urine_problem",
    level: "review",
    en: "Described trouble passing urine",
    hi: "पेशाब में दिक़्क़त बताई",
    negatable: true,
    phrases: ["can't pee", "cant pee", "cannot pee", "can't urinate", "no urine", "haven't passed urine", "burning urine", "peshab nahi", "पेशाब नहीं", "पेशाब में जलन"],
  },
  {
    code: "not_coping_text",
    level: "review",
    action: "mental_health",
    en: "Said they are not coping emotionally",
    hi: "मन से बहुत परेशान होने की बात कही",
    negatable: true,
    phrases: ["hopeless", "can't cope", "cant cope", "cannot cope", "crying all the time", "very depressed", "so depressed", "panic attack", "bahut udaas", "bahut pareshan", "बहुत उदास", "बहुत परेशान"],
  },
  {
    code: "constipation_text",
    level: "watch",
    en: "Mentioned constipation",
    hi: "कब्ज़ का ज़िक्र",
    negatable: true,
    postNegatable: true,
    phrases: ["constipated", "constipation", "no bowel movement", "haven't passed stool", "kabz", "kabj", "कब्ज", "कब्ज़"],
  },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toPattern = (phrase: string) =>
  new RegExp(`(?<![\\p{L}\\p{M}])${escape(phrase).replace(/\s+/g, "\\s+").replace(/'/g, "['’]?")}(?![\\p{L}\\p{M}])`, "giu");

const COMPILED = TEXT_RULES.map((r) => ({ rule: r, patterns: r.phrases.map(toPattern) }));

const PRE_NEGATORS =
  /(?:^|\s)(no|not|never|without|denies|deny|don['’]?t|didn['’]?t|doesn['’]?t|isn['’]?t|haven['’]?t|hasn['’]?t|nahi|nahin|na|koi|नहीं|ना|कोई)(?=\s|$)/iu;
const POST_NEGATORS = /^\s*(nahi|nahin|nhi|nai|not|नहीं|ना)(?![\p{L}\p{M}])/iu;
const CLAUSE_BREAK = /[.,;!?।\n]|(?<![\p{L}])(but|however|lekin|magar|par|लेकिन|मगर|पर)(?![\p{L}])/giu;

function lastClause(before: string): string {
  let cut = 0;
  for (const m of before.matchAll(CLAUSE_BREAK)) cut = (m.index ?? 0) + m[0].length;
  return before.slice(cut);
}

function isNegated(text: string, start: number, end: number, rule: TextRule): boolean {
  if (rule.negatable) {
    const clause = lastClause(text.slice(0, start));
    // Only look at the last three words of the clause so "no fever, but chest pain" stays flagged.
    // "I don't have chest pain", "no fever", "koi dard"…
    const tail = clause.trim().split(/\s+/).filter(Boolean).slice(-3).join(" ");
    if (tail && PRE_NEGATORS.test(tail)) return true;
  }
  if (rule.postNegatable) {
    const after = text.slice(end, end + 24);
    // "bukhar nahi hai" / "fever not there" → negated; but stop at a clause break.
    const clause = after.split(/[.,;!?।\n]/)[0];
    if (POST_NEGATORS.test(clause) || /^\s*(bilkul\s+)?(nahi|नहीं)/iu.test(clause)) return true;
  }
  return false;
}

export function scanText(raw: string | null | undefined): Reason[] {
  if (!raw) return [];
  const text = raw.normalize("NFC").toLowerCase().replace(/\s+/g, " ").slice(0, 8000);
  const found = new Map<string, Reason>();
  for (const { rule, patterns } of COMPILED) {
    if (found.has(rule.code)) continue;
    outer: for (const re of patterns) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        const start = m.index ?? 0;
        if (!isNegated(text, start, start + m[0].length, rule)) {
          found.set(rule.code, { code: rule.code, level: rule.level, en: rule.en, hi: rule.hi, action: rule.action });
          break outer;
        }
      }
    }
  }
  // Specific findings make their generic cousins redundant.
  const drop = (generic: string, ...specific: string[]) => {
    if (specific.some((s) => found.has(s))) found.delete(generic);
  };
  drop("fever_text", "high_fever_text");
  drop("bleeding_text", "heavy_bleeding", "blood_cough_vomit");
  drop("vomiting_text", "blood_cough_vomit");
  drop("not_coping_text", "self_harm");
  return [...found.values()];
}

/** Extracts a temperature mentioned in free text ("temp 38.6", "101 F", "बुखार 100"). */
export function extractTemperature(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  const m =
    text.match(/(?:temp(?:erature)?|fever|bukhar|बुखार|तापमान)[^\d]{0,12}(\d{2,3}(?:\.\d)?)\s*(°?\s*[cf])?/u) ??
    text.match(/(\d{2,3}(?:\.\d)?)\s*°?\s*(c|f)\b/u) ??
    text.match(/(\d{2,3}(?:\.\d)?)\s*(degree|degrees|डिग्री)/u);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] ?? "").replace(/[°\s]/g, "");
  return normaliseTemperature(n, unit === "f" ? "f" : unit === "c" ? "c" : undefined).value;
}

/** Accepts °C or °F (auto-detected when obvious) and rejects implausible values. */
export function normaliseTemperature(
  n: number | null | undefined,
  unit?: "c" | "f",
): { value: number | null; note?: "converted" | "implausible" } {
  if (n === null || n === undefined || !Number.isFinite(n)) return { value: null };
  let c = n;
  let note: "converted" | undefined;
  if (unit === "f" || (unit === undefined && n >= 93 && n <= 110)) {
    c = ((n - 32) * 5) / 9;
    note = "converted";
  }
  if (c < 33 || c > 43.5) return { value: null, note: "implausible" };
  return { value: Math.round(c * 10) / 10, note };
}

// ─── Main entry ─────────────────────────────────────────────────────────────

const R = (code: string, level: Reason["level"], en: string, hi: string, action?: UrgentAction): Reason => ({
  code,
  level,
  en,
  hi,
  action,
});

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function triage(input: TriageInput, previous: PreviousCheckin[] = []): TriageResult {
  const reasons: Reason[] = [];
  const prev = previous[0];

  // Temperature: from the field, else from the words.
  let temp: number | null = null;
  if (num(input.temperatureC)) {
    const t = normaliseTemperature(input.temperatureC);
    if (t.value === null) {
      reasons.push(R("temp_implausible", "watch", `Temperature entry (${input.temperatureC}) looks unusual. Please re-check`, `तापमान (${input.temperatureC}) असामान्य लगता है, फिर से जांचें`));
    }
    temp = t.value;
  }
  if (temp === null) temp = extractTemperature(input.freeText);

  if (temp !== null) {
    if (temp >= 38.0) reasons.push(R("fever_38", "urgent", `Temperature ${temp}°C`, `तापमान ${temp}°C`, "emergency"));
    else if (temp >= 37.5) reasons.push(R("temp_raised", "review", `Temperature ${temp}°C (slightly raised)`, `तापमान ${temp}°C (थोड़ा बढ़ा हुआ)`));
    else if (temp < 35.0) reasons.push(R("temp_low", "review", `Temperature ${temp}°C (low)`, `तापमान ${temp}°C (कम)`));
  }

  // Pain
  if (num(input.pain)) {
    if (input.pain >= 9) reasons.push(R("pain_severe", "urgent", `Pain ${input.pain}/10`, `दर्द ${input.pain}/10`, "emergency"));
    else if (input.pain >= 7) reasons.push(R("pain_high", "review", `Pain ${input.pain}/10`, `दर्द ${input.pain}/10`));
    else if (input.pain >= 5) reasons.push(R("pain_moderate", "watch", `Pain ${input.pain}/10`, `दर्द ${input.pain}/10`));
    if (prev && num(prev.pain) && input.pain - prev.pain >= 3) {
      reasons.push(R("pain_jump", "review", `Pain rose from ${prev.pain} to ${input.pain} since last check-in`, `दर्द ${prev.pain} से बढ़कर ${input.pain} हुआ`));
    }
  }

  // Nausea / hydration
  if (num(input.nausea)) {
    if (input.nausea >= 4) {
      const persistent = prev && num(prev.nausea) && prev.nausea >= 3;
      reasons.push(
        persistent
          ? R("fluids_persistent", "urgent", "Unable to keep fluids down, also at the last check-in", "पानी भी नहीं रुक रहा, पिछली बार भी", "emergency")
          : R("fluids", "review", "Unable to keep fluids down", "पानी भी नहीं रुक रहा"),
      );
    } else if (input.nausea === 3) reasons.push(R("vomiting", "watch", "Vomited once or twice", "एक-दो बार उल्टी"));
  }

  // Appetite
  if (num(input.appetite)) {
    if (input.appetite >= 4) reasons.push(R("not_eating", "review", "Not able to eat or drink", "खा-पी नहीं पा रहे"));
    else if (input.appetite >= 3 && streak(previous, "appetite", 3, 3)) {
      reasons.push(R("low_appetite_streak", "review", "Eating very little for 3 check-ins in a row", "लगातार 3 बार बहुत कम खाना"));
    }
  }

  // Mobility
  if (num(input.mobility)) {
    if (input.mobility >= 4) reasons.push(R("immobile", "review", "Can't get up without help", "मदद के बिना उठ नहीं पा रहे"));
    else if (prev && num(prev.mobility) && input.mobility - prev.mobility >= 2) {
      reasons.push(R("mobility_drop", "review", "Moving much less than at the last check-in", "पिछली बार से बहुत कम चल-फिर रहे"));
    }
  }

  // Mood / anxiety / sleep
  if (num(input.mood)) {
    if (input.mood >= 4) reasons.push(R("mood_hopeless", "review", "Feeling hopeless", "निराशा महसूस हो रही", "mental_health"));
    else if (input.mood >= 3 && streak(previous, "mood", 2, 3)) reasons.push(R("mood_low_streak", "review", "Very low mood at two check-ins in a row", "लगातार दो बार बहुत उदास मन"));
  }
  if (num(input.anxiety) && input.anxiety >= 4) reasons.push(R("anxiety_severe", "review", "Feeling overwhelmed or panicky", "बहुत ज़्यादा घबराहट", "mental_health"));
  if (num(input.sleep)) {
    if (input.sleep >= 4) reasons.push(R("no_sleep", "watch", "Didn't sleep at all", "बिल्कुल नींद नहीं आई"));
    else if (input.sleep >= 3 && streak(previous, "sleep", 3, 3)) reasons.push(R("poor_sleep_streak", "review", "Hardly sleeping for 3 nights", "3 रातों से बहुत कम नींद"));
  }

  // Wound
  const raisedTemp = temp !== null && temp >= 37.5;
  switch (input.wound) {
    case "opening":
      reasons.push(R("wound_opening", "urgent", "Wound edges coming apart", "टांके खुल रहे हैं", "emergency"));
      break;
    case "bleeding":
      reasons.push(R("wound_bleeding", "review", "Bleeding from the wound", "घाव से ख़ून आ रहा"));
      break;
    case "discharge":
    case "swelling":
    case "redness":
      if (raisedTemp) {
        reasons.push(R("wound_with_temp", "urgent", "Wound changes together with a raised temperature", "घाव में बदलाव और बढ़ा हुआ तापमान", "emergency"));
      } else {
        const label = { discharge: ["Fluid or pus from the wound", "घाव से पानी या मवाद"], swelling: ["Swelling at the wound", "घाव पर सूजन"], redness: ["Redness around the wound", "घाव के आसपास लालिमा"] }[input.wound];
        reasons.push(R(`wound_${input.wound}`, input.wound === "redness" ? "watch" : "review", label[0], label[1]));
      }
      break;
  }

  // Medicines
  if (input.medsTaken === "none") reasons.push(R("meds_none", "review", "Didn't take any medicines today", "आज कोई दवा नहीं ली"));
  else if (input.medsTaken === "some") reasons.push(R("meds_some", "watch", "Missed some medicines", "कुछ दवाइयाँ छूट गईं"));

  // Free text
  for (const r of scanText(input.freeText)) {
    if (!reasons.some((x) => x.code === r.code)) reasons.push(r);
  }

  // A text mention of fever is redundant when we have a measured temperature.
  const final = temp !== null ? reasons.filter((r) => r.code !== "fever_text") : reasons;

  const level = final.reduce<TriageLevel>((acc, r) => maxLevel(acc, r.level), "none");
  const actions = [...new Set(final.filter((r) => r.action && (r.level === "urgent" || r.action === "mental_health")).map((r) => r.action!))];
  final.sort((a, b) => RANK[b.level] - RANK[a.level]);
  return { level, reasons: final, actions, temperatureC: temp };
}

/** True if the previous `need - 1` check-ins also had `domain >= min`. */
function streak(previous: PreviousCheckin[], domain: ScaleDomain, need: number, min: number): boolean {
  const window = previous.slice(0, need - 1);
  if (window.length < need - 1) return false;
  return window.every((p) => num(p[domain]) && (p[domain] as number) >= min);
}
