import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, ChevronRight, Clock3, MessageCircleQuestion, ClipboardList, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LiveUpdates } from "@/components/clinic/live-updates";
import { PainSparkline, PriorityBadge, TriageBadge } from "@/components/clinic/badges";
import { formatDayLabel, relativeTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { getWorklist, type WorklistRow } from "@/server/services/clinic";

export const metadata: Metadata = { title: "Worklist" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "review", label: "Needs a person" },
  { key: "silent", label: "No recent check-in" },
  { key: "stable", label: "Steady" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const SURGERY: Record<string, string> = {
  breast: "Breast",
  colorectal: "Colorectal",
  head_neck: "Head & neck",
  gynaecologic: "Gynaecologic",
  thoracic: "Thoracic",
  upper_gi: "Upper GI",
  urologic: "Urologic",
  other: "Other",
};

const needsReview = (r: WorklistRow) => r.priority === "urgent" || r.priority === "review" || r.priority === "worsening";

function applyFilter(rows: WorklistRow[], f: FilterKey) {
  if (f === "review") return rows.filter(needsReview);
  if (f === "silent") return rows.filter((r) => r.priority === "silent" || r.silent);
  if (f === "stable") return rows.filter((r) => r.priority === "stable" || r.priority === "question");
  return rows;
}

export default async function WorklistPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireUser(["clinician"]);
  const { filter: rawFilter } = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === rawFilter) ? (rawFilter as FilterKey) : "all";
  const rows = await getWorklist(user.id);
  const visible = applyFilter(rows, filter);
  const now = new Date();

  const stats = [
    { label: "Needs a person", value: rows.filter(needsReview).length, icon: ClipboardList, tone: "text-amber" },
    { label: "Urgent now", value: rows.filter((r) => r.priority === "urgent").length, icon: BellRing, tone: "text-coral" },
    { label: "Quiet ≥ 2 days", value: rows.filter((r) => r.silent).length, icon: Clock3, tone: "text-muted-foreground" },
    { label: "Patients", value: rows.length, icon: Users, tone: "text-primary" },
  ];
  const names = Object.fromEntries(rows.map((r) => [r.patientId, r.name]));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Recovery worklist</h1>
          <p className="text-sm text-muted-foreground">Ordered by who needs a person to look first. Alerts are prompts for human review, not decisions.</p>
        </div>
        <LiveUpdates patientNames={names} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="py-4">
            <CardContent className="flex items-center gap-3 px-4">
              <s.icon className={cn("size-5 shrink-0", s.tone)} />
              <div>
                <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" aria-label="Filter patients">
        {FILTERS.map((f) => {
          const count = applyFilter(rows, f.key).length;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/clinic" : `/clinic?filter=${f.key}`}
              scroll={false}
              aria-current={filter === f.key ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition",
                filter === f.key ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
              )}
            >
              {f.label}
              <span className="rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums">{count}</span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-2 py-16 text-center">
            <Users className="size-10 text-muted-foreground/50" />
            <p className="font-semibold">No patients yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Use <strong>Add patient</strong> with the code a patient generates under Settings → Share with care team.
            </p>
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">Nobody in this group right now.</CardContent>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.4fr)_24px] gap-4 border-b bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase lg:grid">
            <span>Patient</span>
            <span>Status</span>
            <span>Last check-in</span>
            <span>Pain · 7 days</span>
            <span>Why</span>
            <span />
          </div>
          <ul className="divide-y">
            {visible.map((r) => (
              <li key={r.patientId}>
                <Link
                  href={`/clinic/patients/${r.patientId}`}
                  className={cn(
                    "grid gap-2 px-4 py-3.5 transition hover:bg-accent/50 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2.4fr)_24px] lg:items-center lg:gap-4",
                    r.priority === "urgent" && "border-l-4 border-l-coral bg-coral-soft/40",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{r.name}</span>
                      {r.age !== null && <span className="text-xs text-muted-foreground">{r.age}y</span>}
                      {r.unanswered > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-1.5 text-xs font-medium text-accent-foreground" title="Unanswered questions">
                          <MessageCircleQuestion className="size-3" />
                          {r.unanswered}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.surgeryName ?? SURGERY[r.surgeryType]} · {formatDayLabel(r.dayOffset)} · {r.stage}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PriorityBadge priority={r.priority} />
                    {r.openAlert?.status === "acknowledged" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Alert seen · follow up
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm lg:block">
                    <span className={cn(r.silent && "font-medium text-coral")}>{r.lastCheckinAt ? relativeTime(r.lastCheckinAt, now) : "Never"}</span>
                    {r.lastTriage && r.lastTriage !== "none" && <TriageBadge level={r.lastTriage} className="lg:mt-1" />}
                  </div>
                  <PainSparkline points={r.painSeries} />
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {r.openAlert ? r.openAlert.reasons.slice(0, 3).join(" · ") : r.priorityReason}
                  </p>
                  <ChevronRight className="hidden size-4 text-muted-foreground lg:block" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
