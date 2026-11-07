"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Search } from "lucide-react";
import { ARTICLES, DISCIPLINE_LABELS, searchArticles, type Discipline } from "@/content/learn";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/components/providers/locale-provider";

const ORDER: Discipline[] = ["nursing", "nutrition", "physiotherapy", "psychology", "anaesthesia", "oncology", "caregiving"];

export function LearnBrowser() {
  const locale = useLocale();
  const [discipline, setDiscipline] = useState<Discipline | "all">("all");
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const base = q.trim() ? searchArticles(q, ARTICLES.length) : ARTICLES;
    return discipline === "all" ? base : base.filter((a) => a.discipline === discipline);
  }, [q, discipline]);

  const chip = (key: Discipline | "all", label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setDiscipline(key)}
      aria-pressed={discipline === key}
      className={cn(
        "h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition",
        discipline === key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/50",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={locale === "hi" ? "खोजें, जैसे घाव, खाना, ड्रेन" : "Search, e.g. wound, food, drain, worry"}
          className="pl-10"
          aria-label={locale === "hi" ? "जानकारी खोजें" : "Search articles"}
          maxLength={120}
        />
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {chip("all", locale === "hi" ? "सभी" : "All")}
        {ORDER.map((d) => chip(d, DISCIPLINE_LABELS[d][locale]))}
      </div>
      {results.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {locale === "hi"
            ? "कुछ नहीं मिला। आप अपना सवाल 'केयर टीम' पेज से टीम को भेज सकते हैं।"
            : "Nothing found. You can send your question to your team from the Care team page."}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((a) => (
            <Link key={a.slug} href={`/learn/${a.slug}`} className="flex flex-col gap-2 rounded-2xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm">
              <span className="text-xs font-medium tracking-wide text-primary uppercase">{DISCIPLINE_LABELS[a.discipline][locale]}</span>
              <span className="font-semibold leading-snug">{a.title[locale]}</span>
              <span className="text-sm text-muted-foreground">{a.summary[locale]}</span>
              <span className="mt-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {a.minutes} {locale === "hi" ? "मिनट" : "min read"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
