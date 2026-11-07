import { describe, expect, it } from "vitest";
import { computePriority, domainTrends, isWorsening, stageLabel, summarizeRules, type PriorityInput, type TrendCheckin } from "./trends";

const NOW = new Date("2026-10-13T06:00:00Z");
const c = (daysAgo: number, over: Partial<TrendCheckin> = {}): TrendCheckin => ({
  createdAt: new Date(NOW.getTime() - daysAgo * 86_400_000),
  pain: null,
  appetite: null,
  nausea: null,
  mobility: null,
  sleep: null,
  mood: null,
  anxiety: null,
  temperatureC: null,
  wound: null,
  medsTaken: null,
  triage: "none",
  triageReasons: [],
  ...over,
});

describe("stageLabel", () => {
  it("covers the journey", () => {
    expect(stageLabel(null, null, "2026-10-13")).toBe("Surgery date not set");
    expect(stageLabel("2026-11-30", null, "2026-10-13")).toBe("Meet the care team");
    expect(stageLabel("2026-10-18", null, "2026-10-13")).toBe("Preparing for surgery");
    expect(stageLabel("2026-10-12", null, "2026-10-13")).toBe("Surgery / in hospital");
    expect(stageLabel("2026-10-07", "2026-10-09", "2026-10-13")).toBe("Recovering at home");
    expect(stageLabel("2026-08-01", "2026-08-05", "2026-10-13")).toBe("Back to what matters");
  });
});

describe("computePriority", () => {
  const base: PriorityInput = { openAlertLevel: null, dayOffset: 5, silentDays: 0, recent: [], unansweredQuestions: 0 };
  it("orders urgent > review > silent > worsening > question > stable", () => {
    expect(computePriority({ ...base, openAlertLevel: "urgent", openAlertReasons: ["Temperature 38.4°C"] })).toEqual({ priority: "urgent", reason: "Temperature 38.4°C" });
    expect(computePriority({ ...base, openAlertLevel: "review" }).priority).toBe("review");
    expect(computePriority({ ...base, silentDays: 3 }).priority).toBe("silent");
    expect(computePriority({ ...base, silentDays: null }).reason).toMatch(/No check-ins yet/);
    expect(computePriority({ ...base, recent: [{ pain: 2, appetite: 0 }, { pain: 3, appetite: 0 }, { pain: 5, appetite: 0 }] }).priority).toBe("worsening");
    expect(computePriority({ ...base, unansweredQuestions: 2 }).reason).toBe("2 unanswered questions");
    expect(computePriority(base).priority).toBe("stable");
  });
  it("pre-op silence is not flagged", () => {
    expect(computePriority({ ...base, dayOffset: -5, silentDays: null }).priority).toBe("stable");
  });
});

describe("isWorsening", () => {
  it("detects persistent poor appetite", () => {
    expect(isWorsening([{ pain: 3, appetite: 3 }, { pain: 3, appetite: 4 }])).toMatch(/Eating very little/);
    expect(isWorsening([{ pain: 3, appetite: 1 }, { pain: 2, appetite: 3 }])).toBeNull();
  });
});

describe("domainTrends", () => {
  it("compares first and second half", () => {
    const t = domainTrends([c(4, { pain: 6, mood: 2 }), c(3, { pain: 5, mood: 2 }), c(2, { pain: 4, mood: 2 }), c(1, { pain: 3, mood: 2 })]);
    expect(t.find((x) => x.key === "pain")).toMatchObject({ direction: "down", arrow: "↓", first: 6, last: 3 });
    expect(t.find((x) => x.key === "mood")?.direction).toBe("flat");
  });
});

describe("summarizeRules", () => {
  it("handles no data", () => {
    expect(summarizeRules([], { now: NOW }).text).toBe("No check-ins recorded yet.");
    expect(summarizeRules([c(10, { pain: 2 })], { now: NOW }).text).toMatch(/No check-ins in the last 7 days/);
  });

  it("describes trends, temperature, flags and adherence", () => {
    const newestFirst = [
      c(0, { pain: 7, appetite: 3, temperatureC: 37.8, wound: "redness", triage: "review", triageReasons: ["Pain 7/10"] }),
      c(1, { pain: 5, appetite: 3 }),
      c(2, { pain: 4, appetite: 2, reporterRole: "caregiver" }),
      c(3, { pain: 3, appetite: 1 }),
    ];
    const r = summarizeRules(newestFirst, { now: NOW, adherence: { taken: 9, skipped: 1, expected: 10 }, dayOffset: 9 });
    expect(r.text).toMatch(/Reported worse: pain, eating difficulty/);
    expect(r.bullets.join("\n")).toMatch(/Pain ↑ worsening \(3\/10 → 7\/10\)/);
    expect(r.bullets.join("\n")).toMatch(/Highest temperature reported 37.8°C \(raised\)/);
    expect(r.bullets.join("\n")).toMatch(/9\/10 \(90%\)/);
    expect(r.bullets.join("\n")).toMatch(/Checked in on 4 of the last 7 days/);
    expect(r.bullets.join("\n")).toMatch(/1 update written by a caregiver/);
    // never diagnostic language
    expect(JSON.stringify(r)).not.toMatch(/infection|diagnos|prescribe/i);
  });
});
