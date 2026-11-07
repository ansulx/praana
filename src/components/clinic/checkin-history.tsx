"use client";

import { useState } from "react";
import { HeartHandshake, ImageIcon, Mic, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { optionLabel, WOUND_OPTIONS, MEDS_OPTIONS, type ScaleDomain } from "@/lib/domains";
import { fmtDateTime, formatDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { TriageBadge } from "./badges";

export type HistoryItem = {
  id: string;
  createdAt: Date;
  dayOffset: number | null;
  reporterRole: string;
  inputMode: string;
  freeText: string | null;
  pain: number | null;
  appetite: number | null;
  nausea: number | null;
  mobility: number | null;
  sleep: number | null;
  mood: number | null;
  anxiety: number | null;
  wound: string | null;
  temperatureC: number | null;
  medsTaken: string | null;
  triage: string;
  triageReasons: string[];
  aiStatus: string;
  summary: string | null;
  photoIds: string[];
};

const SCALES: { key: ScaleDomain; label: string; max: number }[] = [
  { key: "pain", label: "Pain", max: 10 },
  { key: "appetite", label: "Eating", max: 4 },
  { key: "nausea", label: "Nausea", max: 4 },
  { key: "mobility", label: "Moving", max: 4 },
  { key: "sleep", label: "Sleep", max: 4 },
  { key: "mood", label: "Mood", max: 4 },
  { key: "anxiety", label: "Worry", max: 4 },
];

const PAGE = 10;

export function CheckinHistory({ items }: { items: HistoryItem[] }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  if (!items.length) return <p className="py-8 text-center text-sm text-muted-foreground">No check-ins yet.</p>;

  return (
    <>
      <ol className="grid gap-3">
        {items.slice(0, shown).map((c) => (
          <li
            key={c.id}
            className={cn(
              "rounded-xl border p-4",
              c.triage === "urgent" && "border-coral/50 bg-coral-soft/30",
              c.triage === "review" && "border-amber/50 bg-amber-soft/30",
            )}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{fmtDateTime(c.createdAt)}</span>
              <span className="text-muted-foreground">· {formatDayLabel(c.dayOffset)}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {c.reporterRole === "caregiver" ? <HeartHandshake className="size-3" /> : <User className="size-3" />}
                {c.reporterRole === "caregiver" ? "Caregiver" : "Patient"}
              </span>
              {c.inputMode === "voice" && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Mic className="size-3" /> voice
                </span>
              )}
              <TriageBadge level={c.triage} className="ml-auto" />
            </div>

            {c.freeText && (
              <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 text-[15px] leading-relaxed whitespace-pre-wrap" lang="mul">
                “{c.freeText}”
              </blockquote>
            )}

            {c.summary && (
              <p className="mt-2 flex gap-1.5 text-sm text-muted-foreground">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>
                  {c.summary}
                  <span className="ml-1 text-xs">({c.aiStatus === "done" ? "AI-organised" : "rule-based"})</span>
                </span>
              </p>
            )}

            <dl className="mt-3 flex flex-wrap gap-1.5 text-xs">
              {SCALES.map((s) =>
                c[s.key] === null ? null : (
                  <div
                    key={s.key}
                    title={optionLabel(s.key, c[s.key]) ?? undefined}
                    className={cn(
                      "rounded-md border px-2 py-1",
                      (c[s.key] as number) / s.max >= 0.7 ? "border-coral/40 bg-coral-soft text-coral" : (c[s.key] as number) / s.max >= 0.5 ? "border-amber/50 bg-amber-soft" : "bg-muted/60",
                    )}
                  >
                    <dt className="inline text-muted-foreground">{s.label} </dt>
                    <dd className="inline font-semibold tabular-nums">
                      {c[s.key]}/{s.max}
                    </dd>
                  </div>
                ),
              )}
              {c.temperatureC !== null && (
                <div className={cn("rounded-md border px-2 py-1", c.temperatureC >= 38 ? "border-coral/40 bg-coral-soft text-coral" : c.temperatureC >= 37.5 ? "border-amber/50 bg-amber-soft" : "bg-muted/60")}>
                  <dt className="inline text-muted-foreground">Temp </dt>
                  <dd className="inline font-semibold tabular-nums">{c.temperatureC}°C</dd>
                </div>
              )}
              {c.wound && c.wound !== "no_wound" && (
                <div className={cn("rounded-md border px-2 py-1", c.wound === "healing_well" ? "bg-muted/60" : "border-amber/50 bg-amber-soft")}>
                  <dt className="inline text-muted-foreground">Wound </dt>
                  <dd className="inline font-semibold">{WOUND_OPTIONS.find((w) => w.value === c.wound)?.en ?? c.wound}</dd>
                </div>
              )}
              {c.medsTaken && c.medsTaken !== "not_applicable" && (
                <div className={cn("rounded-md border px-2 py-1", c.medsTaken === "all" ? "bg-muted/60" : "border-amber/50 bg-amber-soft")}>
                  <dt className="inline text-muted-foreground">Meds </dt>
                  <dd className="inline font-semibold">{MEDS_OPTIONS.find((m) => m.value === c.medsTaken)?.en ?? c.medsTaken}</dd>
                </div>
              )}
            </dl>

            {c.triageReasons.length > 0 && c.triage !== "none" && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold">Flags:</span> {c.triageReasons.join(" · ")}
              </p>
            )}

            {c.photoIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {c.photoIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPhoto(id)}
                    className="group relative size-20 overflow-hidden rounded-lg border bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    aria-label="Open wound photo"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- authenticated, uncacheable route */}
                    <img src={`/api/photos/${id}`} alt="Wound photo" loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
                    <ImageIcon className="absolute right-1 bottom-1 size-3.5 text-white drop-shadow" />
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {shown < items.length && (
        <Button variant="outline" className="mt-3 w-full" onClick={() => setShown((n) => n + PAGE)}>
          Show older check-ins ({items.length - shown} more)
        </Button>
      )}

      <Dialog open={photo !== null} onOpenChange={(o) => !o && setPhoto(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">Wound photo</DialogTitle>
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated, uncacheable route
            <img src={`/api/photos/${photo}`} alt="Wound photo, full size" className="max-h-[80dvh] w-full rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
