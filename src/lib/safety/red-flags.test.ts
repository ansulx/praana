import { describe, expect, it } from "vitest";
import { extractTemperature, normaliseTemperature, scanText, triage } from "./red-flags";

const codes = (text: string) => scanText(text).map((r) => r.code);

describe("scanText — urgent phrases", () => {
  it.each([
    ["I can't breathe properly since morning", "breathing"],
    ["i am not able to breathe", "breathing"],
    ["saans lene mein dikkat ho rahi hai", "breathing"],
    ["सांस नहीं आ रही", "breathing"],
    ["there is pain in my chest", "chest_pain"],
    ["seene mein dard hai", "chest_pain"],
    ["the dressing is soaked, bleeding won't stop", "heavy_bleeding"],
    ["khoon ruk nahi raha", "heavy_bleeding"],
    ["she fainted in the bathroom", "collapse"],
    ["my left calf pain is new", "leg_clot_signs"],
    ["I just want to die", "self_harm"],
    ["jeena nahi chahti ab", "self_harm"],
    ["मैं आत्महत्या के बारे में सोचती हूँ", "self_harm"],
    ["stitches came out this morning", "wound_opened"],
    ["fever with chills at night", "high_fever_text"],
  ])("%s → %s", (text, code) => {
    expect(codes(text)).toContain(code);
  });
});

describe("scanText — negation", () => {
  it.each([
    ["no fever today", "fever_text"],
    ["I don't have chest pain", "chest_pain"],
    ["bukhar nahi hai", "fever_text"],
    ["no bleeding from the wound", "bleeding_text"],
    ["no difficulty breathing", "breathing"],
    ["khoon nahi aa raha", "bleeding_text"],
  ])("%s does not flag %s", (text, code) => {
    expect(codes(text)).not.toContain(code);
  });

  it("negation does not leak across clauses", () => {
    expect(codes("no fever, but chest pain since an hour")).toContain("chest_pain");
    expect(codes("no fever lekin bahut khoon")).toContain("heavy_bleeding");
  });

  it("Hindi 'saans nahi' is inability, not negation", () => {
    expect(codes("saans nahi aa rahi")).toContain("breathing");
  });

  it("self-harm is never cancelled by negation", () => {
    expect(codes("I don't want to live like this")).toContain("self_harm");
  });

  it("does not match inside other words", () => {
    expect(codes("I did my breathing exercises and ate well")).toEqual([]);
    expect(codes("bloodwork was normal")).not.toContain("bleeding_text");
  });

  it("specific finding suppresses its generic cousin", () => {
    const c = codes("heavy bleeding through the dressing");
    expect(c).toContain("heavy_bleeding");
    expect(c).not.toContain("bleeding_text");
  });
});

describe("temperature", () => {
  it("converts Fahrenheit automatically", () => {
    expect(normaliseTemperature(100.4)).toEqual({ value: 38, note: "converted" });
  });
  it("rejects implausible values", () => {
    expect(normaliseTemperature(3.8).value).toBeNull();
    expect(normaliseTemperature(380).value).toBeNull();
  });
  it("extracts from free text", () => {
    expect(extractTemperature("temp was 38.6 last night")).toBe(38.6);
    expect(extractTemperature("bukhar 101 F tha")).toBe(38.3);
    expect(extractTemperature("walked 20 minutes")).toBeNull();
  });
});

describe("triage", () => {
  it("calm day is none", () => {
    const r = triage({ pain: 2, appetite: 1, nausea: 0, mobility: 1, sleep: 1, mood: 1, anxiety: 1, wound: "healing_well", medsTaken: "all", freeText: "Feeling better, walked twice." });
    expect(r.level).toBe("none");
    expect(r.reasons).toEqual([]);
  });

  it("fever ≥ 38 is urgent with emergency action", () => {
    const r = triage({ temperatureC: 38.2 });
    expect(r.level).toBe("urgent");
    expect(r.actions).toContain("emergency");
  });

  it("wound redness + raised temperature escalates to urgent", () => {
    expect(triage({ wound: "redness" }).level).toBe("watch");
    expect(triage({ wound: "redness", temperatureC: 37.7 }).level).toBe("urgent");
  });

  it("pain jump of 3+ since last check-in needs review", () => {
    const r = triage({ pain: 6 }, [{ pain: 2 }]);
    expect(r.level).toBe("review");
    expect(r.reasons.map((x) => x.code)).toContain("pain_jump");
  });

  it("persistent inability to keep fluids down is urgent", () => {
    expect(triage({ nausea: 4 }).level).toBe("review");
    expect(triage({ nausea: 4 }, [{ nausea: 3 }]).level).toBe("urgent");
  });

  it("low appetite streak needs three check-ins", () => {
    expect(triage({ appetite: 3 }, [{ appetite: 3 }]).level).toBe("none");
    expect(triage({ appetite: 3 }, [{ appetite: 3 }, { appetite: 4 }]).level).toBe("review");
  });

  it("self-harm language triggers mental-health action", () => {
    const r = triage({ freeText: "I feel like a burden, better off dead" });
    expect(r.level).toBe("urgent");
    expect(r.actions).toContain("mental_health");
  });

  it("implausible temperature asks to re-check instead of alarming", () => {
    const r = triage({ temperatureC: 3.8 });
    expect(r.level).toBe("watch");
    expect(r.reasons[0].code).toBe("temp_implausible");
  });

  it("measured temperature supersedes a text mention of fever", () => {
    const r = triage({ temperatureC: 37.0, freeText: "felt a bit of fever" });
    expect(r.reasons.map((x) => x.code)).not.toContain("fever_text");
  });

  it("reasons are sorted most severe first", () => {
    const r = triage({ pain: 5, wound: "opening" });
    expect(r.reasons[0].level).toBe("urgent");
  });
});
