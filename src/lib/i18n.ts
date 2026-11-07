/**
 * Patient-facing copy in English and Hindi. Clinician screens are English-only.
 * Keep sentences short and warm; avoid clinical jargon on patient screens.
 */
export type Locale = "en" | "hi";

const en = {
  "nav.home": "Today",
  "nav.checkin": "Check in",
  "nav.insights": "Insights",
  "nav.plan": "Plan",
  "nav.timeline": "My story",
  "nav.guided": "Guided",
  "nav.companion": "Ask",
  "nav.journey": "Journey",
  "nav.medicines": "Medicines",
  "nav.team": "Care team",
  "nav.learn": "Learn",
  "nav.settings": "Settings",
  "nav.more": "More",
  "nav.signout": "Sign out",

  "greet.morning": "Good morning",
  "greet.afternoon": "Good afternoon",
  "greet.evening": "Good evening",
  "greet.namaste": "Namaste",

  "home.howToday": "How are you feeling today?",
  "home.checkinCta": "Tell us how today feels",
  "home.checkinDone": "Today's check-in is in",
  "home.checkinAgain": "Something changed? Add an update",
  "home.checkinDoneBody": "It's on your recovery story. Your care team can look when they need to.",
  "home.teamReviewing": "Your care team has been asked to look at your latest check-in.",
  "home.seeStory": "See it on My story",
  "home.forYou": "For you today",
  "home.nextUp": "Coming up",
  "home.noAppointments": "No appointments scheduled.",
  "home.medsToday": "Medicines today",
  "home.recentTrend": "Last 7 days",
  "home.fromTeam": "From your care team",

  "checkin.title": "How do you feel today?",
  "checkin.subtitle": "Speak or tap. Typing is optional. Your care team can see what you share.",
  "checkin.placeholder": "Or type a sentence… e.g. Pain about 4, ate half my lunch.",
  "checkin.speak": "Speak",
  "checkin.stop": "Stop",
  "checkin.listening": "Listening…",
  "checkin.addPhoto": "Add photo",
  "checkin.quick": "Pain right now",
  "checkin.moreDetails": "Add more details",
  "checkin.hideDetails": "Hide extra details",
  "checkin.temperature": "Temperature (if you measured it)",
  "checkin.wound": "Wound",
  "checkin.meds": "Medicines today",
  "checkin.review": "Review",
  "checkin.reviewTitle": "Here's what we understood",
  "checkin.reviewBody": "Please check and correct anything that isn't right. Nothing is sent until you press Send.",
  "checkin.fromWords": "from your words",
  "checkin.send": "Send to my care team",
  "checkin.sending": "Sending…",
  "checkin.edit": "Edit",
  "checkin.sentTitle": "Thank you. Your update is saved.",
  "checkin.sentBody": "It's on your recovery timeline and your care team can see it.",
  "checkin.reviewSent": "Your care team has been asked to look at this today. If things get worse before they reach you, call them.",
  "checkin.notSure": "Not sure",
  "checkin.asCaregiver": "You're checking in on behalf of",

  "urgent.title": "Please contact your care team now",
  "urgent.body": "Some of what you described needs a person to look at it quickly. If you can't reach your team, or you feel very unwell, call emergency services or go to the nearest emergency department.",
  "urgent.callTeam": "Call care team",
  "urgent.callEmergency": "Call emergency",
  "urgent.mhTitle": "You don't have to carry this alone",
  "urgent.mhBody": "What you're feeling matters. Please talk to someone now. A free, confidential helpline is available any time, day or night.",
  "urgent.mhCall": "Call helpline",

  "common.back": "Back",
  "common.continue": "Continue",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.done": "Done",
  "common.retry": "Try again",
  "common.offline": "You're offline. Your draft is saved on this device and will be ready when you reconnect.",
  "common.loading": "Loading…",
  "common.day": "Day",
  "common.today": "Today",
  "common.optional": "optional",

  "ai.disclaimer": "PRAANA organises what you share. It does not diagnose. Your care team makes clinical decisions.",
} as const;

export type MessageKey = keyof typeof en;

