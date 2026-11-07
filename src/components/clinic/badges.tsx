import { AlertTriangle, BellRing, CircleCheck, Clock3, MessageCircleQuestion, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/clinic/trends";

const PRIORITY: Record<Priority, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  urgent: { label: "Urgent — look now", className: "bg-coral text-white", icon: BellRing },
  review: { label: "Needs a person", className: "bg-amber-soft text-[oklch(0.45_0.12_70)] ring-1 ring-amber/50", icon: AlertTriangle },
  silent: { label: "No recent check-in", className: "bg-muted text-muted-foreground ring-1 ring-border", icon: Clock3 },
  worsening: { label: "Trend worsening", className: "bg-coral-soft text-coral ring-1 ring-coral/30", icon: TrendingUp },
  question: { label: "Open question", className: "bg-accent text-accent-foreground", icon: MessageCircleQuestion },
  stable: { label: "Steady", className: "bg-mint text-primary", icon: CircleCheck },
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const p = PRIORITY[priority];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", p.className, className)}>
      <p.icon className="size-3.5" />
      {p.label}
    </span>
  );
}

const TRIAGE: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-coral text-white" },
  review: { label: "Review", className: "bg-amber-soft text-[oklch(0.45_0.12_70)] ring-1 ring-amber/50" },
  watch: { label: "Watch", className: "bg-muted text-muted-foreground ring-1 ring-border" },
  none: { label: "No flags", className: "bg-mint text-primary" },
};

export function TriageBadge({ level, className }: { level: string; className?: string }) {
  const t = TRIAGE[level] ?? TRIAGE.none;
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", t.className, className)}>{t.label}</span>;
}

/** Tiny inline-SVG sparkline for pain (0–10). Works in server components. */
export function PainSparkline({ points, className }: { points: { day: string; pain: number }[]; className?: string }) {
  const w = 96;
  const h = 28;
  if (points.length === 0) return <span className={cn("text-xs text-muted-foreground", className)}>No pain scores</span>;
  if (points.length === 1) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Pain <strong className="text-foreground">{points[0].pain}</strong>/10
      </span>
    );
  }
  const step = w / (points.length - 1);
  const y = (p: number) => h - 2 - (p / 10) * (h - 4);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(p.pain).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const rising = last.pain - points[0].pain >= 2;
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={points.map((p) => `${p.day}: ${p.pain}/10`).join("\n")}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`Pain trend, latest ${last.pain} out of 10`} role="img">
        <line x1="0" x2={w} y1={y(7)} y2={y(7)} stroke="currentColor" strokeDasharray="2 3" className="text-border" />
        <path d={d} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" className={rising ? "text-coral" : "text-primary"} />
        <circle cx={(points.length - 1) * step} cy={y(last.pain)} r="2.5" fill="currentColor" className={rising ? "text-coral" : "text-primary"} />
      </svg>
      <span className="text-xs tabular-nums text-muted-foreground">{last.pain}/10</span>
    </span>
  );
}
