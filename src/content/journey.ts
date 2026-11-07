import { daysBetween, localYmd } from "@/lib/dates";
import type { Bi } from "./guided";

/** The product spine: five stages from meeting the team to life beyond surgery. */

export type StageKey = "meet" | "prepare" | "surgery" | "home" | "life";

export type JourneyTask = { key: string; title: Bi; detail: Bi };

export type JourneyStage = {
  key: StageKey;
  index: number;
  title: Bi;
  description: Bi;
  needs: Bi;
  tasks: JourneyTask[];
  /** Related content shown on the journey page. */
  sessions: string[];
  articles: string[];
};

const b = (en: string, hi: string): Bi => ({ en, hi });

export const JOURNEY_STAGES: JourneyStage[] = [
  {
    key: "meet",
    index: 1,
    title: b("Meet my care team", "अपनी केयर टीम से मिलें"),
    description: b("Know who is looking after you, what the plan is, and who to call.", "जानें कि आपकी देखभाल कौन कर रहा है, योजना क्या है, और किसे फ़ोन करना है।"),
    needs: b("Surgery plan, expectations, who to call", "सर्जरी की योजना, उम्मीदें, किसे फ़ोन करें"),
    tasks: [
      { key: "meet.team", title: b("Save my care team's numbers", "केयर टीम के नंबर सेव करें"), detail: b("Add at least one person you can call with questions, under Care team.", "'केयर टीम' में कम से कम एक व्यक्ति जोड़ें जिसे सवाल पूछ सकें।") },
      { key: "meet.plan", title: b("Understand my surgery plan", "अपनी सर्जरी की योजना समझें"), detail: b("Know the name of the operation, the date, and roughly how long you'll stay in hospital.", "ऑपरेशन का नाम, तारीख़, और अस्पताल में लगभग कितने दिन रहेंगे। यह जानें।") },
      { key: "meet.questions", title: b("Write down my questions", "अपने सवाल लिख लें"), detail: b("Keep a list for your next appointment, or send them from Care team.", "अगली मुलाक़ात के लिए सूची बनाएं, या 'केयर टीम' से भेजें।") },
      { key: "meet.family", title: b("Invite a family member", "परिवार के किसी सदस्य को जोड़ें"), detail: b("Share a family invite code from Settings so they can help with check-ins.", "'सेटिंग्स' से परिवार का कोड साझा करें ताकि वे हाल बताने में मदद कर सकें।") },
    ],
    sessions: ["diaphragmatic-breathing", "calm-breath"],
    articles: ["when-to-call", "talking-with-family"],
  },
  {
    key: "prepare",
    index: 2,
    title: b("Pre-surgery assessment & prep", "सर्जरी से पहले आकलन और तैयारी"),
    description: b("Medicines, allergies, fasting instructions, and getting home and mind ready — before you reach the hospital.", "दवाएं, एलर्जी, उपवास के निर्देश, और घर व मन की तैयारी — अस्पताल पहुंचने से पहले।"),
    needs: b("Pre-op checklist, nutrition, breathing, mental readiness", "प्री-ऑप सूची, पोषण, सांस, मानसिक तैयारी"),
    tasks: [
      {
        key: "prepare.meds",
        title: b("List every medicine I take", "जो दवाएं लेती हूँ उनकी सूची बनाएं"),
        detail: b("Name, dose, and when. Bring this to pre-anaesthesia check — your team needs the full list.", "नाम, खुराक, कब लेती हैं। प्री-एनेस्थीसिया चेक में साथ ले जाएं — टीम को पूरी सूची चाहिए।"),
      },
      {
        key: "prepare.allergies",
        title: b("Note allergies & past reactions", "एलर्जी और पुरानी प्रतिक्रियाएं लिखें"),
        detail: b("Medicines, latex, food. Tell anaesthesia and nursing before surgery day.", "दवाएं, लेटेक्स, खाना। सर्जरी से पहले एनेस्थीसिया और नर्सिंग को बताएं।"),
      },
      {
        key: "prepare.fasting",
        title: b("Know fasting & arrival instructions", "उपवास और आने के निर्देश जानें"),
        detail: b("When to stop eating/drinking and what time to reach. Ask if anything is unclear.", "खाना-पीना कब बंद करें और कब पहुंचना है। कुछ भी अस्पष्ट हो तो पूछें।"),
      },
      {
        key: "prepare.contact",
        title: b("Who comes with me & who to call", "साथ कौन आएगा और किसे फ़ोन करें"),
        detail: b("One family member for PAC and admission; emergency contact saved in PRAANA.", "PAC और एडमिशन के लिए एक परिवार सदस्य; आपातकालीन संपर्क PRAANA में सेव करें।"),
      },
      { key: "prepare.walk", title: b("Walk most days", "ज़्यादातर दिन टहलें"), detail: b("A comfortable daily walk builds stamina for recovery.", "रोज़ की आरामदायक सैर रिकवरी के लिए ताक़त बढ़ाती है।") },
      { key: "prepare.breathing", title: b("Practise deep breathing", "गहरी सांस का अभ्यास करें"), detail: b("Learn the breathing you'll use after surgery while you feel well.", "स्वस्थ रहते हुए वह सांस सीखें जो सर्जरी के बाद काम आएगी।") },
      { key: "prepare.nutrition", title: b("Protein at every meal", "हर भोजन में प्रोटीन"), detail: b("Dal, paneer, curd, eggs, soya. Your body needs protein to heal.", "दाल, पनीर, दही, अंडे, सोया, शरीर को ठीक होने के लिए प्रोटीन चाहिए।") },
      { key: "prepare.home", title: b("Get home ready", "घर तैयार करें"), detail: b("Things within easy reach, a chair with arms, loose front-opening clothes.", "चीज़ें आसान पहुंच में, हत्थे वाली कुर्सी, आगे से खुलने वाले ढीले कपड़े।") },
      { key: "prepare.bag", title: b("Pack my hospital bag", "अस्पताल का बैग तैयार करें"), detail: b("Reports, medicine list, ID, phone charger, comfortable clothes.", "रिपोर्ट, दवाओं की सूची, पहचान पत्र, फ़ोन चार्जर, आरामदायक कपड़े।") },
    ],
    sessions: ["prehab-walk", "pre-surgery-calm", "diaphragmatic-breathing"],
    articles: ["day-of-surgery", "eating-to-heal", "worry-is-normal"],
  },
  {
    key: "surgery",
    index: 3,
    title: b("Go through surgery", "सर्जरी"),
    description: b("The day itself and your hospital stay. Clarity, less fear.", "सर्जरी का दिन और अस्पताल में रहना। स्पष्टता, कम डर।"),
    needs: b("Clarity, less fear", "स्पष्टता, कम डर"),
    tasks: [
      { key: "surgery.breathing", title: b("Deep breaths every hour", "हर घंटे गहरी सांसें"), detail: b("Once awake, a few deep breaths each hour helps your lungs.", "होश आने के बाद हर घंटे कुछ गहरी सांसें फेफड़ों के लिए अच्छी हैं।") },
      { key: "surgery.moving", title: b("Move my feet and legs", "पैर और टांगें हिलाएं"), detail: b("Ankle pumps in bed, and sitting out when the team says it's okay.", "बिस्तर पर टखने की कसरत, और टीम की अनुमति पर कुर्सी पर बैठना।") },
      { key: "surgery.discharge", title: b("Understand my discharge plan", "डिस्चार्ज की योजना समझें"), detail: b("Medicines, wound and drain care, warning signs, and your follow-up date.", "दवाइयाँ, घाव और ड्रेन की देखभाल, चेतावनी के संकेत, और फ़ॉलो-अप की तारीख़।") },
    ],
    sessions: ["deep-breathing-cough", "ankle-pumps", "bed-to-chair"],
    articles: ["day-of-surgery", "when-to-call"],
  },
  {
    key: "home",
    index: 4,
    title: b("Recover at home", "घर पर रिकवरी"),
    description: b("Daily support, and someone watching the story between visits.", "रोज़ का सहारा, और विज़िट के बीच कोई आपकी कहानी देखता रहे।"),
    needs: b("Daily support, someone watching the story", "रोज़ का सहारा, कोई आपकी कहानी देखे"),
    tasks: [
      { key: "home.checkin", title: b("Check in every day", "रोज़ हाल बताएं"), detail: b("A short daily update builds the story your team can see.", "रोज़ का छोटा अपडेट वह कहानी बनाता है जो आपकी टीम देख सकती है।") },
      { key: "home.drain", title: b("Record drain output (if I have one)", "ड्रेन की मात्रा लिखें (अगर है)"), detail: b("Note the amount and colour each evening in your check-in.", "हर शाम हाल बताते समय मात्रा और रंग लिखें।") },
      { key: "home.walk", title: b("Walk a little more each day", "रोज़ थोड़ा ज़्यादा चलें"), detail: b("Short walks, building up gently.", "छोटी सैर, धीरे-धीरे बढ़ाते हुए।") },
      { key: "home.exercises", title: b("Do my exercises", "अपनी कसरत करें"), detail: b("The exercises your physio gave you, see Guided.", "फ़िज़ियो की बताई कसरत, 'अभ्यास' देखें।") },
      { key: "home.followup", title: b("Know my follow-up date", "फ़ॉलो-अप की तारीख़ जानें"), detail: b("Check it's on your Today screen. Bring your questions.", "देखें कि यह 'आज' स्क्रीन पर है। अपने सवाल साथ लाएं।") },
    ],
    sessions: ["walking-plan", "breast-arm-early", "deep-breathing-cough", "sleep-wind-down"],
    articles: ["wound-care", "drain-care", "when-to-call", "low-appetite"],
  },
  {
    key: "life",
    index: 5,
    title: b("Get back to what matters", "जो मायने रखता है, उसकी ओर लौटें"),
    description: b("Strength, confidence, and life beyond surgery.", "ताक़त, आत्मविश्वास, और सर्जरी के बाद का जीवन।"),
    needs: b("Strength, confidence, life beyond surgery", "ताक़त, आत्मविश्वास, सर्जरी के बाद का जीवन"),
    tasks: [
      { key: "life.results", title: b("Understand my results and next steps", "अपने नतीजे और अगले क़दम समझें"), detail: b("Your team will explain the pathology report and whether more treatment is planned.", "आपकी टीम पैथोलॉजी रिपोर्ट और आगे के इलाज के बारे में बताएगी।") },
      { key: "life.activity", title: b("Return to regular activity", "नियमित गतिविधि पर लौटें"), detail: b("Ask your team when you can drive, lift, work and exercise again.", "टीम से पूछें कि गाड़ी चलाना, वज़न उठाना, काम और व्यायाम कब शुरू करें।") },
      { key: "life.emotions", title: b("Look after my emotional health", "अपने मन का ख़्याल रखें"), detail: b("Feelings can catch up with you after treatment. Support is available.", "इलाज के बाद भावनाएं उमड़ सकती हैं। सहायता उपलब्ध है।") },
    ],
    sessions: ["walking-plan", "body-scan-healing", "yoga-nidra-short"],
    articles: ["pathology-next-steps", "worry-is-normal"],
  },
];

const BY_KEY = new Map(JOURNEY_STAGES.map((s) => [s.key, s]));
export const getStage = (key: StageKey) => BY_KEY.get(key)!;

export const ALL_TASK_KEYS = new Set(JOURNEY_STAGES.flatMap((s) => s.tasks.map((t) => t.key)));

/** Recovery window considered "at home" before moving on to life beyond surgery. */
export const HOME_UNTIL_DAY = 42;

export function computeStage(p: { surgeryDate: string | null; dischargeDate: string | null }, today: string = localYmd()): StageKey {
  if (!p.surgeryDate) return "meet";
  const day = daysBetween(p.surgeryDate, today); // negative before surgery
  if (day < -14) return "meet";
  if (day < 0) return "prepare";
  if (p.dischargeDate) {
    if (today < p.dischargeDate) return "surgery";
  } else if (day <= 2) {
    return "surgery";
  }
  if (day <= HOME_UNTIL_DAY) return "home";
  return "life";
}
