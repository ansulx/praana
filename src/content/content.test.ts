import { describe, expect, it } from "vitest";
import { getSession } from "./guided";
import { ALL_TASK_KEYS, JOURNEY_STAGES, computeStage } from "./journey";
import { ARTICLES, getArticle, searchArticles } from "./learn";

describe("computeStage", () => {
  const today = "2026-10-13";
  it.each([
    [{ surgeryDate: null, dischargeDate: null }, "meet"],
    [{ surgeryDate: "2026-11-10", dischargeDate: null }, "meet"],
    [{ surgeryDate: "2026-10-27", dischargeDate: null }, "prepare"],
    [{ surgeryDate: "2026-10-18", dischargeDate: null }, "prepare"],
    [{ surgeryDate: "2026-10-13", dischargeDate: null }, "surgery"],
    [{ surgeryDate: "2026-10-11", dischargeDate: null }, "surgery"],
    [{ surgeryDate: "2026-10-10", dischargeDate: null }, "home"],
    [{ surgeryDate: "2026-10-08", dischargeDate: "2026-10-15" }, "surgery"],
    [{ surgeryDate: "2026-10-12", dischargeDate: "2026-10-13" }, "home"],
    [{ surgeryDate: "2026-09-01", dischargeDate: "2026-09-05" }, "home"],
    [{ surgeryDate: "2026-08-01", dischargeDate: "2026-08-05" }, "life"],
  ] as const)("%o → %s", (p, stage) => {
    expect(computeStage(p, today)).toBe(stage);
  });
});

describe("journey content", () => {
  it("has five ordered stages with the task keys the seed uses", () => {
    expect(JOURNEY_STAGES.map((s) => s.index)).toEqual([1, 2, 3, 4, 5]);
    for (const k of ["meet.team", "meet.plan", "prepare.walk", "prepare.breathing", "prepare.home", "surgery.discharge", "home.drain"]) {
      expect(ALL_TASK_KEYS.has(k)).toBe(true);
    }
  });
  it("only links to sessions and articles that exist", () => {
    for (const s of JOURNEY_STAGES) {
      for (const slug of s.sessions) expect(getSession(slug), slug).toBeDefined();
      for (const slug of s.articles) expect(getArticle(slug), slug).toBeDefined();
    }
  });
});

describe("searchArticles", () => {
  it("has unique slugs", () => {
    expect(new Set(ARTICLES.map((a) => a.slug)).size).toBe(ARTICLES.length);
  });
  it.each([
    ["What should I eat to heal faster?", "eating-to-heal"],
    ["drain output is 40 ml, is that ok", "drain-care"],
    ["kya khana chahiye", "eating-to-heal"],
    ["घाव में खुजली हो रही है", "wound-care"],
    ["when is my pathology report coming", "pathology-next-steps"],
    ["I feel so much chinta at night", "worry-is-normal"],
    ["kabz ho gaya hai", "hydration-bowels"],
  ])("%s → %s", (q, slug) => {
    expect(searchArticles(q).map((a) => a.slug)).toContain(slug);
  });
  it("returns nothing for unrelated or empty queries", () => {
    expect(searchArticles("")).toEqual([]);
    expect(searchArticles("cricket score today")).toEqual([]);
  });
});
