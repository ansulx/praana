/**
 * Pure, deterministic helpers for the care-team view: priority ranking, journey stage
 * labels and the rule-based "since last review" summary. No I/O — unit tested.
 * Everything here describes what was REPORTED; nothing diagnoses or recommends.
 */

import { daysBetween } from "@/lib/dates";

export type TrendCheckin = {
  createdAt: Date | string;
  pain: number | null;
  appetite: number | null;
  nausea: number | null;
  mobility: number | null;
  sleep: number | null;
  mood: number | null;
  anxiety: number | null;
  temperatureC: number | null;
  wound: string | null;
  medsTaken: string | null;
  triage: "none" | "watch" | "review" | "urgent";
  triageReasons: string[];
  reporterRole?: string;
};

// ─── Stage ─────────────────────────────────────────────────────────────────

export function stageLabel(surgeryDate: string | null, dischargeDate: string | null, todayYmd: string): string {
  if (!surgeryDate) return "Surgery date not set";
  const d = daysBetween(surgeryDate, todayYmd);
  if (d < -14) return "Meet the care team";
  if (d < 0) return "Preparing for surgery";
  const home = dischargeDate ? dischargeDate <= todayYmd : d > 3;
  if (!home) return "Surgery / in hospital";
  return d <= 42 ? "Recovering at home" : "Back to what matters";
}

// ─── Priority ──────────────────────────────────────────────────────────────

export type Priority = "urgent" | "review" | "silent" | "worsening" | "question" | "stable";
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, review: 1, silent: 2, worsening: 3, question: 4, stable: 5 };

export type PriorityInput = {
  openAlertLevel: "review" | "urgent" | null;
  openAlertReasons?: string[];
  dayOffset: number | null;
  silentDays: number | null; // null = never checked in
  /** Oldest → newest */
  recent: Pick<TrendCheckin, "pain" | "appetite">[];
  unansweredQuestions: number;
};

export function isWorsening(recentOldestFirst: Pick<TrendCheckin, "pain" | "appetite">[]): string | null {
  const last3 = recentOldestFirst.slice(-3);
  const pains = last3.map((c) => c.pain).filter((p): p is number => typeof p === "number");
  if (pains.length >= 2 && pains[pains.length - 1] - pains[0] >= 2) {
    return `Pain rising (${pains[0]} → ${pains[pains.length - 1]})`;
  }
  const last2 = recentOldestFirst.slice(-2);
  if (last2.length === 2 && last2.every((c) => typeof c.appetite === "number" && c.appetite >= 3)) {
    return "Eating very little at the last two check-ins";
  }
  return null;
}

export function computePriority(p: PriorityInput): { priority: Priority; reason: string } {
  if (p.openAlertLevel === "urgent") return { priority: "urgent", reason: p.openAlertReasons?.[0] ?? "Urgent alert open" };
  if (p.openAlertLevel === "review") return { priority: "review", reason: p.openAlertReasons?.[0] ?? "Check-in needs review" };
  const postOp = p.dayOffset !== null && p.dayOffset >= 0;
  if (postOp && (p.silentDays === null || p.silentDays >= 2)) {
    return { priority: "silent", reason: p.silentDays === null ? "No check-ins yet since surgery" : `No check-in for ${p.silentDays} days` };
  }
  const worse = isWorsening(p.recent);
  if (worse) return { priority: "worsening", reason: worse };
  if (p.unansweredQuestions > 0) {
    return { priority: "question", reason: `${p.unansweredQuestions} unanswered question${p.unansweredQuestions === 1 ? "" : "s"}` };
  }
  return { priority: "stable", reason: "Stable" };
}

// ─── Rule-based summary ────────────────────────────────────────────────────

const DOMAINS = [
  { key: "pain", label: "Pain", max: 10 },
  { key: "appetite", label: "Eating difficulty", max: 4 },
  { key: "nausea", label: "Nausea", max: 4 },
  { key: "mobility", label: "Mobility difficulty", max: 4 },
  { key: "sleep", label: "Sleep difficulty", max: 4 },
  { key: "mood", label: "Low mood", max: 4 },
  { key: "anxiety", label: "Worry", max: 4 },
] as const;

export type DomainTrend = { key: string; label: string; first: number; last: number; direction: "up" | "down" | "flat"; arrow: "↑" | "↓" | "→"; n: number };

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Compare the first half of the window with the second half. Higher = more trouble. */
export function domainTrends(oldestFirst: TrendCheckin[]): DomainTrend[] {
  const out: DomainTrend[] = [];
  for (const d of DOMAINS) {
    const vals = oldestFirst.map((c) => c[d.key]).filter((v): v is number => typeof v === "number");
    if (vals.length < 2) continue;
    const mid = Math.floor(vals.length / 2);
    const a = avg(vals.slice(0, mid));
    const b = avg(vals.slice(mid));
    const threshold = d.max === 10 ? 1 : 0.5;
    const direction = b - a >= threshold ? "up" : a - b >= threshold ? "down" : "flat";
    out.push({ key: d.key, label: d.label, first: vals[0], last: vals[vals.length - 1], direction, arrow: direction === "up" ? "↑" : direction === "down" ? "↓" : "→", n: vals.length });
  }
  return out;
}

