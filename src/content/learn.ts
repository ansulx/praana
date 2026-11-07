import type { Bi } from "./guided";
import type { StageKey } from "./journey";

/**
 * Short, conservative explainers from each discipline on the care team.
 * They inform; they never replace the patient's own team. The companion uses
 * `searchArticles` to answer questions when no AI is configured.
 */

export type Discipline = "anaesthesia" | "nutrition" | "physiotherapy" | "nursing" | "psychology" | "oncology" | "caregiving";

export type Article = {
  slug: string;
  title: Bi;
  summary: Bi;
  discipline: Discipline;
  minutes: number;
  stages: StageKey[];
  keywords: string[];
  sections: { heading: string; body: string }[];
  reviewedNote: string;
};

const b = (en: string, hi: string): Bi => ({ en, hi });

export const DISCIPLINE_LABELS: Record<Discipline, Bi> = {
  anaesthesia: b("Anaesthesia", "एनेस्थीसिया"),
  nutrition: b("Nutrition", "पोषण"),
  physiotherapy: b("Physiotherapy", "फ़िज़ियोथेरेपी"),
  nursing: b("Nursing", "नर्सिंग"),
  psychology: b("Psychology", "मनोविज्ञान"),
  oncology: b("Oncology", "ऑन्कोलॉजी"),
  caregiving: b("Caregiving", "देखभाल"),
};

const REVIEW = "General education for people recovering from cancer surgery. Your own team's instructions come first.";

