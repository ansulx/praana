import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HeartHandshake, MessageSquareQuote, Sparkles, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DomainTrend, type TrendPoint } from "@/components/charts/domain-trend";
import { DOMAINS, optionLabel, WOUND_OPTIONS } from "@/lib/domains";
import { daysBetween, fmtDate, fmtTime, formatDayLabel, localYmd } from "@/lib/dates";
import { TRIAGE_STYLE } from "@/lib/labels";
import { dailySeries } from "@/lib/series";
import { cn } from "@/lib/utils";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { listCheckins } from "@/server/services/checkins";
import { getSharedNotes } from "@/server/services/patient";

export const metadata: Metadata = { title: "My recovery story" };

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) notFound();
  const locale = user.locale;
  const hi = locale === "hi";
  const { range } = await searchParams;
  const days = range === "90" ? 90 : range === "14" ? 14 : 30;

  const [rows, notes] = await Promise.all([listCheckins(ctx.patient.id, { sinceDays: days, limit: 300 }), getSharedNotes(ctx.patient.id, 20)]);

  const keys = ["pain", "appetite", "nausea", "mobility", "sleep", "mood", "anxiety", "temperatureC"] as const;
  const series = Object.fromEntries(keys.map((k) => [k, dailySeries(rows, Math.min(days, 30), k)]));
  const chartData: TrendPoint[] = series.pain.map((p, i) => ({
    date: p.date,
    label: fmtDate(`${p.date}T12:00:00+05:30`),
    ...Object.fromEntries(keys.map((k) => [k, series[k][i].value])),
  }));

  // Merge check-ins and shared team notes into one story, grouped by local day.
  type Entry = { kind: "checkin"; at: Date; row: (typeof rows)[number] } | { kind: "note"; at: Date; note: (typeof notes)[number] };
  const entries: Entry[] = [
    ...rows.map((row) => ({ kind: "checkin" as const, at: row.createdAt, row })),
    ...notes.filter((n) => daysBetween(localYmd(n.createdAt), localYmd()) <= days).map((note) => ({ kind: "note" as const, at: note.createdAt, note })),
  ].sort((a, b) => +b.at - +a.at);
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const d = localYmd(e.at);
    groups.set(d, [...(groups.get(d) ?? []), e]);
  }
  const surgeryDate = ctx.patient.surgeryDate;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy">{hi ? "मेरी रिकवरी कहानी" : "My recovery story"}</h1>
          <p className="mt-1 text-muted-foreground">{hi ? "हर हाल, आपके अपने शब्दों में। आपकी टीम भी यही देखती है।" : "Every update, in your own words. The same story your care team sees."}</p>
        </div>
        <div className="flex rounded-xl border bg-card p-1 text-sm">
          {[14, 30, 90].map((d) => (
            <Link key={d} href={`/timeline?range=${d}`} className={cn("rounded-lg px-3 py-1.5 font-medium", days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {d} {hi ? "दिन" : "days"}
            </Link>
          ))}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{hi ? "रुझान" : "Trends"}</CardTitle>
        </CardHeader>
        <CardContent>
          <DomainTrend data={chartData} />
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-10 text-center">
          <p className="font-medium">{hi ? "आपकी कहानी यहाँ दिखेगी" : "Your story will appear here"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{hi ? "पहला हाल बताएं।" : "Share your first check-in to begin."}</p>
          <Button asChild className="mt-4">
            <Link href="/check-in">{hi ? "हाल बताएं" : "Check in"}</Link>
          </Button>
        </div>
      ) : (
        <ol className="relative grid gap-8 border-l-2 border-primary/15 pl-6 sm:pl-8">
          {[...groups.entries()].map(([date, list]) => {
            const offset = surgeryDate ? daysBetween(surgeryDate, date) : null;
            return (
              <li key={date} className="relative">
                <span className="absolute top-1 -left-[33px] size-4 rounded-full border-4 border-background bg-primary sm:-left-[41px]" aria-hidden />
                <h2 className="font-heading font-semibold">
                  {formatDayLabel(offset, locale)} <span className="font-normal text-muted-foreground">· {fmtDate(`${date}T12:00:00+05:30`)}</span>
                </h2>
                <div className="mt-3 grid gap-3">
                  {list.map((e) =>
                    e.kind === "note" ? (
                      <div key={`n-${e.note.id}`} className="rounded-2xl border border-primary/20 bg-mint p-4 text-sm">
                        <p className="flex items-center gap-2 font-semibold text-primary">
                          <MessageSquareQuote className="size-4" /> {e.note.author} · {fmtTime(e.at)}
                        </p>
                        <p className="mt-2 leading-relaxed">{e.note.body}</p>
                      </div>
                    ) : (
                      <CheckinCard key={e.row.id} row={e.row} locale={locale} />
                    ),
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function CheckinCard({ row, locale }: { row: Awaited<ReturnType<typeof listCheckins>>[number]; locale: "en" | "hi" }) {
  const hi = locale === "hi";
  const chips = DOMAINS.filter((d) => row[d.key] !== null).map((d) => ({
    key: d.key,
    label: hi ? d.hi : d.en,
    value: d.key === "pain" ? `${row.pain}/10` : optionLabel(d.key, row[d.key], locale),
    concern: (row[d.key] as number) >= (d.key === "pain" ? 7 : 3),
  }));
  const wound = row.wound ? WOUND_OPTIONS.find((w) => w.value === row.wound) : null;
  return (
    <article className="rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{fmtTime(row.createdAt)}</span>
        {row.reporterRole === "caregiver" ? (
          <Badge variant="secondary">
            <HeartHandshake /> {hi ? "परिवार" : "Family"}
          </Badge>
        ) : (
          <Badge variant="secondary">
            <UserRound /> {hi ? "आप" : "You"}
          </Badge>
        )}
        {row.triage !== "none" && (
          <Badge variant="outline" className={TRIAGE_STYLE[row.triage].className}>
            {TRIAGE_STYLE[row.triage][locale]}
          </Badge>
        )}
        {row.aiStatus === "done" && <Sparkles className="size-3.5 text-primary" aria-label="Organised by AI" />}
      </div>
      {row.freeText && (
        <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap" lang={/[ऀ-ॿ]/.test(row.freeText) ? "hi" : "en"}>
          {row.freeText}
        </p>
      )}
      {(chips.length > 0 || wound || row.temperatureC) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className={cn("rounded-full px-2.5 py-1 text-xs", c.concern ? "bg-coral-soft text-coral" : "bg-muted text-muted-foreground")}>
              {c.label}: <b className="font-semibold">{c.value}</b>
            </span>
          ))}
          {wound && (
            <span className={cn("rounded-full px-2.5 py-1 text-xs", ["no_wound", "healing_well"].includes(wound.value) ? "bg-muted text-muted-foreground" : "bg-coral-soft text-coral")}>
              {hi ? "घाव" : "Wound"}: <b>{wound[locale]}</b>
            </span>
          )}
          {row.temperatureC !== null && (
            <span className={cn("rounded-full px-2.5 py-1 text-xs", row.temperatureC >= 37.5 ? "bg-coral-soft text-coral" : "bg-muted text-muted-foreground")}>
              {hi ? "तापमान" : "Temp"}: <b>{row.temperatureC}°C</b>
            </span>
          )}
        </div>
      )}
      {row.photoIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.photoIds.map((id) => (
            <a key={id} href={`/api/photos/${id}`} target="_blank" rel="noopener noreferrer" className="block size-20 overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${id}`} alt={hi ? "भेजी गई फ़ोटो" : "Photo you shared"} className="size-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
