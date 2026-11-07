import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ListChecks, ShieldCheck, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignalRing } from "@/components/recovery/signal-ring";
import { dayOffset, formatDayLabel, localYmd } from "@/lib/dates";
import { assessRecovery, pickLocale, SIGNAL_STYLE } from "@/lib/recovery/insights";
import { buildPlanFromInsights } from "@/lib/recovery/plan";
import { cn } from "@/lib/utils";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { listCheckins } from "@/server/services/checkins";
import { getOpenAlertLevel, getTeamQuestions } from "@/server/services/patient";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ head?: string }>;
}) {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) notFound();
  const locale = user.locale;
  const hi = locale === "hi";
  const sp = await searchParams;

  const [checkins, openLevel, questions] = await Promise.all([
    listCheckins(ctx.patient.id, { sinceDays: 30, limit: 60 }),
    getOpenAlertLevel(ctx.patient.id),
    getTeamQuestions(ctx.patient.id, 20),
  ]);

  const day = dayOffset(ctx.patient.surgeryDate);
  const insights = assessRecovery({
    dayOffset: day,
    hasDrain: ctx.patient.hasDrain,
    checkins,
    hasOpenUrgent: openLevel === "urgent",
    unansweredQuestions: questions.filter((q) => !q.answer).length,
  });

  const selected =
    insights.heads.find((h) => h.id === sp.head) ??
    [...insights.heads].sort((a, b) => b.score - a.score)[0];

  const today = localYmd();
  const checkedInToday = checkins.some((c) => localYmd(c.createdAt) === today);
  const planPreview = buildPlanFromInsights(insights, { checkedInToday }).slice(0, 3);

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          {hi ? "इनसाइट्स" : "Insights"} · {formatDayLabel(day, locale)}
        </p>
        <h1 className="font-heading text-3xl font-bold text-balance text-navy sm:text-4xl">
          {hi ? "आपकी रिकवरी की तस्वीर" : "Your recovery picture"}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {hi
            ? "चेक-इन से व्यवस्थित संकेत — समझाने योग्य, देखभाल टीम के लिए अवलोकन। निदान नहीं।"
            : "Signals organised from your check-ins — explainable for you, observations for your care team. Never a diagnosis."}
        </p>
      </header>

      {/* Hero strip */}
      <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-mint/80 via-card to-background">
        <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-8">
          <SignalRing
            score={insights.overall.score}
            level={insights.overall.level}
            label={SIGNAL_STYLE[insights.overall.level][locale]}
            size={128}
          />
          <div>
            <p className="text-sm text-muted-foreground">{hi ? "समग्र स्थिति" : "Overall"}</p>
            <p className="mt-1 font-heading text-2xl font-bold text-navy">{pickLocale(insights.overall.label, locale)}</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {pickLocale(selected.summary, locale)}
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <Link href="/plan">
              <ListChecks className="size-4" /> {hi ? "प्लान बनाएं" : "Build my plan"}
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Head list — calmer cards, not rigid ALL CAPS rows */}
        <section className="grid content-start gap-2">
          <h2 className="mb-1 font-heading text-lg font-semibold text-navy">{hi ? "छह सिग्नल" : "Six signals"}</h2>
          {insights.heads.map((h) => {
            const active = h.id === selected.id;
            return (
              <Link
                key={h.id}
                href={`/insights?head=${h.id}`}
                className={cn(
                  "rounded-2xl border px-4 py-3.5 transition",
                  active ? "border-primary/40 bg-mint shadow-sm" : "bg-card hover:border-primary/25",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", SIGNAL_STYLE[h.level].className)}>
                        {SIGNAL_STYLE[h.level][locale]}
                      </span>
                      <span className="font-semibold text-navy">{pickLocale(h.title, locale)}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{pickLocale(h.summary, locale)}</p>
                  </div>
                  <span className="font-heading text-2xl font-bold tabular-nums text-navy">{h.score}</span>
                </div>
              </Link>
            );
          })}
        </section>

        {/* Detail panel */}
        <section className="grid content-start gap-5 rounded-3xl border bg-card p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-2xl font-bold text-navy">{pickLocale(selected.title, locale)}</h2>
              <p className="mt-2 text-muted-foreground">{pickLocale(selected.summary, locale)}</p>
            </div>
            <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", SIGNAL_STYLE[selected.level].className)}>
              {SIGNAL_STYLE[selected.level][locale]} · {selected.score}
            </span>
          </div>

          <div className="rounded-2xl border border-primary/15 bg-mint/50 p-4">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-primary uppercase">
              <Stethoscope className="size-3.5" /> {hi ? "केयर टीम के लिए अवलोकन" : "For your care team"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-navy">{pickLocale(selected.careTeamNote, locale)}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {hi ? "यह स्कोर क्यों" : "Why this score"}
            </h3>
            <ul className="mt-3 grid gap-3">
              {selected.factors.map((f) => (
                <li key={f.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span>{pickLocale(f.label, locale)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {f.contribution} · {f.direction === "increases" ? (hi ? "बढ़ाता" : "raises") : hi ? "घटाता" : "lowers"}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", f.direction === "increases" ? "bg-coral/70" : "bg-primary/70")}
                      style={{ width: `${f.contribution}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {hi ? "आप क्या कर सकते हैं" : "What you can do"}
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-1">
              {selected.recommendations.map((r) => (
                <li key={r.en} className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm leading-snug">
                  {pickLocale(r, locale)}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium text-navy">{hi ? "प्लान में जोड़ें" : "Carry into your plan"}</p>
            <ul className="grid gap-2">
              {planPreview.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm hover:border-primary/40 hover:bg-mint/40">
                    <span className="line-clamp-1">{hi ? a.title.hi : a.title.en}</span>
                    <ArrowRight className="size-4 shrink-0 text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-4 w-full" variant="secondary">
              <Link href="/plan">{hi ? "पूरा प्लान खोलें" : "Open full plan"}</Link>
            </Button>
          </div>
        </section>
      </div>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        {pickLocale(insights.disclaimer, locale)}
      </p>
    </div>
  );
}
