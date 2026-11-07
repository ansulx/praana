"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanAction } from "@/lib/recovery/plan";
import { useLocale } from "@/components/providers/locale-provider";

const STORAGE_KEY = "praana_plan_done_v1";

export function PlanChecklist({
  actions,
  patientId,
}: {
  actions: PlanAction[];
  patientId: string;
}) {
  const locale = useLocale();
  const hi = locale === "hi";
  const key = `${STORAGE_KEY}:${patientId}`;
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, [key]);

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const completed = actions.filter((a) => done.has(a.id)).length;

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-heading text-lg font-semibold text-navy">
            {completed}/{actions.length} {hi ? "पूरे" : "completed"}
          </p>
          <p className="text-sm text-muted-foreground">{hi ? "केवल मार्गदर्शन" : "Guidance only"}</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${actions.length ? (completed / actions.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <ul className="grid gap-3">
        {actions.map((a) => {
          const isDone = done.has(a.id);
          return (
            <li key={a.id} className={cn("rounded-2xl border bg-card p-4 transition", isDone && "opacity-70")}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="mt-0.5 shrink-0 text-primary"
                  aria-label={isDone ? (hi ? "अधूरा चिह्नित करें" : "Mark incomplete") : hi ? "पूरा चिह्नित करें" : "Mark complete"}
                >
                  {isDone ? <CheckCircle2 className="size-6" /> : <Circle className="size-6 text-muted-foreground" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium leading-snug", isDone && "line-through text-muted-foreground")}>
                    {hi ? a.title.hi : a.title.en}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{hi ? a.source.hi : a.source.en}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {a.tags.map((t) => (
                      <span key={t.en} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {hi ? t.hi : t.en}
                      </span>
                    ))}
                  </div>
                </div>
                <Link href={a.href} className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={hi ? "खोलें" : "Open"}>
                  <ChevronRight className="size-5" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
