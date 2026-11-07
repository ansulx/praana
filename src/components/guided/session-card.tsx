import Link from "next/link";
import { Clock, Lock, Star } from "lucide-react";
import { CATEGORY_LABELS, type Bi, type GuidedSession } from "@/content/guided";
import type { Eligibility } from "@/lib/guided/eligibility";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_ICON, CATEGORY_TINT } from "./category-meta";

const L = {
  min: { en: "min", hi: "मिनट" },
  recommended: { en: "For you", hi: "आपके लिए" },
  locked: { en: "Not yet", hi: "अभी नहीं" },
};

export function SessionCard({
  session,
  eligibility,
  locale,
  reason,
}: {
  session: GuidedSession;
  eligibility: Eligibility;
  locale: Locale;
  reason?: Bi;
}) {
  const Icon = CATEGORY_ICON[session.category];
  const locked = eligibility.status === "locked";
  const note = locked ? eligibility.reason : reason;

  return (
    <Link
      href={`/guided/${session.slug}`}
      className={cn(
        "group flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        locked && "bg-muted/40",
      )}
      aria-label={`${session.title[locale]}${locked ? `, ${L.locked[locale]}` : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", locked ? "bg-muted text-muted-foreground" : CATEGORY_TINT[session.category])}>
          {locked ? <Lock className="size-5" /> : <Icon className="size-5" />}
        </span>
        {eligibility.status === "recommended" && (
          <Badge className="gap-1">
            <Star className="fill-current" />
            {L.recommended[locale]}
          </Badge>
        )}
      </div>
      <div className="flex-1">
        <h3 className={cn("text-base leading-snug font-semibold", locked && "text-muted-foreground")}>{session.title[locale]}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{session.summary[locale]}</p>
      </div>
      {note && <p className={cn("rounded-lg px-2.5 py-1.5 text-xs", locked ? "bg-background text-muted-foreground" : "bg-mint text-primary")}>{note[locale]}</p>}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" />
          {session.minutes} {L.min[locale]}
        </span>
        <span>·</span>
        <span>{CATEGORY_LABELS[session.category][locale]}</span>
      </div>
    </Link>
  );
}
