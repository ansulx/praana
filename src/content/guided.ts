import type { SurgeryType } from "@/server/db/schema";

/**
 * Guided recovery library. Written conservatively for home use after cancer surgery.
 * Nothing here replaces the patient's own surgeon or physiotherapist: every session tells
 * the patient to follow their team's instructions where they differ, and to stop if unwell.
 */

export type Bi = { en: string; hi: string };

export type GuidedCategory = "breathing" | "meditation" | "yoga" | "physio" | "prehab" | "sleep" | "caregiver";

export type GuidedStep = {
  title: Bi;
  text: Bi;
  seconds: number;
  kind: "breath" | "move" | "rest" | "reflect";
  /** Breath pacing in seconds — drives the animated circle. */
  breath?: { inhale: number; hold?: number; exhale: number; holdAfter?: number };
  reps?: number;
};

export type GuidedSession = {
  slug: string;
  title: Bi;
  summary: Bi;
  category: GuidedCategory;
  minutes: number;
  intensity: "gentle" | "light" | "moderate";
  audience: "patient" | "caregiver" | "both";
  expert: string;
  surgeryTypes?: SurgeryType[];
  excludeSurgeryTypes?: SurgeryType[];
  /** Days relative to surgery (0 = surgery day). */
  window: { fromDay?: number; toDay?: number };
  requiresNoDrain?: boolean;
  /** Locked when today's pain is above this. */
  maxPain?: number;
  /** Involves physical movement (locked when the team needs to review first). */
  movement: boolean;
  benefits: Bi[];
  safety: Bi[];
  steps: GuidedStep[];
};

const b = (en: string, hi: string): Bi => ({ en, hi });

export const CATEGORY_LABELS: Record<GuidedCategory, Bi> = {
  breathing: b("Breathing", "श्वास"),
  meditation: b("Meditation", "ध्यान"),
  yoga: b("Gentle yoga", "हल्का योग"),
  physio: b("Physiotherapy", "फ़िज़ियोथेरेपी"),
  prehab: b("Before surgery", "सर्जरी से पहले"),
  sleep: b("Sleep", "नींद"),
  caregiver: b("For caregivers", "देखभाल करने वालों के लिए"),
};

export const FOLLOW_TEAM_NOTE = b(
  "These sessions are general guidance. If your surgeon or physiotherapist has given you different instructions, follow theirs.",
  "ये सत्र सामान्य मार्गदर्शन हैं। अगर आपके सर्जन या फ़िज़ियोथेरेपिस्ट ने अलग निर्देश दिए हैं, तो उन्हीं का पालन करें।",
);

const STOP_GENERAL = b(
  "Stop if you feel sharp pain, dizziness, chest pain, breathlessness or new bleeding.",
  "तेज़ दर्द, चक्कर, सीने में दर्द, सांस फूलना या नया ख़ून आने पर तुरंत रुकें।",
);
const STOP_BREATH = b(
  "If you feel light-headed, return to normal breathing.",
  "हल्का चक्कर लगे तो सामान्य सांस लेने लगें।",
);

const ABDOMINAL: SurgeryType[] = ["colorectal", "gynaecologic", "upper_gi", "urologic", "thoracic", "other"];

