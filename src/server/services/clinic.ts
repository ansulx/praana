import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, max, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/server/db";
import {
  alerts,
  appointments,
  careLinks,
  checkins,
  medicationLogs,
  medications,
  notes,
  patients,
  sessionCompletions,
  teamQuestions,
  users,
} from "@/server/db/schema";
import { addDaysYmd, daysBetween, dayOffset, localMinutesNow, localYmd, slotToMinutes } from "@/lib/dates";
import { computePriority, PRIORITY_RANK, stageLabel, type Priority } from "@/lib/clinic/trends";
import { cached, ns } from "@/server/redis/cache";
import { listCheckins } from "./checkins";
import { getCareTeam } from "./patient";

const DAY = 86_400_000;

export function ageFrom(dob: string | null, todayYmd = localYmd()): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const [ty, tm, td] = todayYmd.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age--;
  return age >= 0 && age < 130 ? age : null;
}

export type WorklistRow = {
  patientId: string;
  name: string;
  age: number | null;
  surgeryType: string;
  surgeryName: string | null;
  dayOffset: number | null;
  stage: string;
  lastCheckinAt: Date | null;
  lastTriage: "none" | "watch" | "review" | "urgent" | null;
  lastPain: number | null;
  painSeries: { day: string; pain: number }[];
  openAlert: { id: string; level: "review" | "urgent"; reasons: string[]; createdAt: Date; status: "open" | "acknowledged" } | null;
  unanswered: number;
  silentDays: number | null;
  silent: boolean;
  priority: Priority;
  priorityReason: string;
  lastActivityAt: Date | null;
};

export async function getWorklist(clinicianId: string): Promise<WorklistRow[]> {
  return cached(`worklist:${clinicianId}`, { ttlSec: 30, namespaces: [ns.clinician(clinicianId)] }, () => loadWorklist(clinicianId));
}

