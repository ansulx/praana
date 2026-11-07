import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Check, Sparkles } from "lucide-react";
import { getSession } from "@/content/guided";
import { JOURNEY_STAGES, computeStage } from "@/content/journey";
import { getArticle } from "@/content/learn";
import { dayOffset, formatDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TaskList } from "@/components/journey/task-list";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { getCompletedTaskKeys } from "@/server/services/guided";

export const metadata: Metadata = { title: "My journey" };

const L = {
  title: { en: "My recovery journey", hi: "मेरी रिकवरी का सफ़र" },
  sub: { en: "Recovery begins before surgery. Here's where you are, and what helps at each step.", hi: "रिकवरी सर्जरी से पहले शुरू होती है। आप कहां हैं, और हर क़दम पर क्या मदद करता है।" },
  now: { en: "You are here", hi: "आप यहां हैं" },
  needs: { en: "What matters now", hi: "अभी क्या ज़रूरी है" },
  sessions: { en: "Guided sessions", hi: "अभ्यास" },
  read: { en: "Read", hi: "पढ़ें" },
  done: { en: "done", hi: "पूरे" },
  noDate: { en: "Add your surgery date in Settings so PRAANA can show the right stage.", hi: "सही चरण दिखाने के लिए सेटिंग्स में सर्जरी की तारीख़ जोड़ें।" },
};

export default async function JourneyPage() {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) redirect("/home");
  const locale = user.locale;
  const p = ctx.patient;

  const current = computeStage({ surgeryDate: p.surgeryDate, dischargeDate: p.dischargeDate });
  const currentIdx = JOURNEY_STAGES.findIndex((s) => s.key === current);
  const done = await getCompletedTaskKeys(p.id);
  const doneSet = new Set(done);
  const day = dayOffset(p.surgeryDate);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{L.title[locale]}</h1>
        <p className="max-w-2xl text-muted-foreground">{L.sub[locale]}</p>
        <p className="text-sm font-medium text-primary">{formatDayLabel(day, locale)}</p>
        {!p.surgeryDate && <p className="rounded-xl bg-amber-soft p-3 text-sm text-navy">{L.noDate[locale]}</p>}
      </header>

      <ol className="relative space-y-6">
        {JOURNEY_STAGES.map((stage, i) => {
          const state = i < currentIdx ? "past" : i === currentIdx ? "current" : "future";
          const total = stage.tasks.length;
          const completed = stage.tasks.filter((t) => doneSet.has(t.key)).length;
          return (
            <li key={stage.key} className="relative grid grid-cols-[2.5rem_1fr] gap-4">
              {i < JOURNEY_STAGES.length - 1 && (
                <span aria-hidden className={cn("absolute top-11 bottom-[-1.5rem] left-5 w-0.5 -translate-x-1/2", i < currentIdx ? "bg-primary" : "bg-border")} />
              )}
              <span
                className={cn(
                  "relative z-10 grid size-10 place-items-center rounded-full border-2 text-sm font-semibold",
                  state === "past" && "border-primary bg-primary text-primary-foreground",
                  state === "current" && "border-primary bg-background text-primary ring-4 ring-primary/15",
                  state === "future" && "border-border bg-background text-muted-foreground",
                )}
              >
                {state === "past" ? <Check className="size-5" /> : stage.index}
              </span>

              <section
                aria-current={state === "current" ? "step" : undefined}
                className={cn("rounded-2xl border bg-card p-5", state === "current" && "border-primary/40 shadow-sm", state === "future" && "bg-card/60")}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className={cn("text-lg font-semibold", state === "future" && "text-muted-foreground")}>{stage.title[locale]}</h2>
                  {state === "current" && <Badge>{L.now[locale]}</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {completed}/{total} {L.done[locale]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{stage.description[locale]}</p>
                <Progress value={(completed / total) * 100} className="mt-3 h-1.5" />

                {(state === "current" || state === "past") && (
                  <div className="mt-4 space-y-4">
                    {state === "current" && (
                      <p className="text-xs font-medium tracking-wide text-primary uppercase">
                        {L.needs[locale]}: <span className="normal-case">{stage.needs[locale]}</span>
                      </p>
                    )}
                    <TaskList tasks={stage.tasks} done={done} />
                  </div>
                )}
                {state === "future" && (
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {stage.tasks.map((t) => (
                      <li key={t.key}>· {t.title[locale]}</li>
                    ))}
                  </ul>
                )}

                {state === "current" && (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                        <Sparkles className="size-4 text-primary" /> {L.sessions[locale]}
                      </h3>
                      <ul className="space-y-1.5">
                        {stage.sessions.map((slug) => {
                          const s = getSession(slug);
                          if (!s) return null;
                          return (
                            <li key={slug}>
                              <Link href={`/guided/${slug}`} className="text-sm text-primary underline-offset-4 hover:underline">
                                {s.title[locale]}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div>
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                        <BookOpen className="size-4 text-primary" /> {L.read[locale]}
                      </h3>
                      <ul className="space-y-1.5">
                        {stage.articles.map((slug) => {
                          const a = getArticle(slug);
                          if (!a) return null;
                          return (
                            <li key={slug}>
                              <Link href={`/learn/${slug}`} className="text-sm text-primary underline-offset-4 hover:underline">
                                {a.title[locale]}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )}
              </section>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
