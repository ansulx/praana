export const SURGERY_TYPES = [
  { value: "breast", en: "Breast surgery", hi: "स्तन की सर्जरी" },
  { value: "colorectal", en: "Bowel / colorectal surgery", hi: "आंत की सर्जरी" },
  { value: "head_neck", en: "Head & neck surgery", hi: "सिर और गर्दन की सर्जरी" },
  { value: "gynaecologic", en: "Gynaecological surgery", hi: "स्त्री रोग सर्जरी" },
  { value: "thoracic", en: "Lung / chest surgery", hi: "फेफड़े / छाती की सर्जरी" },
  { value: "upper_gi", en: "Stomach / oesophagus / pancreas", hi: "पेट / भोजन नली / अग्न्याशय" },
  { value: "urologic", en: "Kidney / bladder / prostate", hi: "किडनी / मूत्राशय / प्रोस्टेट" },
  { value: "other", en: "Other surgery", hi: "अन्य सर्जरी" },
] as const;

export const CARE_ROLES = [
  { value: "surgeon", en: "Surgeon", hi: "सर्जन" },
  { value: "oncologist", en: "Oncologist", hi: "कैंसर विशेषज्ञ" },
  { value: "nurse", en: "Nurse", hi: "नर्स" },
  { value: "physiotherapist", en: "Physiotherapist", hi: "फ़िज़ियोथेरेपिस्ट" },
  { value: "nutritionist", en: "Nutritionist", hi: "पोषण विशेषज्ञ" },
  { value: "psychologist", en: "Psychologist", hi: "मनोवैज्ञानिक" },
  { value: "anaesthesiologist", en: "Anaesthesiologist", hi: "एनेस्थीसिया विशेषज्ञ" },
  { value: "coordinator", en: "Care coordinator", hi: "केयर कोऑर्डिनेटर" },
] as const;

export function surgeryLabel(value: string | null | undefined, locale: "en" | "hi" = "en") {
  const hit = SURGERY_TYPES.find((s) => s.value === value);
  return hit ? hit[locale] : locale === "hi" ? "सर्जरी" : "Surgery";
}

export function careRoleLabel(value: string | null | undefined, locale: "en" | "hi" = "en") {
  const hit = CARE_ROLES.find((s) => s.value === value);
  return hit ? hit[locale] : "";
}

export const TRIAGE_STYLE = {
  urgent: { en: "Needs attention now", hi: "तुरंत ध्यान दें", className: "bg-destructive/10 text-destructive border-destructive/30" },
  review: { en: "Team will review", hi: "टीम देखेगी", className: "bg-amber-soft text-[oklch(0.45_0.12_70)] border-amber/40" },
  watch: { en: "Noted", hi: "नोट किया", className: "bg-secondary text-secondary-foreground border-border" },
  none: { en: "Steady", hi: "स्थिर", className: "bg-mint text-primary border-primary/20" },
} as const;