const hi: Record<MessageKey, string> = {
  "nav.home": "आज",
  "nav.checkin": "हाल बताएं",
  "nav.insights": "सिग्नल",
  "nav.plan": "प्लान",
  "nav.timeline": "मेरी कहानी",
  "nav.guided": "अभ्यास",
  "nav.companion": "पूछें",
  "nav.journey": "सफ़र",
  "nav.medicines": "दवाइयाँ",
  "nav.team": "केयर टीम",
  "nav.learn": "जानकारी",
  "nav.settings": "सेटिंग्स",
  "nav.more": "और",
  "nav.signout": "साइन आउट",

  "greet.morning": "सुप्रभात",
  "greet.afternoon": "नमस्ते",
  "greet.evening": "शुभ संध्या",
  "greet.namaste": "नमस्ते",

  "home.howToday": "आज आप कैसा महसूस कर रहे हैं?",
  "home.checkinCta": "आज का हाल बताएं",
  "home.checkinDone": "आज का हाल मिल गया",
  "home.checkinAgain": "कुछ बदला? और बताएं",
  "home.checkinDoneBody": "यह आपकी रिकवरी कहानी पर है। ज़रूरत पड़ने पर केयर टीम देख सकती है।",
  "home.teamReviewing": "आपकी केयर टीम से आपका पिछला हाल देखने को कहा गया है।",
  "home.seeStory": "मेरी कहानी देखें",
  "home.forYou": "आज आपके लिए",
  "home.nextUp": "आगे",
  "home.noAppointments": "कोई अपॉइंटमेंट तय नहीं है।",
  "home.medsToday": "आज की दवाइयाँ",
  "home.recentTrend": "पिछले 7 दिन",
  "home.fromTeam": "आपकी केयर टीम से",

  "checkin.title": "आज कैसा महसूस हो रहा है?",
  "checkin.subtitle": "बोलें या टैप करें। लिखना वैकल्पिक है। जो बताएंगे केयर टीम देख सकती है।",
  "checkin.placeholder": "या एक वाक्य लिखें… जैसे: दर्द लगभग 4, आधा खाना खाया।",
  "checkin.speak": "बोलें",
  "checkin.stop": "रोकें",
  "checkin.listening": "सुन रहे हैं…",
  "checkin.addPhoto": "फ़ोटो जोड़ें",
  "checkin.quick": "अभी दर्द",
  "checkin.moreDetails": "और विवरण जोड़ें",
  "checkin.hideDetails": "अतिरिक्त विवरण छिपाएं",
  "checkin.temperature": "तापमान (अगर नापा हो)",
  "checkin.wound": "घाव",
  "checkin.meds": "आज की दवाइयाँ",
  "checkin.review": "देखें",
  "checkin.reviewTitle": "हमने यह समझा",
  "checkin.reviewBody": "कृपया जांचें और जो सही न हो उसे बदलें। भेजें दबाने तक कुछ नहीं भेजा जाएगा।",
  "checkin.fromWords": "आपके शब्दों से",
  "checkin.send": "केयर टीम को भेजें",
  "checkin.sending": "भेज रहे हैं…",
  "checkin.edit": "बदलें",
  "checkin.sentTitle": "धन्यवाद। आपका हाल सेव हो गया",
  "checkin.sentBody": "यह आपकी रिकवरी टाइमलाइन पर है और आपकी केयर टीम इसे देख सकती है।",
  "checkin.reviewSent": "आपकी केयर टीम से आज इसे देखने को कहा गया है। उनसे बात होने से पहले तबीयत बिगड़े तो उन्हें फ़ोन करें।",
  "checkin.notSure": "पता नहीं",
  "checkin.asCaregiver": "आप इनकी ओर से हाल बता रहे हैं:",

  "urgent.title": "कृपया अभी अपनी केयर टीम से संपर्क करें",
  "urgent.body": "आपने जो बताया उसे जल्दी किसी व्यक्ति को देखना चाहिए। अगर टीम से बात न हो पाए या तबीयत बहुत ख़राब लगे, तो इमरजेंसी नंबर पर कॉल करें या नज़दीकी इमरजेंसी विभाग जाएं।",
  "urgent.callTeam": "केयर टीम को कॉल करें",
  "urgent.callEmergency": "इमरजेंसी कॉल करें",
  "urgent.mhTitle": "आपको यह अकेले नहीं सहना है",
  "urgent.mhBody": "आप जो महसूस कर रहे हैं वह मायने रखता है। कृपया अभी किसी से बात करें। मुफ़्त और गोपनीय हेल्पलाइन दिन-रात उपलब्ध है।",
  "urgent.mhCall": "हेल्पलाइन पर कॉल करें",

  "common.back": "वापस",
  "common.continue": "आगे",
  "common.save": "सेव करें",
  "common.cancel": "रद्द करें",
  "common.done": "हो गया",
  "common.retry": "फिर कोशिश करें",
  "common.offline": "आप ऑफ़लाइन हैं। आपका ड्राफ़्ट इस डिवाइस पर सेव है और इंटरनेट आने पर तैयार रहेगा।",
  "common.loading": "लोड हो रहा है…",
  "common.day": "दिन",
  "common.today": "आज",
  "common.optional": "वैकल्पिक",

  "ai.disclaimer": "PRAANA आपकी बताई बातों को व्यवस्थित करता है। यह निदान नहीं करता। इलाज के फ़ैसले आपकी केयर टीम लेती है।",
};

const dict: Record<Locale, Record<MessageKey, string>> = { en, hi };

export function t(locale: Locale, key: MessageKey): string {
  return dict[locale]?.[key] ?? en[key];
}

export function greeting(locale: Locale, hour: number): string {
  if (hour < 12) return t(locale, "greet.morning");
  if (hour < 17) return t(locale, "greet.afternoon");
  return t(locale, "greet.evening");
}

/** Pick the right string from a bilingual content object. */
export function pick<T extends { en: string; hi?: string }>(obj: T, locale: Locale): string {
  return (locale === "hi" && obj.hi) || obj.en;
}
