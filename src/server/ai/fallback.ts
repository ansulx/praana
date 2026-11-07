import "server-only";
import type { CheckinFields, FieldKey, StructuredDraft } from "@/lib/checkin";
import { extractTemperature, scanText } from "@/lib/safety/red-flags";

/**
 * Rule-based structurer used when AI is unavailable (no key, timeout, outage, or the
 * patient declined AI processing). Conservative: it only fills a domain when a phrase
 * clearly supports it, and the patient confirms everything before it is saved.
 */

type Rule = { field: FieldKey; value: CheckinFields[FieldKey]; re: RegExp };

const B = "(?<![\\p{L}\\p{M}])";
const E = "(?![\\p{L}\\p{M}])";
const r = (src: string) => new RegExp(`${B}(?:${src})${E}`, "iu");

// Order matters: the first rule that matches for a field wins, so specific beats generic.
const RULES: Rule[] = [
  // pain
  { field: "pain", value: 0, re: r("no pain|pain free|pain-free|dard nahi|dard nahin|koi dard nahi|दर्द नहीं|कोई दर्द नहीं") },
  { field: "pain", value: 9, re: r("unbearable|worst pain|excruciating|असहनीय|sahan nahi") },
  { field: "pain", value: 7, re: r("severe pain|a lot of pain|very painful|bahut dard|bahut zyada dard|बहुत दर्द") },
  { field: "pain", value: 2, re: r("mild pain|little pain|slight pain|bit of pain|halka dard|thoda dard|हल्का दर्द|थोड़ा दर्द") },
  // appetite
  { field: "appetite", value: 4, re: r("can'?t eat|cannot eat|not eating|unable to eat|nothing to eat|kuch nahi khaya|kuch nahi kha|कुछ नहीं खाया|खा नहीं पा") },
  { field: "appetite", value: 3, re: r("ate very little|eating very little|barely eat|bahut kam khaya|bahut kam kha|बहुत कम खाया") },
  { field: "appetite", value: 2, re: r("ate half|half my|half of my|aadha khaya|आधा खाया") },
  { field: "appetite", value: 1, re: r("ate less|eating less|less appetite|low appetite|kam khaya|bhookh kam|भूख कम|कम खाया") },
  { field: "appetite", value: 0, re: r("ate well|eating well|good appetite|ate normally|achha khaya|accha khaya|अच्छा खाया|ठीक से खाया") },
  // nausea
  { field: "nausea", value: 0, re: r("no nausea|no vomiting|ulti nahi|उल्टी नहीं") },
  { field: "nausea", value: 4, re: r("can'?t keep (?:anything|water|fluids) down|vomiting (?:all day|again and again)|baar baar ulti|बार-बार उल्टी|बार बार उल्टी") },
  { field: "nausea", value: 3, re: r("vomit(?:ed|ing)?|threw up|throwing up|ulti|उल्टी") },
  { field: "nausea", value: 2, re: r("nausea|nauseous|queasy|ji machla|jee machla|जी मिचला|मतली") },
  // mobility
  { field: "mobility", value: 4, re: r("can'?t get up|cannot get up|unable to get up|bedridden|uth nahi pa|उठ नहीं पा") },
  { field: "mobility", value: 3, re: r("in bed all day|stayed in bed|mostly in bed|bistar par|bistar pe|बिस्तर पर") },
  { field: "mobility", value: 3, re: r("can'?t walk|couldn'?t walk|cannot walk|not walking|unable to walk|chal nahi pa|चल नहीं पा") },
  { field: "mobility", value: 1, re: r("walked|went for a walk|walking|tehla|tahla|tehal|chali|chala|टहल|चली|चला") },
  // sleep
  { field: "sleep", value: 0, re: r("slept well|good sleep|slept fine|achhi neend|acchi neend|अच्छी नींद") },
  { field: "sleep", value: 4, re: r("didn'?t sleep at all|no sleep at all|bilkul neend nahi|बिल्कुल नींद नहीं") },
  { field: "sleep", value: 3, re: r("couldn'?t sleep|could not sleep|no sleep|hardly slept|barely slept|neend nahi|नींद नहीं") },
  { field: "sleep", value: 2, re: r("restless night|woke up (?:many|several) times|disturbed sleep|bechain|बेचैन") },
  // mood
  { field: "mood", value: 4, re: r("hopeless|nirash|निराश") },
  { field: "mood", value: 3, re: r("very low|very sad|depressed|crying|ro rahi|ro raha|बहुत उदास|रो रही") },
  { field: "mood", value: 2, re: r("not happy|sad|low mood|feeling low|feeling down|udaas|udas|उदास") },
  { field: "mood", value: 0, re: r("feeling good|feel good|happy|cheerful|feeling better|khush|achha lag|अच्छा लग|खुश") },
  // anxiety
  { field: "anxiety", value: 4, re: r("panic|panicking|overwhelmed|bahut ghabrahat|बहुत घबराहट") },
  { field: "anxiety", value: 2, re: r("worried|anxious|scared|afraid|nervous|tension|chinta|dar lag|ghabrahat|चिंता|डर|घबराहट") },
  // wound
  { field: "wound", value: "opening", re: r("wound (?:has )?opened|stitches (?:came out|opened)|taanke khul|tanke khul|टांके खुल") },
  { field: "wound", value: "bleeding", re: r("wound (?:is )?bleeding|bleeding from (?:the )?wound|ghaav se khoon|घाव से खून") },
  { field: "wound", value: "discharge", re: r("pus|discharge|oozing|leaking|mavaad|mawad|मवाद") },
  { field: "wound", value: "swelling", re: r("swollen|swelling|sujan|soojan|सूजन") },
  { field: "wound", value: "redness", re: r("red(?:ness)? around|looks red|laal|लाल") },
  { field: "wound", value: "healing_well", re: r("wound (?:looks )?(?:fine|clean|dry|good)|healing well|ghaav theek|घाव ठीक") },
  // medicines
  { field: "medsTaken", value: "none", re: r("didn'?t take (?:any|my) (?:medicine|medicines|tablets|meds)|no medicines? taken|dawai nahi li|दवा नहीं ली") },
  { field: "medsTaken", value: "some", re: r("forgot (?:my )?(?:medicine|tablet|dose)|missed (?:a |my |one )?(?:dose|medicine|tablet)|dawai bhool|दवा भूल") },
  { field: "medsTaken", value: "all", re: r("took (?:all )?my (?:medicines|medicine|tablets|meds)|took all|dawai li|dawa li|दवा ली|दवाई ली") },
];

