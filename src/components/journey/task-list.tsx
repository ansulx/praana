"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import type { JourneyTask } from "@/content/journey";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocale } from "@/components/providers/locale-provider";
import { toggleJourneyTask } from "@/server/actions/guided";

export function TaskList({ tasks, done }: { tasks: JourneyTask[]; done: string[] }) {
  const locale = useLocale();
  const [, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(new Set(done), (state: Set<string>, change: { key: string; done: boolean }) => {
    const next = new Set(state);
    if (change.done) next.add(change.key);
    else next.delete(change.key);
    return next;
  });

  const toggle = (key: string, value: boolean) => {
    start(async () => {
      setOptimistic({ key, done: value });
      const res = await toggleJourneyTask(key, value).catch(() => null);
      if (!res || !res.ok) toast.error(res && !res.ok ? res.error : locale === "hi" ? "सेव नहीं हुआ, फिर कोशिश करें" : "Couldn't save. Please try again");
    });
  };

  return (
    <ul className="space-y-2">
      {tasks.map((t) => {
        const checked = optimistic.has(t.key);
        const id = `task-${t.key}`;
        return (
          <li key={t.key}>
            <label
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3.5 transition hover:border-primary/40",
                checked && "border-primary/30 bg-mint/60",
              )}
            >
              <Checkbox id={id} checked={checked} onCheckedChange={(v) => toggle(t.key, v === true)} className="mt-0.5 size-5" />
              <span className="flex-1">
                <span className={cn("block text-sm font-medium", checked && "text-muted-foreground line-through decoration-primary/40")}>{t.title[locale]}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.detail[locale]}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