export const GUIDED_SESSIONS: GuidedSession[] = [
  {
    slug: "diaphragmatic-breathing",
    title: b("Belly breathing", "पेट से सांस लेना"),
    summary: b("Slow, low breaths that settle the body. A good start to any day.", "धीमी, गहरी सांसें जो शरीर को शांत करती हैं। दिन की अच्छी शुरुआत।"),
    category: "breathing",
    minutes: 5,
    intensity: "gentle",
    audience: "both",
    expert: "Physiotherapy",
    window: {},
    movement: false,
    benefits: [b("Helps you relax", "आराम में मदद"), b("Encourages fuller breaths", "पूरी सांस लेने में मदद")],
    safety: [STOP_BREATH],
    steps: [
      { kind: "rest", seconds: 30, title: b("Get comfortable", "आराम से बैठें"), text: b("Sit or lie with support behind you. Rest one hand on your chest and one on your belly.", "सहारा लेकर बैठें या लेटें। एक हाथ सीने पर, एक पेट पर रखें।") },
      { kind: "breath", seconds: 120, breath: { inhale: 4, exhale: 6 }, title: b("Breathe into your belly", "पेट में सांस भरें"), text: b("Breathe in through your nose and let your belly rise under your hand. Breathe out slowly through soft lips.", "नाक से सांस लें, पेट को हाथ के नीचे उठने दें। होंठों से धीरे-धीरे छोड़ें।") },
      { kind: "breath", seconds: 90, breath: { inhale: 4, hold: 1, exhale: 6 }, title: b("Lengthen the out-breath", "सांस छोड़ना लंबा करें"), text: b("Keep the shoulders soft. Let each breath out be a little longer than the breath in.", "कंधे ढीले रखें। हर बार सांस छोड़ना लेने से थोड़ा लंबा हो।") },
      { kind: "reflect", seconds: 30, title: b("Notice", "महसूस करें"), text: b("Let your breathing return to normal. Notice how your body feels now.", "सांस को सामान्य होने दें। महसूस करें कि शरीर अब कैसा है।") },
    ],
  },
  {
    slug: "deep-breathing-cough",
    title: b("Deep breaths & supported cough", "गहरी सांस और सहारे से खांसी"),
    summary: b("Post-surgery lung care: a few deep breaths each hour you're awake, and a supported cough.", "सर्जरी के बाद फेफड़ों की देखभाल: जागते समय हर घंटे कुछ गहरी सांसें और सहारे से खांसना।"),
    category: "physio",
    minutes: 6,
    intensity: "gentle",
    audience: "patient",
    expert: "Physiotherapy",
    window: { fromDay: 0, toDay: 21 },
    movement: false,
    benefits: [b("Helps keep your lungs clear after surgery", "सर्जरी के बाद फेफड़ों को साफ़ रखने में मदद"), b("Coughing feels safer with support", "सहारे से खांसना सुरक्षित लगता है")],
    safety: [STOP_BREATH, b("If you cough up blood or feel chest pain, stop and contact your care team.", "खांसी में ख़ून आए या सीने में दर्द हो तो रुकें और केयर टीम से संपर्क करें।")],
    steps: [
      { kind: "rest", seconds: 30, title: b("Sit upright", "सीधे बैठें"), text: b("Sit up in a chair or on the edge of the bed. If your wound is on your chest or tummy, hold a folded towel or pillow over it.", "कुर्सी या बिस्तर के किनारे सीधे बैठें। घाव सीने या पेट पर हो तो उस पर मुड़ा तौलिया या तकिया रखें।") },
      { kind: "breath", seconds: 90, reps: 5, breath: { inhale: 4, hold: 3, exhale: 5 }, title: b("Five deep breaths", "पांच गहरी सांसें"), text: b("Breathe in slowly and deeply, hold for about 3 seconds, then let the air out gently.", "धीरे और गहरी सांस लें, लगभग 3 सेकंड रोकें, फिर धीरे से छोड़ें।") },
      { kind: "breath", seconds: 60, breath: { inhale: 3, exhale: 4 }, title: b("Rest breaths", "आराम की सांसें"), text: b("Breathe normally for a few breaths.", "कुछ सांसें सामान्य लें।") },
      { kind: "move", seconds: 60, reps: 2, title: b("Supported 'huff' or cough", "सहारे से 'हफ़' या खांसी"), text: b("Press the pillow firmly over your wound. Take a medium breath and huff out as if steaming a mirror, or give one strong cough.", "तकिये को घाव पर मज़बूती से दबाएं। मध्यम सांस लें और जैसे शीशे पर भाप करते हैं वैसे 'हफ़' करें, या एक बार ज़ोर से खांसें।") },
      { kind: "breath", seconds: 90, reps: 5, breath: { inhale: 4, hold: 3, exhale: 5 }, title: b("Five more deep breaths", "पांच और गहरी सांसें"), text: b("Repeat the slow deep breaths.", "धीमी गहरी सांसें दोहराएं।") },
      { kind: "reflect", seconds: 30, title: b("Done for this hour", "इस घंटे के लिए पूरा"), text: b("Many teams suggest repeating this every hour while awake in the first days. Follow what your team told you.", "कई टीमें शुरुआती दिनों में जागते समय हर घंटे यह दोहराने की सलाह देती हैं। अपनी टीम की सलाह मानें।") },
    ],
  },
  {
    slug: "calm-breath",
    title: b("Calm breath for worry", "चिंता के लिए शांत सांस"),
    summary: b("A short paced breath with a longer out-breath for anxious moments.", "घबराहट के पलों के लिए लंबी सांस छोड़ने वाला छोटा अभ्यास।"),
    category: "breathing",
    minutes: 4,
    intensity: "gentle",
    audience: "both",
    expert: "Psychology",
    window: {},
    movement: false,
    benefits: [b("May ease feelings of worry", "चिंता कम करने में मदद कर सकता है"), b("Can be done anywhere", "कहीं भी कर सकते हैं")],
    safety: [STOP_BREATH],
    steps: [
      { kind: "rest", seconds: 20, title: b("Pause", "रुकें"), text: b("Wherever you are, let your feet rest on the floor and your hands rest in your lap.", "जहां हैं वहीं, पैर ज़मीन पर और हाथ गोद में रखें।") },
      { kind: "breath", seconds: 180, breath: { inhale: 4, exhale: 6 }, title: b("In for 4, out for 6", "4 तक लें, 6 तक छोड़ें"), text: b("Follow the circle. Breathe in as it grows, out as it shrinks. If thoughts come, gently return to the circle.", "गोले के साथ चलें। बढ़े तो सांस लें, घटे तो छोड़ें। विचार आएं तो धीरे से गोले पर लौटें।") },
      { kind: "reflect", seconds: 40, title: b("Name one thing", "एक बात सोचें"), text: b("Name one thing you can see, one you can hear, and one you can feel.", "एक चीज़ जो दिख रही है, एक जो सुनाई दे रही है, और एक जो महसूस हो रही है।") },
    ],
  },
  {
    slug: "sleep-wind-down",
    title: b("Wind down for sleep", "सोने से पहले शांत होना"),
    summary: b("Gentle breathing and relaxation to help you settle at night.", "रात को शांत होने के लिए हल्की सांस और विश्राम।"),
    category: "sleep",
    minutes: 8,
    intensity: "gentle",
    audience: "both",
    expert: "Psychology",
    window: {},
    movement: false,
    benefits: [b("A calm routine before bed", "सोने से पहले शांत दिनचर्या"), b("Eases physical tension", "शरीर का तनाव कम करता है")],
    safety: [b("Take pain medicines as your team advised. Don't skip a night dose to 'try sleeping without it'.", "दर्द की दवा टीम की सलाह से लें, बिना दवा सोने की कोशिश में रात की ख़ुराक न छोड़ें।")],
    steps: [
      { kind: "rest", seconds: 45, title: b("Settle in", "आराम से लेटें"), text: b("Lie in your usual position with pillows supporting your wound. Dim the lights and put the phone screen down after starting.", "तकियों के सहारे अपनी सामान्य स्थिति में लेटें। रोशनी कम करें, शुरू करके फ़ोन नीचे रख दें।") },
      { kind: "breath", seconds: 150, breath: { inhale: 4, hold: 2, exhale: 7 }, title: b("Slow, soft breaths", "धीमी, हल्की सांसें"), text: b("Let each breath out be slow and long, like a sigh.", "हर सांस धीमे और लंबी छोड़ें, जैसे आह भरते हैं।") },
      { kind: "reflect", seconds: 120, title: b("Soften the body", "शरीर ढीला करें"), text: b("Let your forehead, jaw, shoulders, hands and legs feel heavy, one by one.", "माथा, जबड़ा, कंधे, हाथ और पैर, एक-एक करके भारी महसूस होने दें।") },
      { kind: "breath", seconds: 120, breath: { inhale: 4, exhale: 7 }, title: b("Drift", "धीरे-धीरे"), text: b("Keep breathing slowly. It's fine if you fall asleep before this ends.", "धीरे सांस लेते रहें। बीच में नींद आ जाए तो ठीक है।") },
    ],
  },
  {
    slug: "body-scan-healing",
    title: b("Body scan", "शरीर पर ध्यान"),
    summary: b("A 10-minute guided attention practice from head to toe.", "सिर से पैर तक 10 मिनट का ध्यान अभ्यास।"),
    category: "meditation",
    minutes: 10,
    intensity: "gentle",
    audience: "both",
    expert: "Psychology",
    window: {},
    movement: false,
    benefits: [b("A few quiet minutes for yourself", "अपने लिए कुछ शांत पल"), b("May help with tension and worry", "तनाव और चिंता में मदद कर सकता है")],
    safety: [b("If focusing on the wound area feels upsetting, skip that part and move on.", "घाव वाली जगह पर ध्यान देना परेशान करे तो उसे छोड़कर आगे बढ़ें।")],
    steps: [
      { kind: "breath", seconds: 60, breath: { inhale: 4, exhale: 6 }, title: b("Arrive", "शुरुआत"), text: b("Close your eyes if you like. Take a few slow breaths.", "चाहें तो आंखें बंद करें। कुछ धीमी सांसें लें।") },
      { kind: "reflect", seconds: 120, title: b("Head and face", "सिर और चेहरा"), text: b("Notice your forehead, eyes, cheeks and jaw. Let them soften without forcing.", "माथा, आंखें, गाल और जबड़ा महसूस करें। बिना ज़ोर लगाए ढीला होने दें।") },
      { kind: "reflect", seconds: 120, title: b("Shoulders and arms", "कंधे और बांहें"), text: b("Move your attention down to your shoulders, arms and hands. Notice warmth, weight, tingling, whatever is there.", "ध्यान कंधों, बांहों और हाथों पर लाएं। गर्मी, भारीपन, झुनझुनी, जो भी हो, उसे महसूस करें।") },
      { kind: "reflect", seconds: 120, title: b("Chest and belly", "सीना और पेट"), text: b("Notice the breath moving here. If there is discomfort, breathe gently around it rather than into it.", "यहां सांस का आना-जाना महसूस करें। असहजता हो तो उसके आसपास धीरे सांस लें।") },
      { kind: "reflect", seconds: 120, title: b("Legs and feet", "पैर और तलवे"), text: b("Let your attention travel down your legs to your feet, resting on the bed or floor.", "ध्यान पैरों से नीचे तलवों तक ले जाएं, जो बिस्तर या ज़मीन पर टिके हैं।") },
      { kind: "reflect", seconds: 60, title: b("The whole body", "पूरा शरीर"), text: b("Sense your whole body breathing. When ready, open your eyes.", "पूरे शरीर को सांस लेते महसूस करें। तैयार हों तो आंखें खोलें।") },
    ],
  },
  {
    slug: "pre-surgery-calm",
    title: b("Calm before surgery", "सर्जरी से पहले शांति"),
    summary: b("A short practice for the days and night before your operation.", "ऑपरेशन से पहले के दिनों और रात के लिए छोटा अभ्यास।"),
    category: "prehab",
    minutes: 7,
    intensity: "gentle",
    audience: "both",
    expert: "Psychology",
    window: { toDay: 0 },
    movement: false,
    benefits: [b("A steady routine when nerves are high", "घबराहट में एक स्थिर दिनचर्या"), b("Practice the breathing you'll use after surgery", "सर्जरी के बाद काम आने वाली सांस का अभ्यास")],
    safety: [b("Follow your hospital's fasting and medicine instructions exactly.", "अस्पताल के उपवास और दवा के निर्देशों का ठीक से पालन करें।")],
    steps: [
      { kind: "rest", seconds: 30, title: b("It's normal to feel nervous", "घबराहट होना सामान्य है"), text: b("Most people feel anxious before surgery. You're doing something to look after yourself right now.", "ज़्यादातर लोग सर्जरी से पहले घबराते हैं। आप अभी अपनी देखभाल के लिए कुछ कर रहे हैं।") },
      { kind: "breath", seconds: 150, breath: { inhale: 4, exhale: 6 }, title: b("Slow breathing", "धीमी सांस"), text: b("Follow the circle. Slow breaths, longer out than in.", "गोले के साथ सांस लें। धीमी सांस, छोड़ना लेने से लंबा।") },
      { kind: "reflect", seconds: 120, title: b("Picture the day", "दिन की कल्पना"), text: b("Picture arriving at the hospital, the team you've met, and someone you love waiting for you afterwards.", "अस्पताल पहुंचने, मिली हुई टीम, और बाद में इंतज़ार करते किसी अपने की कल्पना करें।") },
      { kind: "reflect", seconds: 60, title: b("Write down questions", "सवाल लिख लें"), text: b("If a worry keeps coming back, write it down to ask your team. You can also send it from the Care team page.", "कोई चिंता बार-बार आए तो टीम से पूछने के लिए लिख लें। 'केयर टीम' पेज से भेज भी सकते हैं।") },
    ],
  },
  {
    slug: "prehab-walk",
    title: b("Prehab daily walk", "सर्जरी से पहले रोज़ की सैर"),
    summary: b("Building stamina before surgery with a comfortable daily walk.", "सर्जरी से पहले आरामदायक रोज़ की सैर से ताक़त बढ़ाना।"),
    category: "prehab",
    minutes: 20,
    intensity: "light",
    audience: "patient",
    expert: "Physiotherapy",
    window: { toDay: -1 },
    movement: true,
    benefits: [b("Builds stamina for recovery", "रिकवरी के लिए ताक़त बढ़ती है"), b("Often helps with sleep and mood", "अक्सर नींद और मन में मदद करता है")],
    safety: [STOP_GENERAL, b("Walk at a pace where you can still talk in full sentences.", "इतनी रफ़्तार से चलें कि पूरे वाक्य बोल सकें।")],
    steps: [
      { kind: "move", seconds: 180, title: b("Easy start", "आसान शुरुआत"), text: b("Walk slowly for three minutes. Relax your shoulders and swing your arms gently.", "तीन मिनट धीरे चलें। कंधे ढीले रखें, बांहें हल्की हिलाएं।") },
      { kind: "move", seconds: 720, title: b("Comfortable pace", "आरामदायक रफ़्तार"), text: b("Walk a little faster, warm and slightly out of breath, but still able to talk.", "थोड़ा तेज़ चलें, गर्मी लगे और सांस थोड़ी तेज़ हो, पर बात कर सकें।") },
      { kind: "move", seconds: 180, title: b("Slow down", "धीमा करें"), text: b("Gradually slow your pace for the last few minutes.", "आख़िरी कुछ मिनटों में धीरे-धीरे रफ़्तार कम करें।") },
      { kind: "breath", seconds: 120, breath: { inhale: 4, hold: 2, exhale: 6 }, title: b("Breathing practice", "सांस का अभ्यास"), text: b("Sit and practise the deep breaths you'll use after surgery.", "बैठकर वे गहरी सांसें लें जो सर्जरी के बाद काम आएंगी।") },
    ],
  },
  {
    slug: "ankle-pumps",
    title: b("Ankle pumps & leg circulation", "टखने की कसरत और पैरों में रक्त संचार"),
    summary: b("Simple foot and leg movements to keep blood moving while you rest more than usual.", "ज़्यादा आराम के दिनों में ख़ून का बहाव बनाए रखने के लिए पैरों की आसान कसरत।"),
    category: "physio",
    minutes: 5,
    intensity: "gentle",
    audience: "patient",
    expert: "Physiotherapy",
    window: { fromDay: 0 },
    movement: true,
    benefits: [b("Keeps the leg muscles active", "पैरों की मांसपेशियां सक्रिय रहती हैं"), b("Can be done in bed or a chair", "बिस्तर या कुर्सी पर कर सकते हैं")],
    safety: [STOP_GENERAL, b("A new painful, swollen or red calf needs a call to your team. Don't exercise it.", "पिंडली में नया दर्द, सूजन या लालिमा हो तो कसरत न करें, टीम को फ़ोन करें।")],
    steps: [
      { kind: "move", seconds: 60, reps: 10, title: b("Ankle pumps", "टखने ऊपर-नीचे"), text: b("Point your toes away, then pull them towards you. Slow and steady, both feet.", "पंजे आगे की ओर, फिर अपनी ओर खींचें। दोनों पैरों से, धीरे-धीरे।") },
      { kind: "move", seconds: 60, reps: 10, title: b("Ankle circles", "टखने घुमाना"), text: b("Draw slow circles with each foot, five one way, five the other.", "हर पैर से धीमे गोले बनाएं, पांच एक तरफ़, पांच दूसरी तरफ़।") },
      { kind: "move", seconds: 60, reps: 10, title: b("Thigh squeezes", "जांघ कसना"), text: b("Press the back of your knee down into the bed, hold for 5 seconds, relax.", "घुटने का पिछला हिस्सा बिस्तर में दबाएं, 5 सेकंड रोकें, ढीला छोड़ें।") },
      { kind: "move", seconds: 60, reps: 10, title: b("Buttock squeezes", "कूल्हे कसना"), text: b("Squeeze your buttocks together, hold for 5 seconds, relax.", "कूल्हों को कसें, 5 सेकंड रोकें, ढीला छोड़ें।") },
      { kind: "breath", seconds: 60, breath: { inhale: 4, exhale: 5 }, title: b("Rest", "आराम"), text: b("Breathe easily. Many teams suggest repeating this every hour or two while awake.", "आराम से सांस लें। कई टीमें जागते समय हर एक-दो घंटे में दोहराने की सलाह देती हैं।") },
    ],
  },
  {
    slug: "bed-to-chair",
    title: b("Getting out of bed safely", "बिस्तर से सुरक्षित उठना"),
    summary: b("The 'log roll', a way to get up that protects a tummy or chest wound.", "'लॉग रोल', पेट या सीने के घाव को बचाते हुए उठने का तरीका।"),
    category: "physio",
    minutes: 5,
    intensity: "gentle",
    audience: "both",
    expert: "Physiotherapy",
    surgeryTypes: ABDOMINAL,
    window: { fromDay: 0, toDay: 42 },
    movement: true,
    benefits: [b("Less strain on your wound", "घाव पर कम खिंचाव"), b("Safer, more confident getting up", "सुरक्षित और आत्मविश्वास से उठना")],
    safety: [STOP_GENERAL, b("Have someone nearby the first few times. Sit on the edge for a moment before standing in case you feel dizzy.", "शुरुआत में किसी को पास रखें। खड़े होने से पहले कुछ पल किनारे पर बैठें, चक्कर न आए।")],
    steps: [
      { kind: "move", seconds: 45, title: b("Bend your knees", "घुटने मोड़ें"), text: b("Lying on your back, bend both knees so your feet are flat on the bed.", "पीठ के बल लेटे हुए दोनों घुटने मोड़ें, तलवे बिस्तर पर।") },
      { kind: "move", seconds: 45, title: b("Roll as one", "एक साथ करवट लें"), text: b("Hold a pillow over your wound. Roll onto your side, moving shoulders and hips together like a log.", "घाव पर तकिया रखें। कंधे और कूल्हे एक साथ घुमाते हुए करवट लें, जैसे लकड़ी का लट्ठा।") },
      { kind: "move", seconds: 60, title: b("Legs down, push up", "पैर नीचे, हाथ से उठें"), text: b("Lower your legs over the edge of the bed while pushing up with your arms to sit.", "पैर बिस्तर के किनारे से नीचे करें और हाथों से धक्का देकर बैठें।") },
      { kind: "rest", seconds: 60, title: b("Sit and breathe", "बैठें और सांस लें"), text: b("Sit for a minute. Take a few deep breaths. Only stand if you feel steady.", "एक मिनट बैठें। कुछ गहरी सांसें लें। स्थिर लगे तभी खड़े हों।") },
      { kind: "move", seconds: 60, title: b("Stand and walk to the chair", "खड़े होकर कुर्सी तक जाएं"), text: b("Stand tall, with help if needed, and walk to the chair. Reverse the steps to lie down.", "सीधे खड़े हों, ज़रूरत हो तो मदद लें, और कुर्सी तक चलें। लेटने के लिए उल्टे क्रम में करें।") },
    ],
  },
  {
    slug: "breast-arm-early",
    title: b("Arm & shoulder: early exercises", "बांह और कंधा: शुरुआती कसरत"),
    summary: b("Gentle movements for the first week after breast surgery, arm stays below shoulder height.", "स्तन सर्जरी के बाद पहले हफ़्ते की हल्की कसरत, बांह कंधे से नीचे रहे।"),
    category: "physio",
    minutes: 10,
    intensity: "gentle",
    audience: "patient",
    expert: "Physiotherapy",
    surgeryTypes: ["breast"],
    window: { fromDay: 1 },
    maxPain: 6,
    movement: true,
    benefits: [b("Helps keep the shoulder from stiffening", "कंधे को अकड़ने से बचाने में मदद"), b("Gentle on the drain and wound", "ड्रेन और घाव पर हल्की")],
    safety: [STOP_GENERAL, b("Keep your elbow below shoulder height until your team says otherwise. A gentle stretch is fine; pain is not.", "टीम के कहने तक कोहनी कंधे से नीचे रखें। हल्का खिंचाव ठीक है; दर्द नहीं।")],
    steps: [
      { kind: "move", seconds: 60, reps: 10, title: b("Hand pumps", "मुट्ठी खोलना-बंद करना"), text: b("With your arm resting on a pillow, open and close your hand firmly.", "बांह तकिये पर रखकर मुट्ठी कसकर खोलें और बंद करें।") },
      { kind: "move", seconds: 60, reps: 10, title: b("Elbow bends", "कोहनी मोड़ना"), text: b("Bend and straighten your elbow slowly.", "कोहनी धीरे-धीरे मोड़ें और सीधी करें।") },
      { kind: "move", seconds: 60, reps: 10, title: b("Shoulder shrugs", "कंधे उचकाना"), text: b("Lift both shoulders towards your ears, then let them drop and relax.", "दोनों कंधे कानों की ओर उठाएं, फिर ढीला छोड़ दें।") },
      { kind: "move", seconds: 60, reps: 10, title: b("Shoulder rolls", "कंधे घुमाना"), text: b("Roll your shoulders slowly backwards in circles.", "कंधों को धीरे-धीरे पीछे की ओर गोल घुमाएं।") },
      { kind: "move", seconds: 90, reps: 5, title: b("Shoulder-blade squeeze", "कंधे की हड्डियां मिलाना"), text: b("Sitting tall, gently squeeze your shoulder blades together, hold for 5 seconds, relax.", "सीधे बैठकर कंधे की हड्डियों को पीछे मिलाएं, 5 सेकंड रोकें, छोड़ें।") },
      { kind: "move", seconds: 90, reps: 5, title: b("Forward lift, below shoulder", "आगे उठाना, कंधे से नीचे"), text: b("Lift the arm forwards only as high as your shoulder, then lower slowly.", "बांह आगे सिर्फ़ कंधे की ऊंचाई तक उठाएं, फिर धीरे नीचे लाएं।") },
      { kind: "breath", seconds: 60, breath: { inhale: 4, exhale: 6 }, title: b("Rest and breathe", "आराम और सांस"), text: b("Rest your arm on a pillow and breathe. Teams often suggest 3 times a day.", "बांह तकिये पर रखें और सांस लें। टीमें अक्सर दिन में 3 बार कहती हैं।") },
    ],
  },
  {
    slug: "breast-arm-later",
    title: b("Arm & shoulder: wall crawl and more", "बांह और कंधा: दीवार पर उंगलियां चलाना"),
    summary: b("Restoring full shoulder movement once the drain is out and your physio agrees.", "ड्रेन निकलने और फ़िज़ियो की सहमति के बाद कंधे की पूरी हरकत वापस लाना।"),
    category: "physio",
    minutes: 12,
    intensity: "light",
    audience: "patient",
    expert: "Physiotherapy",
    surgeryTypes: ["breast"],
    window: { fromDay: 7 },
    requiresNoDrain: true,
    maxPain: 5,
    movement: true,
    benefits: [b("Works towards reaching overhead again", "फिर से ऊपर तक पहुंचने की दिशा में"), b("Helps everyday tasks like dressing", "कपड़े पहनने जैसे रोज़ के कामों में मदद")],
    safety: [STOP_GENERAL, b("Increased swelling of the arm or hand, or fluid under the wound, should be checked by your team.", "बांह या हाथ में बढ़ती सूजन या घाव के नीचे पानी हो तो टीम से जंचवाएं।")],
    steps: [
      { kind: "move", seconds: 60, reps: 10, title: b("Warm up", "वार्म-अप"), text: b("Shoulder rolls and shrugs, slowly.", "धीरे-धीरे कंधे घुमाएं और उचकाएं।") },
      { kind: "move", seconds: 150, reps: 5, title: b("Wall crawl, forwards", "दीवार पर उंगलियां, सामने"), text: b("Face a wall. Walk your fingers up the wall as far as is comfortable, hold for 5 seconds, walk them down. Mark your height to see progress.", "दीवार की ओर मुंह करें। उंगलियों को आराम से जितना हो ऊपर चलाएं, 5 सेकंड रोकें, नीचे लाएं। ऊंचाई पर निशान लगाएं।") },
      { kind: "move", seconds: 150, reps: 5, title: b("Wall crawl, sideways", "दीवार पर उंगलियां, बगल से"), text: b("Stand side-on to the wall and repeat with the arm on your surgery side.", "दीवार के बगल में खड़े होकर सर्जरी वाली तरफ़ की बांह से दोहराएं।") },
      { kind: "move", seconds: 120, reps: 5, title: b("Hands behind head", "हाथ सिर के पीछे"), text: b("Lying on your back, clasp your hands behind your head and let your elbows open out slowly towards the bed.", "पीठ के बल लेटकर हाथ सिर के पीछे बांधें और कोहनियों को धीरे से बिस्तर की ओर खोलें।") },
      { kind: "breath", seconds: 60, breath: { inhale: 4, exhale: 6 }, title: b("Rest", "आराम"), text: b("Rest your arm and breathe slowly.", "बांह को आराम दें और धीरे सांस लें।") },
    ],
  },
  {
    slug: "seated-neck-shoulder",
    title: b("Seated neck & shoulder release", "बैठकर गर्दन और कंधे को आराम"),
    summary: b("Gentle chair yoga to ease stiffness from resting in bed.", "बिस्तर पर ज़्यादा आराम से आई अकड़न के लिए कुर्सी पर हल्का योग।"),
    category: "yoga",
    minutes: 8,
    intensity: "gentle",
    audience: "both",
    expert: "Yoga & physiotherapy",
    excludeSurgeryTypes: ["head_neck"],
    window: { fromDay: 3 },
    maxPain: 6,
    movement: true,
    benefits: [b("Eases neck and upper-back stiffness", "गर्दन और ऊपरी पीठ की अकड़न कम"), b("Pairs movement with calm breathing", "हरकत के साथ शांत सांस")],
    safety: [STOP_GENERAL, b("Move only within a comfortable range. Don't twist your trunk if you had abdominal surgery.", "सिर्फ़ आरामदायक सीमा में हिलाएं। पेट की सर्जरी हुई हो तो धड़ न मोड़ें।")],
    steps: [
      { kind: "breath", seconds: 60, breath: { inhale: 4, exhale: 6 }, title: b("Sit tall", "सीधे बैठें"), text: b("Sit near the front of a sturdy chair, feet flat, hands on thighs.", "मज़बूत कुर्सी के आगे बैठें, पैर ज़मीन पर, हाथ जांघों पर।") },
      { kind: "move", seconds: 90, reps: 5, title: b("Chin to chest", "ठोड़ी सीने की ओर"), text: b("Breathe out and lower your chin gently. Breathe in and lift back to centre.", "सांस छोड़ते हुए ठोड़ी धीरे नीचे करें। सांस लेते हुए वापस बीच में।") },
      { kind: "move", seconds: 90, reps: 5, title: b("Ear to shoulder", "कान कंधे की ओर"), text: b("Tilt your right ear towards your right shoulder, then the left. Shoulders stay relaxed.", "दायां कान दाएं कंधे की ओर झुकाएं, फिर बायां। कंधे ढीले रहें।") },
      { kind: "move", seconds: 90, reps: 5, title: b("Look left, look right", "बाएं देखें, दाएं देखें"), text: b("Turn your head slowly to look over each shoulder.", "धीरे सिर घुमाकर हर कंधे के ऊपर देखें।") },
      { kind: "move", seconds: 90, reps: 5, title: b("Shoulder rolls", "कंधे घुमाना"), text: b("Roll the shoulders backwards in slow circles with the breath.", "सांस के साथ कंधों को धीरे पीछे की ओर घुमाएं।") },
      { kind: "reflect", seconds: 60, title: b("Rest", "विश्राम"), text: b("Close your eyes and notice the space in your neck and shoulders.", "आंखें बंद करें और गर्दन-कंधों में हल्कापन महसूस करें।") },
    ],
  },
  {
    slug: "anulom-vilom",
    title: b("Anulom vilom", "अनुलोम विलोम"),
    summary: b("Gentle alternate-nostril breathing, no breath holding.", "हल्का नाड़ी शोधन प्राणायाम, सांस रोके बिना।"),
    category: "yoga",
    minutes: 6,
    intensity: "gentle",
    audience: "both",
    expert: "Yoga",
    excludeSurgeryTypes: ["head_neck"],
    window: {},
    movement: false,
    benefits: [b("A familiar, calming routine", "एक जाना-पहचाना, शांत करने वाला अभ्यास")],
    safety: [STOP_BREATH, b("Skip this if your nose is blocked, use belly breathing instead.", "नाक बंद हो तो इसे छोड़ें, पेट से सांस लें।")],
    steps: [
      { kind: "rest", seconds: 30, title: b("Sit comfortably", "आराम से बैठें"), text: b("Sit upright with your back supported. Rest your left hand in your lap.", "पीठ के सहारे सीधे बैठें। बायां हाथ गोद में रखें।") },
      { kind: "breath", seconds: 120, breath: { inhale: 4, exhale: 4 }, title: b("Left in, right out", "बाएं से लें, दाएं से छोड़ें"), text: b("Close the right nostril with your thumb, breathe in through the left. Close the left with your ring finger, breathe out through the right.", "अंगूठे से दायां नथुना बंद करें, बाएं से सांस लें। अनामिका से बायां बंद करें, दाएं से छोड़ें।") },
      { kind: "breath", seconds: 120, breath: { inhale: 4, exhale: 4 }, title: b("Right in, left out", "दाएं से लें, बाएं से छोड़ें"), text: b("Now breathe in through the right, and out through the left. Keep it slow and soft.", "अब दाएं से लें, बाएं से छोड़ें। धीमा और हल्का रखें।") },
      { kind: "reflect", seconds: 60, title: b("Rest", "विश्राम"), text: b("Lower your hand and breathe naturally.", "हाथ नीचे करें और स्वाभाविक सांस लें।") },
    ],
  },
  {
    slug: "walking-plan",
    title: b("Recovery walk", "रिकवरी की सैर"),
    summary: b("A short, gradual walk at home. Most people build up a little each day.", "घर पर छोटी, धीरे-धीरे बढ़ने वाली सैर। ज़्यादातर लोग रोज़ थोड़ा बढ़ाते हैं।"),
    category: "physio",
    minutes: 10,
    intensity: "light",
    audience: "patient",
    expert: "Physiotherapy",
    window: { fromDay: 2 },
    maxPain: 6,
    movement: true,
    benefits: [b("Helps your energy come back", "ऊर्जा लौटने में मदद"), b("Supports bowels, lungs and circulation", "पाचन, फेफड़ों और रक्त संचार में सहायक")],
    safety: [STOP_GENERAL, b("Walk indoors or with someone at first. Rest when you need to. That's part of the plan.", "शुरुआत में घर के अंदर या किसी के साथ चलें। ज़रूरत हो तो रुकें। यह भी योजना का हिस्सा है।")],
    steps: [
      { kind: "move", seconds: 120, title: b("Slow start", "धीमी शुरुआत"), text: b("Walk slowly around your home. Stand tall and look ahead.", "घर में धीरे-धीरे चलें। सीधे खड़े रहें, आगे देखें।") },
      { kind: "move", seconds: 300, title: b("Steady walk", "स्थिर सैर"), text: b("Keep a comfortable pace. You should be able to talk while walking.", "आरामदायक रफ़्तार रखें। चलते हुए बात कर सकें।") },
      { kind: "move", seconds: 120, title: b("Slow down", "धीमा करें"), text: b("Slow down and find a chair.", "धीमे हों और कुर्सी पर पहुंचें।") },
      { kind: "breath", seconds: 60, breath: { inhale: 4, exhale: 6 }, title: b("Sit and breathe", "बैठें और सांस लें"), text: b("Rest and breathe. Tomorrow, you might add a minute, only if today felt okay.", "आराम करें और सांस लें। कल एक मिनट बढ़ा सकते हैं, अगर आज ठीक लगा हो।") },
    ],
  },
  {
    slug: "yoga-nidra-short",
    title: b("Short yoga nidra", "छोटा योग निद्रा"),
    summary: b("A lying-down guided rest, about 12 minutes.", "लेटकर किया जाने वाला निर्देशित विश्राम, लगभग 12 मिनट।"),
    category: "meditation",
    minutes: 12,
    intensity: "gentle",
    audience: "both",
    expert: "Yoga",
    window: {},
    movement: false,
    benefits: [b("Deep rest without needing to sleep", "बिना सोए गहरा आराम")],
    safety: [b("Use pillows so your wound is comfortable. It's fine to fall asleep.", "तकियों से घाव को आराम दें। नींद आ जाए तो ठीक है।")],
    steps: [
      { kind: "rest", seconds: 60, title: b("Lie down", "लेट जाएं"), text: b("Lie on your back or side with support. Let the body be still.", "सहारे के साथ पीठ या करवट के बल लेटें। शरीर को स्थिर होने दें।") },
      { kind: "reflect", seconds: 60, title: b("An intention", "एक संकल्प"), text: b("Silently say a simple wish for yourself, like 'I am resting and healing'.", "मन में अपने लिए एक सरल इच्छा कहें, जैसे 'मैं आराम कर रही/रहा हूँ'।") },
      { kind: "reflect", seconds: 240, title: b("Journey through the body", "शरीर की यात्रा"), text: b("Bring attention to the right hand, each finger, the arm… then the left side… the back… the front… the whole body.", "दाहिने हाथ, हर उंगली, बांह पर ध्यान लाएं… फिर बायां हिस्सा… पीठ… सामने… पूरा शरीर।") },
      { kind: "breath", seconds: 180, breath: { inhale: 4, exhale: 6 }, title: b("Count the breath", "सांस गिनें"), text: b("Count each breath out, from 27 down to 1. If you lose count, start again gently.", "हर बार सांस छोड़ते हुए 27 से 1 तक उल्टी गिनती करें। गिनती भूलें तो फिर से शुरू करें।") },
      { kind: "reflect", seconds: 120, title: b("A peaceful place", "एक शांत जगह"), text: b("Picture a place where you feel safe and at ease. Stay there for a while.", "ऐसी जगह की कल्पना करें जहां आप सुरक्षित और सहज महसूस करें। कुछ देर वहीं रहें।") },
      { kind: "reflect", seconds: 60, title: b("Return", "लौटना"), text: b("Repeat your intention. Move your fingers and toes. Roll to your side before getting up.", "संकल्प दोहराएं। उंगलियां हिलाएं। उठने से पहले करवट लें।") },
    ],
  },
  {
    slug: "caregiver-reset",
    title: b("Five-minute reset for caregivers", "देखभाल करने वालों के लिए पांच मिनट"),
    summary: b("Caring is tiring. A short pause for you.", "देखभाल थकाने वाली है। आपके लिए एक छोटा ठहराव।"),
    category: "caregiver",
    minutes: 5,
    intensity: "gentle",
    audience: "caregiver",
    expert: "Psychology",
    window: {},
    movement: false,
    benefits: [b("A moment to look after yourself", "अपनी देखभाल के लिए एक पल")],
    safety: [b("If you're feeling overwhelmed most days, please talk to someone. The helpline under 'Need help now?' is for you too.", "अगर ज़्यादातर दिन आप बहुत थका हुआ महसूस करते हैं तो किसी से बात करें, 'अभी मदद चाहिए?' की हेल्पलाइन आपके लिए भी है।")],
    steps: [
      { kind: "rest", seconds: 30, title: b("Step away", "थोड़ा हटें"), text: b("Find a spot where you can sit for five minutes. Everything can wait that long.", "पांच मिनट बैठने की जगह ढूंढें। इतनी देर सब रुक सकता है।") },
      { kind: "breath", seconds: 120, breath: { inhale: 4, exhale: 6 }, title: b("Breathe", "सांस लें"), text: b("Slow breaths with the circle. Let your shoulders drop.", "गोले के साथ धीमी सांसें। कंधे ढीले छोड़ें।") },
      { kind: "reflect", seconds: 90, title: b("Acknowledge", "स्वीकारें"), text: b("Notice what you're feeling, tired, worried, hopeful. All of it is okay.", "महसूस करें कि आप क्या अनुभव कर रहे हैं, थकान, चिंता, उम्मीद। सब ठीक है।") },
      { kind: "reflect", seconds: 60, title: b("One small thing", "एक छोटी बात"), text: b("Choose one small kind thing for yourself today: water, a meal, a call with a friend.", "आज अपने लिए एक छोटी अच्छी चीज़ चुनें: पानी, खाना, किसी दोस्त से बात।") },
    ],
  },
];

const BY_SLUG = new Map(GUIDED_SESSIONS.map((s) => [s.slug, s]));

export function getSession(slug: string): GuidedSession | undefined {
  return BY_SLUG.get(slug);
}

export function totalSeconds(s: GuidedSession): number {
  return s.steps.reduce((acc, st) => acc + st.seconds, 0);
}
