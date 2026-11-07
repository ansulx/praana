import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock, Lock } from "lucide-react";
import { CATEGORY_LABELS, getSession } from "@/content/guided";
import { evaluateSession } from "@/lib/guided/eligibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SessionPlayer } from "@/components/guided/session-player";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { getEligibilityContext } from "@/server/services/guided";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getSession((await params).slug);
  return { title: s ? s.title.en : "Session" };
}

const L = {
  back: { en: "All sessions", hi: "सभी अभ्यास" },
  min: { en: "min", hi: "मिनट" },
  lockedTitle: { en: "This session isn't open yet", hi: "यह अभ्यास अभी खुला नहीं है" },
  tryInstead: { en: "Try a breathing session", hi: "सांस का अभ्यास करें" },
  benefits: { en: "Why it may help", hi: "यह कैसे मदद कर सकता है" },
  expert: { en: "From", hi: "विशेषज्ञ" },
};

export default async function GuidedSessionPage({ params }: Props) {
  const { slug } = await params;
  const session = getSession(slug);
  if (!session) notFound();

  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) redirect("/home");
  const locale = user.locale;

  const elig = evaluateSession(session, await getEligibilityContext(ctx, user.role === "caregiver" ? "caregiver" : "patient"));
  if (elig.status === "hidden") notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/guided">
          <ArrowLeft />
          {L.back[locale]}
        </Link>
      </Button>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{CATEGORY_LABELS[session.category][locale]}</Badge>
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {session.minutes} {L.min[locale]}
          </span>
          <span className="text-sm text-muted-foreground">
            · {L.expert[locale]}: {session.expert}
          </span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{session.title[locale]}</h1>
        <p className="text-muted-foreground">{session.summary[locale]}</p>
        {session.benefits.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label={L.benefits[locale]}>
            {session.benefits.map((bn, i) => (
              <span key={i} className="rounded-full bg-mint px-3 py-1 text-xs text-primary">
                {bn[locale]}
              </span>
            ))}
          </div>
        )}
      </header>

      {elig.status === "locked" ? (
        <div className="space-y-4 rounded-2xl border bg-muted/40 p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Lock className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">{L.lockedTitle[locale]}</h2>
          {elig.reason && <p className="mx-auto max-w-md text-muted-foreground">{elig.reason[locale]}</p>}
          <Button asChild>
            <Link href="/guided/calm-breath">{L.tryInstead[locale]}</Link>
          </Button>
        </div>
      ) : (
        <SessionPlayer session={session} />
      )}
    </div>
  );
}
