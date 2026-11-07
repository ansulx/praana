"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABELS, type GuidedCategory, type GuidedSession } from "@/content/guided";
import type { Eligibility } from "@/lib/guided/eligibility";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/providers/locale-provider";
import { SessionCard } from "./session-card";

type Item = { session: GuidedSession; eligibility: Eligibility };

const ORDER: GuidedCategory[] = ["breathing", "physio", "meditation", "yoga", "sleep", "prehab", "caregiver"];

export function GuidedLibrary({ items }: { items: Item[] }) {
  const locale = useLocale();
  const [cat, setCat] = useState<GuidedCategory | "all">("all");

  const visible = items.filter((i) => i.eligibility.status !== "hidden");
  const cats = ORDER.filter((c) => visible.some((i) => i.session.category === c));
  const shown = useMemo(() => {
    const list = cat === "all" ? visible : visible.filter((i) => i.session.category === cat);
    const rank = { recommended: 0, available: 1, locked: 2, hidden: 3 } as const;
    return [...list].sort((a, b) => rank[a.eligibility.status] - rank[b.eligibility.status]);
  }, [cat, visible]);

  const chip = (key: GuidedCategory | "all", label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setCat(key)}
      aria-pressed={cat === key}
      className={cn(
        "h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition",
        cat === key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/50",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={locale === "hi" ? "श्रेणी" : "Category"}>
        {chip("all", locale === "hi" ? "सभी" : "All")}
        {cats.map((c) => chip(c, CATEGORY_LABELS[c][locale]))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((i) => (
          <SessionCard key={i.session.slug} session={i.session} eligibility={i.eligibility} locale={locale} />
        ))}
      </div>
    </div>
  );
}
