import { cn } from "@/lib/utils";

/** Tiny dependency-free trend line. `max` is the scale ceiling (10 for pain, 4 for others). */
export function Sparkline({
  values,
  max,
  className,
  label,
}: {
  values: (number | null)[];
  max: number;
  className?: string;
  label?: string;
}) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  const w = 120;
  const h = 36;
  if (pts.length < 2) {
    return <div className={cn("h-9 text-xs text-muted-foreground", className)}>{""}</div>;
  }
  const n = Math.max(values.length - 1, 1);
  const x = (i: number) => (i / n) * (w - 6) + 3;
  const y = (v: number) => h - 4 - (v / max) * (h - 8);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const worse = last.v / max >= 0.65;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-9 w-full", className)} role="img" aria-label={label ?? `Trend, latest ${last.v} of ${max}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" />
      <circle cx={x(last.i)} cy={y(last.v)} r="3.5" className={worse ? "fill-coral" : "fill-primary"} />
    </svg>
  );
}
