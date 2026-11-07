import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanChecklist } from "@/components/recovery/plan-checklist";
import { dayOffset, formatDayLabel, localYmd } from "@/lib/dates";
import { assessRecovery, pickLocale } from "@/lib/recovery/insights";
import { buildPlanFromInsights } from "@/lib/recovery/plan";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { listCheckins } from "@/server/services/checkins";
import { getOpenAlertLevel, getTeamQuestions } from "@/server/services/patient";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanPage() {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) notFound();
  const hi = user.locale === "hi";
  const locale = user.locale;

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

  const today = localYmd();
  const checkedInToday = checkins.some((c) => localYmd(c.createdAt) === today);
  const actions = buildPlanFromInsights(insights, { checkedInToday });

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            {hi ? "प्लान" : "Plan"} · {formatDayLabel(day, locale)}
          </p>
          <h1 className="mt-1 font-heading text-3xl font-bold text-balance text-navy sm:text-4xl">
            {hi ? "आज और इस सप्ताह के लिए" : "For today and this week"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {hi
              ? "रिकवरी सिग्नल से जुड़े नरम सुझाव — जीवनशैली और शिक्षा। नुस्खा या खुराक नहीं।"
              : "Gentle nudges from your recovery signals — lifestyle and education. Never prescriptions or doses."}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {hi ? "अभी की तस्वीर: " : "Current picture: "}
            <span className="font-medium text-navy">{pickLocale(insights.overall.label, locale)}</span>
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/insights">
            <LineChart className="size-4" /> {hi ? "सिग्नल देखें" : "See signals"}
          </Link>
        </Button>
      </header>

      <PlanChecklist actions={actions} patientId={ctx.patient.id} />

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
        {hi
          ? "PRAANA मार्गदर्शन व्यवस्थित करती है। नैदानिक निर्णय आपकी केयर टीम करती है।"
          : "PRAANA organises guidance. Your care team makes clinical decisions."}
      </p>
    </div>
  );
}