async function loadWorklist(clinicianId: string): Promise<WorklistRow[]> {
  const linked = await db
    .select({ patient: patients, name: users.name })
    .from(careLinks)
    .innerJoin(patients, eq(patients.id, careLinks.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(eq(careLinks.userId, clinicianId), eq(careLinks.kind, "clinician")));
  if (!linked.length) return [];

  const ids = linked.map((l) => l.patient.id);
  const today = localYmd();
  const since = new Date(Date.now() - 14 * DAY);

  const [recent, lastAt, openAlerts, questions] = await Promise.all([
    db
      .select({
        patientId: checkins.patientId,
        createdAt: checkins.createdAt,
        pain: checkins.pain,
        appetite: checkins.appetite,
        triage: checkins.triage,
      })
      .from(checkins)
      .where(and(inArray(checkins.patientId, ids), gte(checkins.createdAt, since)))
      .orderBy(asc(checkins.createdAt)),
    db
      .select({ patientId: checkins.patientId, last: max(checkins.createdAt) })
      .from(checkins)
      .where(inArray(checkins.patientId, ids))
      .groupBy(checkins.patientId),
    db
      .select()
      .from(alerts)
      .where(and(inArray(alerts.patientId, ids), inArray(alerts.status, ["open", "acknowledged"])))
      .orderBy(desc(alerts.createdAt)),
    db
      .select({ patientId: teamQuestions.patientId, n: sql<number>`count(*)::int` })
      .from(teamQuestions)
      .where(and(inArray(teamQuestions.patientId, ids), isNull(teamQuestions.answer)))
      .groupBy(teamQuestions.patientId),
  ]);

  const byPatient = new Map<string, typeof recent>();
  for (const r of recent) byPatient.set(r.patientId, [...(byPatient.get(r.patientId) ?? []), r]);
  const lastMap = new Map(lastAt.map((r) => [r.patientId, r.last ? new Date(r.last) : null]));
  const qMap = new Map(questions.map((q) => [q.patientId, q.n]));

  const rows: WorklistRow[] = linked.map(({ patient: p, name }) => {
    const list = byPatient.get(p.id) ?? [];
    const last = list[list.length - 1];
    const lastCheckinAt = lastMap.get(p.id) ?? null;
    const silentDays = lastCheckinAt ? daysBetween(localYmd(lastCheckinAt), today) : null;
    const offset = dayOffset(p.surgeryDate);

    // Highest-level live alert: open beats acknowledged, urgent beats review.
    const mine = openAlerts.filter((a) => a.patientId === p.id && (a.level === "review" || a.level === "urgent"));
    const ranked = [...mine].sort(
      (a, b) =>
        (a.status === "open" ? 0 : 1) - (b.status === "open" ? 0 : 1) ||
        (a.level === "urgent" ? 0 : 1) - (b.level === "urgent" ? 0 : 1) ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const top = ranked[0];
    const openAlert = top
      ? { id: top.id, level: top.level as "review" | "urgent", reasons: top.reasons, createdAt: top.createdAt, status: top.status as "open" | "acknowledged" }
      : null;

    // Painseries: last value per local day over 7 days.
    const sevenAgo = addDaysYmd(today, -6);
    const perDay = new Map<string, number>();
    for (const c of list) {
      const d = localYmd(c.createdAt);
      if (d >= sevenAgo && typeof c.pain === "number") perDay.set(d, c.pain);
    }
    const painSeries = [...perDay.entries()].map(([day, pain]) => ({ day, pain }));

    const unanswered = qMap.get(p.id) ?? 0;
    // Acknowledged alerts still matter but rank below fresh, untouched ones.
    const { priority: rawPriority, reason } = computePriority({
      openAlertLevel: openAlert?.status === "open" ? openAlert.level : null,
      openAlertReasons: openAlert?.reasons,
      dayOffset: offset,
      silentDays,
      recent: list.slice(-3),
      unansweredQuestions: unanswered,
    });
    const postOp = offset !== null && offset >= 0;
    // Acknowledged alerts must stay visible — never collapse to Silent/Steady.
    const escalateAck =
      openAlert?.status === "acknowledged" &&
      (rawPriority === "stable" || rawPriority === "silent" || rawPriority === "question");

    return {
      patientId: p.id,
      name,
      age: ageFrom(p.dateOfBirth, today),
      surgeryType: p.surgeryType,
      surgeryName: p.surgeryName,
      dayOffset: offset,
      stage: stageLabel(p.surgeryDate, p.dischargeDate, today),
      lastCheckinAt,
      lastTriage: last?.triage ?? null,
      lastPain: [...list].reverse().find((c) => typeof c.pain === "number")?.pain ?? null,
      painSeries,
      openAlert,
      unanswered,
      silentDays,
      silent: postOp && (silentDays === null || silentDays >= 2),
      priority: escalateAck ? "review" : rawPriority,
      priorityReason: escalateAck
        ? `Acknowledged — still needs follow-up: ${openAlert!.reasons[0] ?? "prior alert"}`
        : reason,
      lastActivityAt: lastCheckinAt,
    };
  });

  rows.sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0),
  );
  return rows;
}

// ─── Patient detail ────────────────────────────────────────────────────────

export type Adherence = { taken: number; skipped: number; expected: number };

