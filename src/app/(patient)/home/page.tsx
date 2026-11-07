import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, HeartPulse, MessageCircleHeart, CalendarHeart, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dayOffset, fmtDateTime, formatDayLabel, localYmd, relativeTime } from "@/lib/dates";
import { greeting, pick, t } from "@/lib/i18n";
import { TRIAGE_STYLE } from "@/lib/labels";
import { computeStage, JOURNEY_STAGES } from "@/content/journey";
import { cn } from "@/lib/utils";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { listCheckins } from "@/server/services/checkins";
import { getOpenAlertLevel, getSharedNotes, getTeamQuestions, getUpcomingAppointments } from "@/server/services/patient";

export const metadata: Metadata = { title: "Today" };

function hourInIndia() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(new Date())) % 24;
}

/**
 * Simple home: one job. Check in (or prepare before surgery).
 * Insights/plan/guided stay available under More — not a dashboard.
 */
export default async function HomePage() {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) notFound();
  const locale = user.locale;
  const hi = locale === "hi";
  const p = ctx.patient;

  const [recent, openLevel, appts, notes, questions] = await Promise.all([
    listCheckins(p.id, { sinceDays: 14, limit: 20 }),
    getOpenAlertLevel(p.id),
    getUpcomingAppointments(p.id, 1),
    getSharedNotes(p.id, 1),
    getTeamQuestions(p.id, 3),
  ]);

  const today = localYmd();
  const todays = recent.filter((c) => localYmd(c.createdAt) === today);
  const latest = recent[0] ?? null;
  const day = dayOffset(p.surgeryDate);
  const stageKey = computeStage(p);
  const stage = JOURNEY_STAGES.find((s) => s.key === stageKey)!;
  const preOp = stageKey === "prepare" || stageKey === "meet";
  const firstName = (ctx.viewerRelation === "self" ? user.name : ctx.patientName).split(" ")[0];
  const answered = questions.find((q) => q.answer);
  const next = appts[0];

  return (
    <div className="mx-auto grid max-w-lg gap-8">
      <header>
        <p className="text-sm font-medium text-primary">
          {formatDayLabel(day, locale)} · {pick(stage.title, locale)}
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-balance text-navy">
          {ctx.viewerRelation === "self"
            ? `${greeting(locale, hourInIndia())}, ${firstName}`
            : hi
              ? `${firstName} की रिकवरी`
              : `${firstName}'s recovery`}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {preOp
            ? hi
              ? "सर्जरी से पहले — सूची पूरी करें, या आज का हाल बताएं।"
              : "Before surgery — finish your list, or tell us how you feel today."
            : hi
              ? "आज कैसा महसूस हो रहा है, बताएं। आपकी केयर टीम आपकी कहानी देख सकती है।"
              : "Tell us how today feels. Your care team can see your recovery story."}
        </p>
      </header>

      {/* One primary action */}
      <section
        className={cn(
          "rounded-3xl border-2 p-6",
          todays.length && !preOp ? "border-primary/20 bg-card" : "border-primary/40 bg-mint/60",
        )}
      >
        {preOp ? (
          <>
            <h2 className="font-heading text-xl font-semibold text-navy">
              {hi ? "सर्जरी से पहले की सूची" : "Pre-surgery list"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {hi
                ? "दवाएं, एलर्जी, उपवास — टीम से मिलने से पहले।"
                : "Medicines, allergies, fasting — before you meet the team."}
            </p>
            <Button asChild size="lg" className="mt-5 w-full">
              <Link href="/journey">
                {hi ? "सूची खोलें" : "Open list"} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="mt-3 w-full">
              <Link href="/check-in">{hi ? "बोलकर हाल बताएं" : "Speak how you feel"}</Link>
            </Button>
          </>
        ) : todays.length ? (
          <div className="flex gap-4">
            <CheckCircle2 className="mt-1 size-8 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-xl font-semibold">{t(locale, "home.checkinDone")}</h2>
              <p className="mt-1 text-muted-foreground">{t(locale, "home.checkinDoneBody")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline" className={TRIAGE_STYLE[todays[0].triage].className}>
                  {TRIAGE_STYLE[todays[0].triage][locale]}
                </Badge>
                <span className="text-muted-foreground">{relativeTime(todays[0].createdAt)}</span>
              </div>
              {openLevel && (
                <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">{t(locale, "home.teamReviewing")}</p>
              )}
              <div className="mt-5 grid gap-2">
                <Button asChild size="lg" className="w-full">
                  <Link href="/timeline">
                    {hi ? "मेरी कहानी देखें" : "See it on My story"} <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full">
                  <Link href="/check-in">{t(locale, "home.checkinAgain")}</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <HeartPulse className="size-8 shrink-0 text-primary" />
              <div>
                <h2 className="font-heading text-xl font-semibold">{t(locale, "home.howToday")}</h2>
                <p className="mt-1 text-muted-foreground">
                  {latest
                    ? hi
                      ? `पिछला हाल ${relativeTime(latest.createdAt)}। बोलें या दर्द टैप करें — लिखना ज़रूरी नहीं।`
                      : `Last check-in ${relativeTime(latest.createdAt)}. Speak or tap pain — typing optional.`
                    : hi
                      ? "माइक दबाकर बोलें, या दर्द का नंबर टैप करें।"
                      : "Tap the mic and speak, or tap a pain number."}
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="mt-5 w-full">
              <Link href="/check-in">
                {t(locale, "home.checkinCta")} <ArrowRight />
              </Link>
            </Button>
          </>
        )}
      </section>

      {next && (
        <section className="rounded-2xl border bg-card px-4 py-4">
          <p className="text-xs font-medium text-muted-foreground">{hi ? "अगली मुलाकात" : "Next visit"}</p>
          <p className="mt-1 font-heading text-lg font-semibold text-navy">{next.title}</p>
          <p className="text-sm text-muted-foreground">
            {fmtDateTime(next.startsAt)}
            {next.withName ? ` · ${next.withName}` : ""}
          </p>
        </section>
      )}

      {(notes[0] || answered) && (
        <section className="rounded-2xl border bg-card px-4 py-4 text-sm">
          <p className="text-xs font-medium text-muted-foreground">{t(locale, "home.fromTeam")}</p>
          {notes[0] && <p className="mt-2 leading-relaxed text-navy">{notes[0].body}</p>}
          {answered && (
            <Link href="/care-team" className="mt-2 block text-primary hover:underline">
              “{answered.question}” — {hi ? "जवाब देखें" : "see reply"}
            </Link>
          )}
        </section>
      )}

      {/* Three quiet doors — not a dashboard */}
      <nav className="grid grid-cols-3 gap-3" aria-label={hi ? "और विकल्प" : "More"}>
        <Link
          href="/companion"
          className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-2 py-4 text-center text-sm font-medium hover:border-primary/40"
        >
          <MessageCircleHeart className="size-6 text-primary" />
          {hi ? "पूछें" : "Ask"}
        </Link>
        <Link
          href="/timeline"
          className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-2 py-4 text-center text-sm font-medium hover:border-primary/40"
        >
          <CalendarHeart className="size-6 text-primary" />
          {hi ? "कहानी" : "My story"}
        </Link>
        <Link
          href="/care-team"
          className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-2 py-4 text-center text-sm font-medium hover:border-primary/40"
        >
          <Users className="size-6 text-primary" />
          {hi ? "टीम" : "Care team"}
        </Link>
      </nav>

      <p className="text-center text-xs text-muted-foreground">
        {hi
          ? "PRAANA निदान नहीं करता। फ़ैसला केयर टीम का है।"
          : "PRAANA does not diagnose. Your care team decides."}
      </p>
    </div>
  );
}