const PAIN_NUMBER = /(?:pain|dard|दर्द)[^\d]{0,15}(\d{1,2})(?:\s*(?:\/|out of)\s*10)?/iu;

export function structureWithRules(freeText: string): StructuredDraft {
  const text = freeText.normalize("NFC");
  const fields: Partial<CheckinFields> = {};
  const evidence: StructuredDraft["evidence"] = {};

  const painNum = text.match(PAIN_NUMBER);
  if (painNum) {
    const n = Number(painNum[1]);
    if (n >= 0 && n <= 10) {
      fields.pain = n;
      evidence.pain = painNum[0];
    }
  }

  for (const rule of RULES) {
    if (fields[rule.field] !== undefined) continue;
    const m = text.match(rule.re);
    if (m) {
      (fields as Record<string, unknown>)[rule.field] = rule.value;
      evidence[rule.field] = m[0];
    }
  }

  const temp = extractTemperature(text);
  if (temp !== null) {
    fields.temperatureC = temp;
    evidence.temperatureC = String(temp);
  }

  const concerns = scanText(text)
    .filter((x) => x.level !== "watch")
    .map((x) => x.en);

  return {
    fields,
    evidence,
    summary: buildSummary(text, fields),
    concerns,
    source: text.trim() ? "fallback" : "none",
  };
}

function buildSummary(text: string, f: Partial<CheckinFields>): string {
  const parts: string[] = [];
  if (f.pain !== undefined && f.pain !== null) parts.push(`pain ${f.pain}/10`);
  if (f.appetite !== undefined && f.appetite !== null) parts.push(["eating normally", "eating a little less", "eating about half", "eating very little", "unable to eat"][f.appetite]);
  if (f.nausea) parts.push(["", "mild nausea", "nausea", "some vomiting", "unable to keep fluids down"][f.nausea]);
  if (f.mobility !== undefined && f.mobility !== null) parts.push(["moving as usual", "walking", "short walks only", "mostly in bed", "unable to get up unaided"][f.mobility]);
  if (f.sleep !== undefined && f.sleep !== null && f.sleep >= 2) parts.push("poor sleep");
  if (f.mood !== undefined && f.mood !== null && f.mood >= 2) parts.push("low mood");
  if (f.anxiety !== undefined && f.anxiety !== null && f.anxiety >= 2) parts.push("worried");
  if (f.wound && f.wound !== "no_wound") parts.push(`wound: ${f.wound.replace("_", " ")}`);
  if (f.temperatureC) parts.push(`temperature ${f.temperatureC}°C`);
  if (!parts.length) {
    const snippet = text.trim().slice(0, 160);
    return snippet ? `Patient wrote: "${snippet}${text.trim().length > 160 ? "…" : ""}"` : "";
  }
  const s = parts.filter(Boolean).join(", ");
  return `Reports ${s}.`;
}
