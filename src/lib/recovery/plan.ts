/**
 * Personalised recovery actions derived from signal heads.
 * Lifestyle + education + check-in nudges only — never prescriptions.
 */
import type { SignalHead, SignalHeadId, RecoveryInsights } from "./insights";

export type PlanAction = {
  id: string;
  title: { en: string; hi: string };
  source: { en: string; hi: string };
  headId: SignalHeadId;
  href: string;
  tags: { en: string; hi: string }[];
};

const HEAD_HREF: Record<SignalHeadId, string> = {
  pain: "/check-in",
  eating: "/learn",
  mobility: "/guided",
  wound: "/check-in",
  mood: "/guided",
  continuity: "/check-in",
};

const HEAD_TAG: Record<SignalHeadId, { en: string; hi: string }> = {
  pain: { en: "Comfort", hi: "आराम" },
  eating: { en: "Nutrition", hi: "पोषण" },
  mobility: { en: "Movement", hi: "गति" },
  wound: { en: "Wound", hi: "घाव" },
  mood: { en: "Care", hi: "देखभाल" },
  continuity: { en: "Story", hi: "कहानी" },
};

export function buildPlanFromInsights(insights: RecoveryInsights, opts?: { checkedInToday?: boolean }): PlanAction[] {
  const actions: PlanAction[] = [];
  const seen = new Set<string>();

  const push = (a: PlanAction) => {
    if (seen.has(a.id)) return;
    seen.add(a.id);
    actions.push(a);
  };

  if (!opts?.checkedInToday) {
    push({
      id: "checkin-today",
      title: { en: "Share today's check-in in your own words", hi: "आज का हाल अपने शब्दों में बताएं" },
      source: { en: "Suggested from Story continuity", hi: "कहानी की निरंतरता से सुझाव" },
      headId: "continuity",
      href: "/check-in",
      tags: [{ en: "Today", hi: "आज" }, HEAD_TAG.continuity],
    });
  }

  // Prioritise review/watch heads
  const ranked = [...insights.heads].sort((a, b) => b.score - a.score);
  for (const head of ranked) {
    if (head.level === "steady" && actions.length >= 5) continue;
    for (const rec of head.recommendations.slice(0, 2)) {
      push({
        id: `${head.id}-${rec.en.slice(0, 24).replace(/\W+/g, "-").toLowerCase()}`,
        title: rec,
        source: {
          en: `Suggested from ${head.title.en} (${head.level})`,
          hi: `${head.title.hi} (${head.level}) से सुझाव`,
        },
        headId: head.id,
        href: HEAD_HREF[head.id],
        tags: [{ en: "This week", hi: "इस सप्ताह" }, HEAD_TAG[head.id]],
      });
      if (actions.length >= 8) break;
    }
    if (actions.length >= 8) break;
  }

  push({
    id: "ask-praana",
    title: { en: "Ask PRAANA a recovery question", hi: "Ask PRAANA से रिकवरी सवाल पूछें" },
    source: { en: "Always available", hi: "हमेशा उपलब्ध" },
    headId: "continuity",
    href: "/companion",
    tags: [{ en: "Ask", hi: "पूछें" }],
  });

  return actions.slice(0, 8);
}

export function topSignals(heads: SignalHead[], n = 3): SignalHead[] {
  return [...heads].sort((a, b) => b.score - a.score).slice(0, n);
}
