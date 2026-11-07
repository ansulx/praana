import { describe, expect, it } from "vitest";
import { GUIDED_SESSIONS, getSession } from "@/content/guided";
import { evaluateAll, evaluateSession, recommendSessions, type EligibilityContext } from "./eligibility";

const NOW = Date.parse("2026-10-13T06:00:00Z");
const base: EligibilityContext = {
  dayOffset: 5,
  surgeryType: "breast",
  hasDrain: false,
  latest: null,
  hasOpenUrgent: false,
  role: "patient",
};
const latest = (over: Partial<NonNullable<EligibilityContext["latest"]>> = {}) => ({
  pain: 2,
  anxiety: 0,
  sleep: 0,
  mood: 0,
  temperatureC: null,
  wound: "healing_well",
  createdAt: new Date(NOW - 3600_000),
  ...over,
});
const ev = (slug: string, ctx: Partial<EligibilityContext> = {}) => evaluateSession(getSession(slug)!, { ...base, ...ctx }, NOW);

describe("content integrity", () => {
  it("has unique slugs and the slugs the seed uses", () => {
    const slugs = GUIDED_SESSIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of ["deep-breathing-cough", "breast-arm-early", "calm-breath", "prehab-walk"]) expect(slugs).toContain(s);
  });
  it("every session has steps with positive durations and breath pacing on breath steps", () => {
    for (const s of GUIDED_SESSIONS) {
      expect(s.steps.length).toBeGreaterThan(0);
      for (const st of s.steps) {
        expect(st.seconds).toBeGreaterThan(0);
        if (st.kind === "breath") expect(st.breath).toBeDefined();
      }
      expect(s.safety.length).toBeGreaterThan(0);
    }
  });
});

describe("evaluateSession", () => {
  it("open urgent alert locks movement but not breathing", () => {
    expect(ev("ankle-pumps", { hasOpenUrgent: true }).status).toBe("locked");
    expect(ev("calm-breath", { hasOpenUrgent: true }).status).toBe("available");
    expect(ev("body-scan-healing", { hasOpenUrgent: true }).status).toBe("available");
  });

  it("fever today locks movement", () => {
    expect(ev("walking-plan", { latest: latest({ temperatureC: 38.2 }) }).status).toBe("locked");
    expect(ev("diaphragmatic-breathing", { latest: latest({ temperatureC: 38.2 }) }).status).toBe("available");
  });

  it("wound concern today locks movement", () => {
    expect(ev("breast-arm-early", { latest: latest({ wound: "discharge" }) }).status).toBe("locked");
    expect(ev("breast-arm-early", { latest: latest({ wound: "redness" }) }).status).toBe("available");
  });

  it("stale check-in (>24h) does not gate", () => {
    const old = latest({ temperatureC: 38.5, pain: 9, createdAt: new Date(NOW - 2 * 86_400_000) });
    expect(ev("walking-plan", { latest: old }).status).toBe("available");
  });

  it("pain above maxPain locks with a kind reason", () => {
    const r = ev("breast-arm-early", { latest: latest({ pain: 8 }) });
    expect(r.status).toBe("locked");
    expect(r.reason?.en).toContain("8/10");
  });

  it("window: before fromDay is locked with day number", () => {
    const r = ev("breast-arm-later", { dayOffset: 3 });
    expect(r.status).toBe("locked");
    expect(r.reason?.en).toContain("day 7");
  });

  it("no surgery date locks post-op sessions", () => {
    expect(ev("breast-arm-early", { dayOffset: null }).reason?.en).toMatch(/surgery date/);
  });

  it("before surgery, post-op sessions say so", () => {
    expect(ev("walking-plan", { dayOffset: -3 }).reason?.en).toMatch(/after your surgery/);
  });

  it("past toDay is hidden", () => {
    expect(ev("prehab-walk", { dayOffset: 2 }).status).toBe("hidden");
    expect(ev("prehab-walk", { dayOffset: -5 }).status).toBe("available");
  });

  it("surgery type filters", () => {
    expect(ev("breast-arm-early", { surgeryType: "colorectal" }).status).toBe("hidden");
    expect(ev("bed-to-chair", { surgeryType: "breast" }).status).toBe("hidden");
    expect(ev("bed-to-chair", { surgeryType: "colorectal" }).status).toBe("available");
    expect(ev("seated-neck-shoulder", { surgeryType: "head_neck" }).status).toBe("hidden");
  });

  it("drain still in locks drain-sensitive sessions", () => {
    expect(ev("breast-arm-later", { dayOffset: 10, hasDrain: true }).status).toBe("locked");
    expect(ev("breast-arm-later", { dayOffset: 10, hasDrain: false }).status).toBe("available");
  });

  it("caregiver-only sessions are hidden for patients and shown to caregivers", () => {
    expect(ev("caregiver-reset").status).toBe("hidden");
    expect(ev("caregiver-reset", { role: "caregiver" }).status).toBe("available");
    expect(ev("ankle-pumps", { role: "caregiver" }).status).toBe("available");
  });
});

describe("recommendSessions", () => {
  it("returns only available sessions, at most n", () => {
    const recs = recommendSessions({ ...base, hasOpenUrgent: true }, 3, NOW);
    expect(recs.length).toBeLessThanOrEqual(3);
    for (const r of recs) expect(r.session.movement).toBe(false);
  });

  it("anxiety brings calm breath to the top", () => {
    const recs = recommendSessions({ ...base, latest: latest({ anxiety: 3 }) }, 3, NOW);
    expect(recs[0].session.slug).toBe("calm-breath");
    expect(recs[0].reason.en).toMatch(/worried/);
  });

  it("poor sleep suggests the wind-down", () => {
    const recs = recommendSessions({ ...base, latest: latest({ sleep: 3 }) }, 3, NOW);
    expect(recs.map((r) => r.session.slug)).toContain("sleep-wind-down");
  });

  it("pre-op suggests prehab", () => {
    const recs = recommendSessions({ ...base, dayOffset: -2, surgeryType: "gynaecologic" }, 3, NOW);
    const slugs = recs.map((r) => r.session.slug);
    expect(slugs).toContain("pre-surgery-calm");
    expect(slugs).toContain("prehab-walk");
  });

  it("caregivers get their reset first", () => {
    const recs = recommendSessions({ ...base, role: "caregiver" }, 3, NOW);
    expect(recs[0].session.slug).toBe("caregiver-reset");
  });

  it("evaluateAll marks recommended ones", () => {
    const all = evaluateAll(base, NOW);
    expect(all.filter((a) => a.eligibility.status === "recommended").length).toBeGreaterThan(0);
  });
});
