/**
 * Recovery domains. One convention everywhere: HIGHER NUMBER = MORE TROUBLE.
 * Pain uses the standard 0–10 numeric rating scale; every other domain is a 0–4 scale
 * with plain-language anchors, so patients pick a sentence rather than a number.
 */

export type ScaleDomain = "pain" | "appetite" | "nausea" | "mobility" | "sleep" | "mood" | "anxiety";

export type ScaleOption = { value: number; en: string; hi: string };

export type DomainDef = {
  key: ScaleDomain;
  en: string;
  hi: string;
  questionEn: string;
  questionHi: string;
  max: number;
  options: ScaleOption[];
};

export const PAIN_ANCHORS: ScaleOption[] = [
  { value: 0, en: "No pain", hi: "कोई दर्द नहीं" },
  { value: 2, en: "Mild", hi: "हल्का" },
  { value: 4, en: "Uncomfortable", hi: "असहज" },
  { value: 6, en: "Hard to ignore", hi: "ध्यान नहीं हटता" },
  { value: 8, en: "Severe", hi: "बहुत तेज़" },
  { value: 10, en: "Worst imaginable", hi: "असहनीय" },
];

export const DOMAINS: DomainDef[] = [
  {
    key: "pain",
    en: "Pain",
    hi: "दर्द",
    questionEn: "How much pain do you have right now?",
    questionHi: "अभी कितना दर्द है?",
    max: 10,
    options: PAIN_ANCHORS,
  },
  {
    key: "appetite",
    en: "Eating",
    hi: "खाना",
    questionEn: "How has eating been today?",
    questionHi: "आज खाना कैसा रहा?",
    max: 4,
    options: [
      { value: 0, en: "Eating normally", hi: "सामान्य रूप से खा रही/रहा हूँ" },
      { value: 1, en: "A little less than usual", hi: "थोड़ा कम" },
      { value: 2, en: "About half of usual", hi: "लगभग आधा" },
      { value: 3, en: "Very little", hi: "बहुत कम" },
      { value: 4, en: "Can't eat or drink", hi: "कुछ खा-पी नहीं पा रही/रहा" },
    ],
  },
  {
    key: "nausea",
    en: "Nausea",
    hi: "मतली",
    questionEn: "Any nausea or vomiting?",
    questionHi: "जी मिचलाना या उल्टी?",
    max: 4,
    options: [
      { value: 0, en: "None", hi: "नहीं" },
      { value: 1, en: "Mild queasiness", hi: "हल्का" },
      { value: 2, en: "Nauseous, no vomiting", hi: "मतली, उल्टी नहीं" },
      { value: 3, en: "Vomited once or twice", hi: "एक-दो बार उल्टी" },
      { value: 4, en: "Can't keep fluids down", hi: "पानी भी नहीं रुक रहा" },
    ],
  },
  {
    key: "mobility",
    en: "Moving",
    hi: "चलना-फिरना",
    questionEn: "How are you moving around?",
    questionHi: "चलना-फिरना कैसा है?",
    max: 4,
    options: [
      { value: 0, en: "Moving as usual", hi: "सामान्य" },
      { value: 1, en: "Walking, a bit slower", hi: "चल रही/रहा हूँ, थोड़ा धीरे" },
      { value: 2, en: "Short walks only", hi: "केवल थोड़ी दूर" },
      { value: 3, en: "Mostly in bed or a chair", hi: "ज़्यादातर बिस्तर या कुर्सी पर" },
      { value: 4, en: "Can't get up without help", hi: "मदद के बिना उठ नहीं पाती/पाता" },
    ],
  },
  {
    key: "sleep",
    en: "Sleep",
    hi: "नींद",
    questionEn: "How did you sleep last night?",
    questionHi: "कल रात नींद कैसी रही?",
    max: 4,
    options: [
      { value: 0, en: "Slept well", hi: "अच्छी नींद" },
      { value: 1, en: "Woke a few times", hi: "कुछ बार जागी/जागा" },
      { value: 2, en: "Restless", hi: "बेचैन नींद" },
      { value: 3, en: "Hardly slept", hi: "बहुत कम सोई/सोया" },
      { value: 4, en: "Didn't sleep at all", hi: "बिल्कुल नहीं सोई/सोया" },
    ],
  },
  {
    key: "mood",
    en: "Mood",
    hi: "मन",
    questionEn: "How is your mood?",
    questionHi: "मन कैसा है?",
    max: 4,
    options: [
      { value: 0, en: "Good", hi: "अच्छा" },
      { value: 1, en: "Okay", hi: "ठीक" },
      { value: 2, en: "Low", hi: "उदास" },
      { value: 3, en: "Very low", hi: "बहुत उदास" },
      { value: 4, en: "Hopeless", hi: "निराश" },
    ],
  },
  {
    key: "anxiety",
    en: "Worry",
    hi: "चिंता",
    questionEn: "How worried or anxious do you feel?",
    questionHi: "कितनी चिंता या घबराहट है?",
    max: 4,
    options: [
      { value: 0, en: "Calm", hi: "शांत" },
      { value: 1, en: "A little worried", hi: "थोड़ी चिंता" },
      { value: 2, en: "Worried", hi: "चिंतित" },
      { value: 3, en: "Very anxious", hi: "बहुत घबराहट" },
      { value: 4, en: "Overwhelmed or panicky", hi: "बहुत ज़्यादा घबराहट" },
    ],
  },
];

export const DOMAIN_BY_KEY = Object.fromEntries(DOMAINS.map((d) => [d.key, d])) as Record<ScaleDomain, DomainDef>;

export const WOUND_OPTIONS = [
  { value: "no_wound", en: "No wound / not applicable", hi: "घाव नहीं है" },
  { value: "healing_well", en: "Looks clean and dry", hi: "साफ़ और सूखा" },
  { value: "redness", en: "Some redness around it", hi: "आसपास लालिमा" },
  { value: "swelling", en: "Swollen or hard", hi: "सूजन या सख़्त" },
  { value: "discharge", en: "Leaking fluid or pus", hi: "पानी या मवाद निकल रहा" },
  { value: "bleeding", en: "Bleeding", hi: "ख़ून आ रहा" },
  { value: "opening", en: "Edges coming apart", hi: "टांके खुल रहे" },
] as const;

export const MEDS_OPTIONS = [
  { value: "all", en: "Took all of them", hi: "सारी ली" },
  { value: "some", en: "Missed some", hi: "कुछ छूट गई" },
  { value: "none", en: "Didn't take any", hi: "कोई नहीं ली" },
  { value: "not_applicable", en: "No medicines today", hi: "आज कोई दवा नहीं" },
] as const;

export function optionLabel(domain: ScaleDomain, value: number | null | undefined, locale: "en" | "hi" = "en") {
  if (value === null || value === undefined) return null;
  const def = DOMAIN_BY_KEY[domain];
  // Pain anchors are sparse; pick the closest anchor at or below the value.
  const opts = [...def.options].sort((a, b) => a.value - b.value);
  let best = opts[0];
  for (const o of opts) if (o.value <= value) best = o;
  return best[locale];
}

/** 0–1 severity used for colouring; higher = worse. */
export function severity(domain: ScaleDomain, value: number) {
  return value / DOMAIN_BY_KEY[domain].max;
}
