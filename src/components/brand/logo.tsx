import { cn } from "@/lib/utils";

/**
 * Three leaves rising from one point: life, breath, a story that keeps growing.
 * Drawn in currentColor so it can sit on any badge or stand alone.
 */
export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-full", className)} fill="currentColor">
      <path d="M20 7.5c5.2 5 6 11.9 0 19.5-6-7.6-5.2-14.5 0-19.5Z" />
      <path d="M18.3 28.2C11.6 28.9 7.6 25 7 19.2c6-.6 10.6 2.7 11.3 9Z" opacity=".78" />
      <path d="M21.7 28.2c6.7.7 10.7-3.2 11.3-9-6-.6-10.6 2.7-11.3 9Z" opacity=".78" />
      <path d="M20 28.5v4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".9" />
    </svg>
  );
}

/** The mark on its badge: deep teal gradient, soft inner highlight. Same in light and dark mode. */
export function LogoBadge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center rounded-[11px] p-[7px] text-white",
        "bg-gradient-to-br from-[oklch(0.64_0.105_176)] to-[oklch(0.38_0.075_200)]",
        "shadow-[0_1px_2px_oklch(0.24_0.035_230/0.25),inset_0_1px_0_oklch(1_0_0/0.28)] ring-1 ring-black/5",
        className,
      )}
    >
      <LeafMark />
    </span>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="PRAANA">
      <LogoBadge />
      <span className="flex items-center gap-2.5 font-heading leading-none">
        <span className="text-[1.05rem] font-semibold tracking-[0.2em] text-navy">PRAANA</span>
        {!compact && (
          <>
            <span aria-hidden="true" className="h-4 w-px bg-border" />
            <span className="text-base font-medium text-navy/75" lang="hi">
              प्राणा
            </span>
          </>
        )}
      </span>
    </span>
  );
}