export async function getPatientDetail(patientId: string) {
  const author = alias(users, "author");
  const caregiver = alias(users, "caregiver");
  const patientUser = alias(users, "patient_user");
  const answerer = alias(users, "answerer");
  const today = localYmd();
  const weekStart = addDaysYmd(today, -6);

  const [
    [profile],
    careTeam,
    alertRows,
    checkinRows,
    noteRows,
    questionRows,
    medRows,
    logRows,
    sessions,
    upcoming,
    caregivers,
  ] = await Promise.all([
    db
      .select({ patient: patients, user: { name: patientUser.name, email: patientUser.email, phone: patientUser.phone, locale: patientUser.locale } })
      .from(patients)
      .innerJoin(patientUser, eq(patientUser.id, patients.userId))
      .where(eq(patients.id, patientId))
      .limit(1),
    getCareTeam(patientId),
    db.select().from(alerts).where(eq(alerts.patientId, patientId)).orderBy(desc(alerts.createdAt)).limit(30),
    listCheckins(patientId, { sinceDays: 60, limit: 120 }),
    db
      .select({ id: notes.id, body: notes.body, visibility: notes.visibility, createdAt: notes.createdAt, author: author.name, careRole: author.careRole })
      .from(notes)
      .leftJoin(author, eq(author.id, notes.authorId))
      .where(eq(notes.patientId, patientId))
      .orderBy(desc(notes.createdAt))
      .limit(50),
    db
      .select({
        id: teamQuestions.id,
        question: teamQuestions.question,
        answer: teamQuestions.answer,
        answeredAt: teamQuestions.answeredAt,
        createdAt: teamQuestions.createdAt,
        askedBy: author.name,
        askedRole: author.role,
        answeredBy: answerer.name,
      })
      .from(teamQuestions)
      .leftJoin(author, eq(author.id, teamQuestions.askedBy))
      .leftJoin(answerer, eq(answerer.id, teamQuestions.answeredBy))
      .where(eq(teamQuestions.patientId, patientId))
      .orderBy(desc(teamQuestions.createdAt))
      .limit(30),
    db.select().from(medications).where(eq(medications.patientId, patientId)).orderBy(desc(medications.active), asc(medications.name)),
    db
      .select()
      .from(medicationLogs)
      .where(and(eq(medicationLogs.patientId, patientId), gte(medicationLogs.forDate, weekStart))),
    db
      .select()
      .from(sessionCompletions)
      .where(and(eq(sessionCompletions.patientId, patientId), gte(sessionCompletions.createdAt, new Date(Date.now() - 14 * DAY))))
      .orderBy(desc(sessionCompletions.createdAt)),
    db
      .select()
      .from(appointments)
      .where(and(eq(appointments.patientId, patientId), isNull(appointments.cancelledAt), gte(appointments.startsAt, new Date(Date.now() - 3600_000))))
      .orderBy(asc(appointments.startsAt))
      .limit(10),
    db
      .select({ linkId: careLinks.id, name: caregiver.name, phone: caregiver.phone, relationship: careLinks.relationship })
      .from(careLinks)
      .innerJoin(caregiver, eq(caregiver.id, careLinks.userId))
      .where(and(eq(careLinks.patientId, patientId), eq(careLinks.kind, "caregiver"))),
  ]);

  if (!profile) return null;

  // Adherence over the last 7 local days, counting only slots that have already come due.
  const nowMin = localMinutesNow();
  const perMed = new Map<string, Adherence>();
  const total: Adherence = { taken: 0, skipped: 0, expected: 0 };
  for (const m of medRows) {
    const a: Adherence = { taken: 0, skipped: 0, expected: 0 };
    const created = localYmd(m.createdAt);
    for (let i = 6; i >= 0; i--) {
      const day = addDaysYmd(today, -i);
      const from = m.startDate && m.startDate > created ? m.startDate : (m.startDate ?? created);
      if (day < from) continue;
      if (m.endDate && day > m.endDate) continue;
      for (const slot of m.times) {
        if (day === today && slotToMinutes(slot) > nowMin) continue;
        a.expected++;
      }
    }
    for (const log of logRows) {
      if (log.medicationId !== m.id) continue;
      if (log.status === "taken") a.taken++;
      else a.skipped++;
    }
    // A stopped medicine has no recorded stop date, so only count doses that were logged.
    a.expected = m.active ? Math.max(a.expected, a.taken + a.skipped) : a.taken + a.skipped;
    perMed.set(m.id, a);
    total.taken += a.taken;
    total.skipped += a.skipped;
    total.expected += a.expected;
  }

  const p = profile.patient;
  return {
    patient: p,
    user: profile.user,
    age: ageFrom(p.dateOfBirth, today),
    dayOffset: dayOffset(p.surgeryDate),
    stage: stageLabel(p.surgeryDate, p.dischargeDate, today),
    careTeam,
    caregivers,
    alerts: alertRows,
    openAlerts: alertRows.filter((a) => a.status !== "resolved"),
    checkins: checkinRows,
    notes: noteRows,
    questions: questionRows,
    medications: medRows.map((m) => ({ ...m, adherence: perMed.get(m.id) ?? { taken: 0, skipped: 0, expected: 0 } })),
    adherence: total,
    sessions,
    appointments: upcoming,
  };
}

export type PatientDetail = NonNullable<Awaited<ReturnType<typeof getPatientDetail>>>;

/** Ids of every patient this clinician may act on. */
export async function clinicianPatientIds(clinicianId: string): Promise<string[]> {
  const rows = await db
    .select({ id: careLinks.patientId })
    .from(careLinks)
    .where(and(eq(careLinks.userId, clinicianId), eq(careLinks.kind, "clinician")));
  return rows.map((r) => r.id);
}