export const ARTICLES: Article[] = [
  {
    slug: "when-to-call",
    title: b("When to call your care team", "केयर टीम को कब फ़ोन करें"),
    summary: b("Warning signs that shouldn't wait for your next appointment.", "चेतावनी के संकेत जिनके लिए अगली मुलाक़ात का इंतज़ार न करें।"),
    discipline: "nursing",
    minutes: 3,
    stages: ["meet", "surgery", "home"],
    keywords: ["call", "emergency", "warning", "danger", "fever", "bleeding", "breath", "chest", "when to call", "kab phone", "kab call", "emergency", "bukhar", "khoon", "saans", "बुखार", "खून", "सांस", "इमरजेंसी", "red flag", "worried", "urgent"],
    sections: [
      { heading: "Call emergency services (112) or go to the nearest emergency department if", body: "You have trouble breathing, chest pain, heavy bleeding that doesn't stop with firm pressure, you faint or become confused, or someone can't wake you properly." },
      { heading: "Call your care team the same day if", body: "Your temperature is 38°C or higher, or you have chills or shivering. Your wound becomes more red, swollen, hot, leaks pus or smells, or the edges come apart. You have a new painful or swollen leg. You can't keep fluids down, or haven't passed urine for many hours. Pain is getting worse despite your medicines. Your drain falls out or its fluid suddenly changes." },
      { heading: "Mention at your next check-in", body: "Gradual changes in appetite, sleep, mood or energy. These matter too, PRAANA keeps them on your timeline so your team sees the pattern." },
      { heading: "If you're unsure", body: "Call. Your team would rather hear from you early. Use 'Need help now?' at the top of any screen." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "wound-care",
    title: b("Wound care: what's normal, what's not", "घाव की देखभाल: क्या सामान्य है, क्या नहीं"),
    summary: b("How a healing wound usually looks, and changes to report.", "ठीक होता घाव आमतौर पर कैसा दिखता है, और कौन से बदलाव बताएं।"),
    discipline: "nursing",
    minutes: 4,
    stages: ["surgery", "home"],
    keywords: ["wound", "stitches", "incision", "scar", "dressing", "red", "swelling", "pus", "shower", "bath", "nahana", "ghaav", "taanke", "tanke", "घाव", "टांके", "पट्टी", "नहाना", "sujan", "itching", "khujli"],
    sections: [
      { heading: "Usually normal", body: "Mild pinkness right along the edges, some bruising, a little clear or slightly pink fluid in the first days, numbness or tingling around the scar, and itching as it heals." },
      { heading: "Report to your team", body: "Redness that spreads or gets darker, increasing swelling or hardness, the area feeling hot, thick yellow/green fluid or pus, a bad smell, bleeding that soaks the dressing, edges opening, or fever." },
      { heading: "Keeping it clean", body: "Follow your discharge instructions on dressings and when you may shower. Pat dry gently; don't rub. Avoid creams, powders or home remedies on the wound unless your team suggests them." },
      { heading: "Photos help", body: "If something looks different, add a photo to your check-in in good light. Your team can compare it day to day." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "drain-care",
    title: b("Looking after a drain at home", "घर पर ड्रेन की देखभाल"),
    summary: b("Emptying, recording, and when to call about your surgical drain.", "ड्रेन ख़ाली करना, लिखना, और कब फ़ोन करें।"),
    discipline: "nursing",
    minutes: 4,
    stages: ["home"],
    keywords: ["drain", "drainage", "bulb", "tube", "output", "ml", "fluid", "drain bag", "drain nikal", "ड्रेन", "नली", "pipe", "drain removal", "drain fell"],
    sections: [
      { heading: "Recording output", body: "Empty the drain at the times your nurse showed you, usually once or twice a day. Write down the amount in ml and the colour in your check-in. Most teams remove the drain once the daily amount falls below a level they set." },
      { heading: "Expected changes", body: "Fluid often starts red-pink and becomes lighter, straw-coloured, over days. The amount usually goes down gradually." },
      { heading: "Call your team if", body: "The drain falls out or the tube is pulled; fluid becomes cloudy, thick or smelly; the amount suddenly increases or turns bright red; the drain stops completely and the area swells; or the skin around it becomes red, hot or painful, or you have a fever." },
      { heading: "Everyday tips", body: "Pin the drain to your clothes so it doesn't pull. Keep the site dry. Wash your hands before and after handling it." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "day-of-surgery",
    title: b("What happens on the day of surgery", "सर्जरी के दिन क्या होता है"),
    summary: b("From arriving at hospital to waking up, what to expect from anaesthesia.", "अस्पताल पहुंचने से होश आने तक, एनेस्थीसिया से क्या उम्मीद करें।"),
    discipline: "anaesthesia",
    minutes: 4,
    stages: ["prepare", "surgery"],
    keywords: ["anaesthesia", "anesthesia", "fasting", "nil by mouth", "before surgery", "operation day", "behoshi", "anesthesia", "khana kab", "fast", "ऑपरेशन", "बेहोशी", "उपवास", "pre op", "pac"],
    sections: [
      { heading: "Before you come in", body: "Follow your hospital's fasting instructions exactly, when to stop eating and drinking. Ask which of your usual medicines to take or stop, especially blood thinners, diabetes medicines and blood pressure tablets." },
      { heading: "Meeting the anaesthetist", body: "They'll ask about your health, allergies, previous anaesthetics and loose teeth, and explain how they'll keep you asleep and comfortable. It's a good time to ask about pain relief after surgery." },
      { heading: "Waking up", body: "You'll wake in the recovery area. Feeling sleepy, cold, a sore throat or a little sick is common and usually settles. Tell the nurses about pain or nausea, there are medicines for both." },
      { heading: "The first hours", body: "Deep breathing and moving your feet start early. The team will tell you when you can drink, eat and sit out of bed." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "eating-to-heal",
    title: b("Eating to heal: protein at every meal", "ठीक होने के लिए खाना: हर भोजन में प्रोटीन"),
    summary: b("Simple Indian foods that help your body repair after surgery.", "सर्जरी के बाद शरीर की मरम्मत में मदद करने वाले सरल भारतीय भोजन।"),
    discipline: "nutrition",
    minutes: 3,
    stages: ["prepare", "home", "life"],
    keywords: ["food", "diet", "eat", "protein", "nutrition", "what to eat", "kya khaye", "kya khana", "khana", "dal", "paneer", "egg", "anda", "खाना", "आहार", "प्रोटीन", "दाल", "पनीर", "healing", "weight"],
    sections: [
      { heading: "Why protein", body: "Your body uses protein to repair tissue and fight infection. Try to include some at every meal and snack." },
      { heading: "Easy sources", body: "Dal, chana, rajma, curd, paneer, milk, eggs, soya chunks, sprouts, fish or chicken if you eat them, and nuts or peanut chikki as snacks." },
      { heading: "Small and often", body: "Five or six small meals are often easier than three big ones while your appetite returns." },
      { heading: "Special diets", body: "If you've had bowel, stomach or head-and-neck surgery, or you have diabetes or kidney problems, your team or nutritionist may give you specific advice, follow theirs." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "low-appetite",
    title: b("When you don't feel like eating", "जब खाने का मन न करे"),
    summary: b("Managing low appetite and nausea in the weeks after surgery.", "सर्जरी के बाद के हफ़्तों में कम भूख और मतली संभालना।"),
    discipline: "nutrition",
    minutes: 3,
    stages: ["home"],
    keywords: ["appetite", "not hungry", "nausea", "vomit", "bhookh", "bhook nahi", "ulti", "ji machlana", "भूख", "उल्टी", "मतली", "taste", "swad", "not eating", "khana nahi"],
    sections: [
      { heading: "It's common", body: "Anaesthesia, pain medicines, less activity and worry can all reduce appetite for a while." },
      { heading: "Things that may help", body: "Small portions on a small plate; cool or room-temperature foods if smells bother you; sipping fluids between meals rather than with them; nourishing drinks like lassi, milk, soups or dal water; ginger or lemon if nausea is mild." },
      { heading: "Tell your team if", body: "You can't keep fluids down, you're eating very little for several days, or you're losing weight. Your check-ins help them spot this, and they may have medicines that help." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "hydration-bowels",
    title: b("Drinking enough and keeping bowels moving", "पर्याप्त पानी और पेट साफ़ रखना"),
    summary: b("Fluids, fibre and movement to prevent constipation after surgery.", "सर्जरी के बाद कब्ज़ से बचने के लिए पानी, फ़ाइबर और चलना।"),
    discipline: "nutrition",
    minutes: 2,
    stages: ["surgery", "home"],
    keywords: ["constipation", "kabz", "kabj", "pet saaf", "motion", "stool", "toilet", "water", "pani", "hydration", "कब्ज़", "पानी", "fibre", "bowel"],
    sections: [
      { heading: "Why it happens", body: "Pain medicines, less movement and eating less often slow the bowels after surgery." },
      { heading: "What helps", body: "Regular sips of water through the day unless you've been told to limit fluids; fruit, vegetables, whole grains as your appetite allows; short walks; and any stool softener your team prescribed." },
      { heading: "Tell your team", body: "If you haven't opened your bowels for three days or more, have tummy swelling or pain, or are vomiting. After bowel surgery, follow your surgeon's specific diet advice." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "moving-early",
    title: b("Why moving early helps", "जल्दी चलना-फिरना क्यों मदद करता है"),
    summary: b("Gentle movement after surgery, and how to build up safely.", "सर्जरी के बाद हल्की हरकत, और सुरक्षित तरीके से बढ़ाना।"),
    discipline: "physiotherapy",
    minutes: 3,
    stages: ["surgery", "home", "life"],
    keywords: ["walk", "walking", "exercise", "move", "physio", "chalna", "tehalna", "kasrat", "exercise kab", "चलना", "कसरत", "व्यायाम", "arm", "shoulder", "lifting", "stiff"],
    sections: [
      { heading: "Why it matters", body: "Moving helps your lungs, circulation, bowels and mood, and stops joints getting stiff." },
      { heading: "Start small", body: "Short walks around the house several times a day, building up a little at a time. Rest is part of recovery too." },
      { heading: "Listen to your body", body: "Mild tiredness and a gentle stretch are fine. Sharp pain, dizziness, breathlessness or new bleeding mean stop and rest, and tell your team if it doesn't settle." },
      { heading: "Lifting and specific exercises", body: "Your surgeon or physio will tell you what not to lift and for how long, and which exercises suit your operation. The Guided section unlocks exercises at the right time for you." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "worry-is-normal",
    title: b("It's normal to feel up and down", "उतार-चढ़ाव महसूस करना सामान्य है"),
    summary: b("Emotions after a cancer diagnosis and surgery, and what helps.", "कैंसर और सर्जरी के बाद की भावनाएं, और क्या मदद करता है।"),
    discipline: "psychology",
    minutes: 3,
    stages: ["prepare", "home", "life"],
    keywords: ["worry", "anxiety", "anxious", "scared", "fear", "sad", "depressed", "crying", "mood", "chinta", "dar", "ghabrahat", "udaas", "चिंता", "डर", "उदास", "घबराहट", "stress", "tension", "sleep", "neend"],
    sections: [
      { heading: "You're not alone", body: "Fear, sadness, irritability, numbness and relief can all come and go. Waiting for results is often especially hard." },
      { heading: "Things that may help", body: "Talking to someone you trust; short breathing or meditation practices; keeping a simple daily routine; small amounts of activity; limiting late-night internet searching." },
      { heading: "When to ask for more support", body: "If low mood or worry is there most days for two weeks, stops you sleeping or eating, or you feel hopeless, tell your team. If you ever think about harming yourself, call the helpline in 'Need help now?' straight away." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "talking-with-family",
    title: b("Talking with family about how you feel", "परिवार से अपनी भावनाओं के बारे में बात करना"),
    summary: b("Sharing what you need, and letting others help.", "अपनी ज़रूरतें बताना, और दूसरों को मदद करने देना।"),
    discipline: "psychology",
    minutes: 2,
    stages: ["meet", "home"],
    keywords: ["family", "parivar", "talk", "children", "husband", "wife", "son", "daughter", "help", "support", "परिवार", "बात", "bachche"],
    sections: [
      { heading: "Families want to help", body: "Often they don't know how. Telling them one specific thing, 'please sit with me while I walk', can be easier than a general 'I'm fine'." },
      { heading: "Share the load", body: "A family member can join PRAANA with your invite code and help with check-ins, so you don't need to repeat updates on every call." },
      { heading: "Your pace", body: "You decide how much to share and when. It's okay to say you don't want to talk right now." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "pathology-next-steps",
    title: b("Your pathology report and next steps", "आपकी पैथोलॉजी रिपोर्ट और अगले क़दम"),
    summary: b("What the report after surgery is, and what conversations to expect.", "सर्जरी के बाद की रिपोर्ट क्या है, और किन बातों की उम्मीद करें।"),
    discipline: "oncology",
    minutes: 3,
    stages: ["home", "life"],
    keywords: ["pathology", "report", "biopsy", "results", "histopathology", "hpe", "stage", "chemo", "radiation", "next treatment", "report kab", "रिपोर्ट", "नतीजे", "कीमो", "further treatment", "tumour", "margin", "nodes"],
    sections: [
      { heading: "What it is", body: "After surgery, the tissue removed is examined in the lab. The report describes the tumour, how far it had spread locally, the lymph nodes, and the edges (margins)." },
      { heading: "When", body: "It often takes one to two weeks. Your team usually discusses it at a follow-up visit rather than over the phone." },
      { heading: "What happens next", body: "Your team, often at a meeting of several specialists, uses the report to recommend whether further treatment like chemotherapy, radiotherapy or hormone therapy is advised. Write down your questions beforehand and bring someone with you." },
      { heading: "Worry while waiting", body: "Waiting is hard. The breathing and meditation sessions may help, and you can send questions to your team from the Care team page." },
    ],
    reviewedNote: REVIEW,
  },
  {
    slug: "caring-for-carer",
    title: b("Looking after yourself as a caregiver", "देखभाल करने वाले के रूप में अपना ख़्याल"),
    summary: b("Practical help for family members supporting someone after surgery.", "सर्जरी के बाद किसी की देखभाल करने वाले परिवार के लिए व्यावहारिक मदद।"),
    discipline: "caregiving",
    minutes: 3,
    stages: ["surgery", "home", "life"],
    keywords: ["caregiver", "carer", "family", "tired", "burnout", "dekhbhal", "देखभाल", "thakan", "थकान", "helping", "support"],
    sections: [
      { heading: "Your role matters", body: "In many Indian families, recovery happens with family in the room. Your observations, appetite, mood, how they walk, are valuable. You can submit check-ins on their behalf in PRAANA." },
      { heading: "Practical help", body: "Keep the medicine list and timings in the Medicines screen. Help with short walks and exercises, and watch for warning signs listed in 'When to call your care team'." },
      { heading: "Your own health", body: "Eat, sleep and take breaks. Share tasks with others. Feeling exhausted or low is common. The caregiver reset session and the helpline are for you too." },
    ],
    reviewedNote: REVIEW,
  },
];

const BY_SLUG = new Map(ARTICLES.map((a) => [a.slug, a]));
export const getArticle = (slug: string) => BY_SLUG.get(slug);

const normalise = (s: string) => s.normalize("NFC").toLowerCase();
const tokens = (s: string) =>
  normalise(s)
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((t) => t.length > 2);

/** Keyword scoring across English, Hindi and Hinglish. Returns best matches, highest first. */
export function searchArticles(query: string, n = 3): Article[] {
  const q = normalise(query).trim();
  if (!q) return [];
  const qTokens = new Set(tokens(q));
  const scored = ARTICLES.map((a) => {
    let score = 0;
    for (const k of a.keywords) {
      const kw = normalise(k);
      if (kw.includes(" ")) {
        if (q.includes(kw)) score += 4;
      } else if (qTokens.has(kw)) score += 3;
      else if (kw.length > 3 && [...qTokens].some((t) => t.startsWith(kw) || kw.startsWith(t))) score += 1;
    }
    const title = normalise(`${a.title.en} ${a.title.hi}`);
    for (const t of qTokens) if (title.includes(t)) score += 2;
    return { a, score };
  });
  return scored
    .filter((s) => s.score >= 3)
    .sort((x, y) => y.score - x.score)
    .slice(0, n)
    .map((s) => s.a);
}
