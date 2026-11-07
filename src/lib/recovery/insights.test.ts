import { describe, expect, it } from "vitest";
import { assessRecovery, type InsightCheckin } from "./insights";
import { buildPlanFromInsights } from "./plan";

function ck(partial: Partial<InsightCheckin> & { createdAt: Date }): InsightCheckin {
  return {
    pain: null,
    appetite: null,
    nausea: null,
    mobility: null,
    sleep: null,
    mood: null,
    anxiety: null,
    wound: null,
    temperatureC: null,
    triage: "none",
    ...partial,
  };
}

describe("assessRecovery", () => {
  it("stays steady with light recent check-ins", () => {
    const now = Date.now();
    const r = assessRecovery(
      {
        dayOffset: 6,
        hasDrain: true,
        hasOpenUrgent: false,
        unansweredQuestions: 0,
        checkins: [
          ck({ createdAt: new Date(now - 2 * 3600_000), pain: 3, appetite: 1, mobility: 1, sleep: 1, mood: 1, anxiety: 1 }),
        ],
      },
      now,
    );
    expect(r.overall.level).toBe("steady");
    expect(r.heads).toHaveLength(6);
  });

  it("escalates wound + fever toward review without diagnosing", () => {
    const now = Date.now();
    const r = assessRecovery(
      {
        dayOffset: 9,
        hasDrain: true,
        hasOpenUrgent: false,
        unansweredQuestions: 0,
        checkins: [
          ck({
            createdAt: new Date(now - 3600_000),
            pain: 7,
            wound: "redness",
            temperatureC: 38.2,
            triage: "review",
          }),
        ],
      },
      now,
    );
    const wound = r.heads.find((h) => h.id === "wound")!;
    expect(wound.level).toBe("review");
    expect(wound.summary.en.toLowerCase()).toContain("does not diagnose");
    expect(wound.careTeamNote.en.toLowerCase()).toContain("not a diagnosis");
  });

  it("builds a plan with check-in nudge when silent", () => {
    const now = Date.now();
    const insights = assessRecovery(
      {
        dayOffset: 4,
        hasDrain: false,
        hasOpenUrgent: false,
        unansweredQuestions: 1,
        checkins: [ck({ createdAt: new Date(now - 3 * 86_400_000), pain: 2 })],
      },
      now,
    );
    const plan = buildPlanFromInsights(insights, { checkedInToday: false });
    expect(plan[0]?.id).toBe("checkin-today");
    expect(plan.length).toBeGreaterThan(2);
  });
});
