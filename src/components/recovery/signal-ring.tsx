import { cn } from "@/lib/utils";
import type { SignalLevel } from "@/lib/recovery/insights";

export function SignalRing({
  score,
  level,
  label,
  size = 120,
}: {
  score: number;
  level: SignalLevel;
  label: string;
  size?: number;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = level === "review" ? "#c45c4a" : level === "watch" ? "#b8860b" : "#0b6b5c";

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-heading text-3xl font-bold text-navy">{score}</p>
          <p className={cn("text-[10px] font-bold tracking-wide", level === "review" ? "text-coral" : level === "watch" ? "text-amber-800" : "text-primary")}>
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