export type AdherenceSummary = { taken: number; skipped: number; expected: number };

export function summarizeRules(
  newestFirst: TrendCheckin[],
  opts: { now?: Date; windowDays?: number; adherence?: AdherenceSummary | null; dayOffset?: number | null } = {},
): { text: string; bullets: string[] } {
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? 7;
  const since = now.getTime() - windowDays * 86_400_000;
  const inWindow = newestFirst.filter((c) => new Date(c.createdAt).getTime() >= since);
  const oldestFirst = [...inWindow].reverse();
  const bullets: string[] = [];

  if (!inWindow.length) {
    const last = newestFirst[0];
    const text = last
      ? `No check-ins in the last ${windowDays} days. Last check-in was ${Math.floor((now.getTime() - new Date(last.createdAt).getTime()) / 86_400_000)} days ago.`
      : "No check-ins recorded yet.";
    return { text, bullets: [] };
  }

  const days = new Set(inWindow.map((c) => new Date(c.createdAt).toISOString().slice(0, 10))).size;
  const expectedDays = opts.dayOffset !== null && opts.dayOffset !== undefined && opts.dayOffset >= 0 ? Math.min(windowDays, opts.dayOffset + 1) : windowDays;
  const caregiverCount = inWindow.filter((c) => c.reporterRole === "caregiver").length;

  const trends = domainTrends(oldestFirst);
  const worse = trends.filter((t) => t.direction === "up");
  const better = trends.filter((t) => t.direction === "down");

  for (const t of trends) {
    const scale = t.key === "pain" ? "/10" : "/4";
    const word = t.direction === "up" ? "worsening" : t.direction === "down" ? "improving" : "steady";
    bullets.push(`${t.label} ${t.arrow} ${word} (${t.first}${scale} → ${t.last}${scale})`);
  }

  const temps = inWindow.map((c) => c.temperatureC).filter((v): v is number => typeof v === "number");
  if (temps.length) {
    const max = Math.max(...temps);
    bullets.push(`Highest temperature reported ${max}°C${max >= 38 ? " (≥38°C)" : max >= 37.5 ? " (raised)" : ""}`);
  }

  const woundIssues = inWindow.filter((c) => c.wound && !["healing_well", "no_wound"].includes(c.wound));
  if (woundIssues.length) bullets.push(`Wound changes reported at ${woundIssues.length} check-in${woundIssues.length === 1 ? "" : "s"} (latest: ${woundIssues[0].wound!.replace("_", " ")})`);

  const flagged = inWindow.filter((c) => c.triage === "urgent" || c.triage === "review");
  if (flagged.length) {
    const reasons = [...new Set(flagged.flatMap((c) => c.triageReasons))].slice(0, 4);
    bullets.push(`Flagged for review ${flagged.length}×, ${reasons.join("; ")}`);
  }

  const missedMeds = inWindow.filter((c) => c.medsTaken === "none" || c.medsTaken === "some").length;
  if (opts.adherence && opts.adherence.expected > 0) {
    const pct = Math.round((opts.adherence.taken / opts.adherence.expected) * 100);
    bullets.push(`Medicine doses logged as taken: ${opts.adherence.taken}/${opts.adherence.expected} (${pct}%)${opts.adherence.skipped ? `, ${opts.adherence.skipped} marked skipped` : ""}`);
  } else if (missedMeds) {
    bullets.push(`Reported missing medicines at ${missedMeds} check-in${missedMeds === 1 ? "" : "s"}`);
  }

  if (days < expectedDays) bullets.push(`Checked in on ${days} of the last ${expectedDays} days`);
  if (caregiverCount) bullets.push(`${caregiverCount} update${caregiverCount === 1 ? "" : "s"} written by a caregiver`);

  const parts = [`${inWindow.length} check-in${inWindow.length === 1 ? "" : "s"} over ${days} day${days === 1 ? "" : "s"}.`];
  if (worse.length) parts.push(`Reported worse: ${worse.map((t) => t.label.toLowerCase()).join(", ")}.`);
  if (better.length) parts.push(`Reported better: ${better.map((t) => t.label.toLowerCase()).join(", ")}.`);
  if (!worse.length && !better.length && trends.length) parts.push("Scores broadly steady.");
  if (flagged.length) parts.push(`${flagged.length} check-in${flagged.length === 1 ? " was" : "s were"} flagged by the safety rules.`);

  return { text: parts.join(" "), bullets };
}
