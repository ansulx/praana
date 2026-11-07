import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, HeartHandshake, Phone, Sparkles, Stethoscope } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LiveUpdates } from "@/components/clinic/live-updates";
import { AlertsPanel } from "@/components/clinic/alerts-panel";
import { TrendCharts, type TrendPoint } from "@/components/clinic/trend-charts";
import { CheckinHistory } from "@/components/clinic/checkin-history";
import { NotesPanel, QuestionsPanel } from "@/components/clinic/notes-questions";
import { AppointmentsPanel, MedicationsPanel } from "@/components/clinic/meds-appointments";
import { getSession } from "@/content/guided";
import { fmtDate, fmtDateTime, formatDayLabel } from "@/lib/dates";
import { AccessError, assertPatientAccess } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { summarizeRules } from "@/lib/clinic/trends";
import { getPatientDetail } from "@/server/services/clinic";

export const metadata: Metadata = { title: "Patient" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE: Record<string, string> = {
  surgeon: "Surgeon",
  oncologist: "Oncologist",
  nurse: "Nurse",
  physiotherapist: "Physiotherapist",
  nutritionist: "Nutritionist",
  psychologist: "Psychologist",
  anaesthesiologist: "Anaesthesiologist",
  coordinator: "Coordinator",
};

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser(["clinician"]);
  try {
    await assertPatientAccess(user, id);
  } catch (err) {
    if (err instanceof AccessError) notFound();
    throw err;
  }

  const d = await getPatientDetail(id);
  if (!d) notFound();
  void audit({ actorId: user.id, patientId: id, action: "clinic.view_patient" });

  // Deterministic summary only — keeps the page instant for demos (no AI wait / skeleton flash).
  const rules = summarizeRules(
    d.checkins.map((c) => ({ ...c, triageReasons: c.triageReasons ?? [] })),
    { adherence: d.adherence, dayOffset: d.dayOffset },
  );
  const summary = { ...rules, source: "rules" as const, generatedAt: new Date().toISOString() };

  const trend: TrendPoint[] = d.checkins
    .filter((c) => c.createdAt.getTime() >= Date.now() - 30 * 86_400_000)
    .slice()
    .reverse()
    .map((c) => ({
      label: c.dayOffset !== null ? `D${c.dayOffset}` : fmtDate(c.createdAt),
      pain: c.pain,
      appetite: c.appetite,
      nausea: c.nausea,
      mobility: c.mobility,
      sleep: c.sleep,
      mood: c.mood,
      anxiety: c.anxiety,
      temperatureC: c.temperatureC,
    }));

  const openQuestions = d.questions.filter((q) => !q.answer).length;
  const p = d.patient;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/clinic" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Worklist
        </Link>
        <LiveUpdates patientNames={{ [id]: d.user.name }} />
      </div>

      {/* Header */}
      <Card>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              {d.user.name}
              {d.age !== null && <span className="ml-2 text-base font-medium text-muted-foreground">{d.age} years</span>}
            </h1>
            <p className="mt-1 text-sm">
              <span className="font-medium">{p.surgeryName ?? p.surgeryType}</span>
              <span className="text-muted-foreground">
                {" "}
                · {formatDayLabel(d.dayOffset)} · {d.stage}
                {p.surgeryDate && ` · surgery ${fmtDate(p.surgeryDate)}`}
                {p.dischargeDate && ` · discharged ${fmtDate(p.dischargeDate)}`}
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {p.hospital && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-4" /> {p.hospital}
                </span>
              )}
              {d.user.phone && (
                <a href={`tel:${d.user.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                  <Phone className="size-4" /> {d.user.phone}
                </a>
              )}
              {p.emergencyContactName && (
                <span className="inline-flex items-center gap-1.5">
                  <HeartHandshake className="size-4" /> Emergency: {p.emergencyContactName}
                  {p.emergencyContactPhone && ` · ${p.emergencyContactPhone}`}
                </span>
              )}
              {p.hasDrain && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">Drain at home</span>}
              {d.user.locale === "hi" && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Prefers Hindi</span>}
              {!p.consentAi && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">AI processing declined</span>}
            </div>
            {d.caregivers.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Caregivers:{" "}
                {d.caregivers.map((c, i) => (
                  <span key={c.linkId}>
                    {i > 0 && ", "}
                    <span className="font-medium text-foreground">{c.name}</span>
                    {c.relationship && ` (${c.relationship})`}
                    {c.phone && ` · ${c.phone}`}
                  </span>
                ))}
              </p>
            )}
          </div>
          <div
            className={
              p.allergies
                ? "flex items-start gap-2 rounded-xl border border-coral/40 bg-coral-soft px-4 py-3 text-sm lg:max-w-xs"
                : "rounded-xl border px-4 py-3 text-sm text-muted-foreground lg:max-w-xs"
            }
          >
            {p.allergies ? (
              <>
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-coral" />
                <span>
                  <span className="block text-xs font-bold tracking-wide text-coral uppercase">Allergies</span>
                  <span className="font-medium">{p.allergies}</span>
                </span>
              </>
            ) : (
              "No allergies recorded"
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 content-start gap-6">
          <AlertsPanel
            patientName={d.user.name}
            alerts={d.openAlerts.map((a) => ({ id: a.id, level: a.level, reasons: a.reasons, status: a.status, createdAt: a.createdAt, acknowledgedAt: a.acknowledgedAt }))}
          />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-5 text-primary" />
                Recovery summary · last 7 days
              </CardTitle>
              <CardDescription>
                Rule-based · generated {fmtDateTime(summary.generatedAt)} · Observations only. Clinical judgement stays with you.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-[15px] leading-relaxed">{summary.text}</p>
              {summary.bullets.length > 0 && (
                <ul className="grid gap-1.5 text-sm">
                  {summary.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="trends" className="gap-4">
            <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="checkins">Check-ins ({d.checkins.length})</TabsTrigger>
              <TabsTrigger value="notes">Notes ({d.notes.length})</TabsTrigger>
              <TabsTrigger value="questions">
                Questions
                {openQuestions > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{openQuestions}</span>}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="trends">
              <Card>
                <CardContent>
                  <TrendCharts data={trend} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="checkins">
              <CheckinHistory
                items={d.checkins.map((c) => ({
                  id: c.id,
                  createdAt: c.createdAt,
                  dayOffset: c.dayOffset,
                  reporterRole: c.reporterRole,
                  inputMode: c.inputMode,
                  freeText: c.freeText,
                  pain: c.pain,
                  appetite: c.appetite,
                  nausea: c.nausea,
                  mobility: c.mobility,
                  sleep: c.sleep,
                  mood: c.mood,
                  anxiety: c.anxiety,
                  wound: c.wound,
                  temperatureC: c.temperatureC,
                  medsTaken: c.medsTaken,
                  triage: c.triage,
                  triageReasons: c.triageReasons ?? [],
                  aiStatus: c.aiStatus,
                  summary: c.structured?.summary || null,
                  photoIds: c.photoIds,
                }))}
              />
            </TabsContent>
            <TabsContent value="notes">
              <Card>
                <CardContent>
                  <NotesPanel patientId={id} notes={d.notes} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="questions">
              <Card>
                <CardContent>
                  <QuestionsPanel questions={d.questions} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Medicines</CardTitle>
            </CardHeader>
            <CardContent>
              <MedicationsPanel patientId={id} meds={d.medications} total={d.adherence} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <AppointmentsPanel patientId={id} appointments={d.appointments} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Guided recovery activity</CardTitle>
              <CardDescription>Last 14 days</CardDescription>
            </CardHeader>
            <CardContent>
              {d.sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No guided sessions logged.</p>
              ) : (
                <ul className="grid gap-2 text-sm">
                  {d.sessions.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{getSession(s.sessionSlug)?.title.en ?? s.sessionSlug}</span>
                        <span className="text-xs text-muted-foreground">
                          {fmtDateTime(s.createdAt)} · {Math.round(s.durationSec / 60)} min{!s.completedFully && " · stopped early"}
                        </span>
                      </span>
                      {s.feltAfter && (
                        <span
                          className={
                            s.feltAfter === "worse"
                              ? "rounded-full bg-coral-soft px-2 py-0.5 text-xs font-medium text-coral"
                              : s.feltAfter === "better"
                                ? "rounded-full bg-mint px-2 py-0.5 text-xs font-medium text-primary"
                                : "rounded-full bg-muted px-2 py-0.5 text-xs"
                          }
                        >
                          felt {s.feltAfter}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Care team</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm">
                {d.careTeam.map((m) => (
                  <li key={m.id} className="flex items-start gap-2">
                    <Stethoscope className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground"> · {ROLE[m.role] ?? m.role}</span>
                      {m.isPrimaryContact && <span className="ml-1 rounded bg-mint px-1.5 text-xs text-primary">primary contact</span>}
                      {m.phone && <span className="block text-xs text-muted-foreground">{m.phone}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
