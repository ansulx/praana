import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, CheckCircle2 } from "lucide-react";
import { FOLLOW_TEAM_NOTE, getSession } from "@/content/guided";
import { evaluateAll, recommendSessions } from "@/lib/guided/eligibility";
import { fmtDateTime, relativeTime } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GuidedLibrary } from "@/components/guided/guided-library";
import { JoinButton } from "@/components/guided/join-button";
import { SessionCard } from "@/components/guided/session-card";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { getEligibilityContext, getRecentCompletions } from "@/server/services/guided";
import { getUpcomingAppointments } from "@/server/services/patient";

export const metadata: Metadata = { title: "Guided recovery" };

const L = {
  title: { en: "Guided recovery", hi: "निर्देशित अभ्यास" },
  sub: {
    en: "Breathing, meditation, gentle yoga and physiotherapy, unlocked at the right time for your recovery.",
    hi: "सांस, ध्यान, हल्का योग और फ़िज़ियोथेरेपी। आपकी रिकवरी के सही समय पर।",
  },
  live: { en: "Live sessions with your team", hi: "टीम के साथ लाइव सत्र" },
  forYou: { en: "Recommended for today", hi: "आज के लिए सुझाव" },
  library: { en: "All sessions", hi: "सभी अभ्यास" },
  recent: { en: "Recently completed", hi: "हाल में पूरे किए" },
  none: { en: "Nothing yet. Your completed sessions will show here.", hi: "अभी कुछ नहीं, पूरे किए अभ्यास यहां दिखेंगे।" },
  felt: { better: { en: "Felt better", hi: "बेहतर लगा" }, same: { en: "About the same", hi: "पहले जैसा" }, worse: { en: "Felt worse", hi: "ख़राब लगा" } },
  partial: { en: "Stopped early", hi: "बीच में रोका" },
  min: { en: "min", hi: "मिनट" },
  tele: { en: "Live physio", hi: "लाइव फ़िज़ियो" },
  video: { en: "Video call", hi: "वीडियो कॉल" },
};

export default async function GuidedPage() {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) redirect("/home");
  const locale = user.locale;
  const role = user.role === "caregiver" ? "caregiver" : "patient";

  const [eligCtx, completions, appts] = await Promise.all([
    getEligibilityContext(ctx, role),
    getRecentCompletions(ctx.patient.id, 14),
    getUpcomingAppointments(ctx.patient.id, 10),
  ]);

  const now = Date.now();
  const all = evaluateAll(eligCtx, now);
  const recs = recommendSessions(eligCtx, 3, now);
  const live = appts.filter((a) => a.kind === "tele_physio" || a.kind === "video");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{L.title[locale]}</h1>
        <p className="max-w-2xl text-muted-foreground">{L.sub[locale]}</p>
        <p className="max-w-2xl text-xs text-muted-foreground">{FOLLOW_TEAM_NOTE[locale]}</p>
      </header>

      {live.length > 0 && (
        <section aria-labelledby="live-h" className="space-y-3">
          <h2 id="live-h" className="text-lg font-semibold">{L.live[locale]}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {live.map((a) => (
              <Card key={a.id} className="py-4">
                <CardContent className="flex items-center gap-4 px-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mint text-primary">
                    <CalendarClock className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Badge variant="secondary" className="mb-1">{a.kind === "tele_physio" ? L.tele[locale] : L.video[locale]}</Badge>
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {fmtDateTime(a.startsAt)}
                      {a.withName ? ` · ${a.withName}` : ""}
                    </p>
                  </div>
                  <JoinButton startsAt={new Date(a.startsAt).toISOString()} durationMin={a.durationMin} joinUrl={a.joinUrl} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {recs.length > 0 && (
        <section aria-labelledby="rec-h" className="space-y-3">
          <h2 id="rec-h" className="text-lg font-semibold">{L.forYou[locale]}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {recs.map((r) => (
              <SessionCard key={r.session.slug} session={r.session} eligibility={{ status: "recommended" }} reason={r.reason} locale={locale} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="lib-h" className="space-y-3">
        <h2 id="lib-h" className="text-lg font-semibold">{L.library[locale]}</h2>
        <GuidedLibrary items={all} />
      </section>

      <section aria-labelledby="recent-h">
        <Card>
          <CardHeader>
            <CardTitle id="recent-h">{L.recent[locale]}</CardTitle>
          </CardHeader>
          <CardContent>
            {completions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{L.none[locale]}</p>
            ) : (
              <ul className="divide-y">
                {completions.slice(0, 6).map((c) => {
                  const s = getSession(c.sessionSlug);
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-3">
                      <CheckCircle2 className="size-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{s ? s.title[locale] : c.sessionSlug}</p>
                        <p className="text-xs text-muted-foreground">
                          {relativeTime(c.createdAt)} · {Math.max(1, Math.round(c.durationSec / 60))} {L.min[locale]}
                          {!c.completedFully ? ` · ${L.partial[locale]}` : ""}
                        </p>
                      </div>
                      {c.feltAfter && (
                        <Badge variant={c.feltAfter === "worse" ? "destructive" : "secondary"}>{L.felt[c.feltAfter][locale]}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
