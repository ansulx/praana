import "server-only";
import { and, asc, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { alerts, appointments, careTeamMembers, checkins, notes, teamQuestions, users } from "@/server/db/schema";
import { cached, ns } from "@/server/redis/cache";

export async function getCareTeam(patientId: string) {
  return cached(`careteam:${patientId}`, { ttlSec: 600, namespaces: [ns.patient(patientId)] }, () =>
    db
      .select()
      .from(careTeamMembers)
      .where(eq(careTeamMembers.patientId, patientId))
      .orderBy(desc(careTeamMembers.isPrimaryContact), asc(careTeamMembers.createdAt)),
  );
}

export async function getPrimaryContact(patientId: string) {
  const team = await getCareTeam(patientId);
  return team.find((m) => m.isPrimaryContact && m.phone) ?? team.find((m) => m.phone) ?? null;
}

export async function getUpcomingAppointments(patientId: string, limit = 5) {
  return cached(`appts:${patientId}:${limit}`, { ttlSec: 300, namespaces: [ns.patient(patientId)] }, () =>
    db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.patientId, patientId),
          isNull(appointments.cancelledAt),
          // include sessions that started up to an hour ago (still joinable / just happened)
          gte(appointments.startsAt, new Date(Date.now() - 3600_000)),
        ),
      )
      .orderBy(asc(appointments.startsAt))
      .limit(limit),
  );
}

export async function getOpenAlertLevel(patientId: string): Promise<"review" | "urgent" | null> {
  const rows = await db
    .select({ level: alerts.level })
    .from(alerts)
    .where(and(eq(alerts.patientId, patientId), eq(alerts.status, "open")));
  if (rows.some((r) => r.level === "urgent")) return "urgent";
  if (rows.some((r) => r.level === "review")) return "review";
  return null;
}

export async function getLatestCheckin(patientId: string) {
  const [row] = await db.select().from(checkins).where(eq(checkins.patientId, patientId)).orderBy(desc(checkins.createdAt)).limit(1);
  return row ?? null;
}

/** Notes the team chose to share with the patient, newest first. */
export async function getSharedNotes(patientId: string, limit = 3) {
  return db
    .select({ id: notes.id, body: notes.body, createdAt: notes.createdAt, author: users.name, careRole: users.careRole })
    .from(notes)
    .leftJoin(users, eq(users.id, notes.authorId))
    .where(and(eq(notes.patientId, patientId), eq(notes.visibility, "shared")))
    .orderBy(desc(notes.createdAt))
    .limit(limit);
}

export async function getTeamQuestions(patientId: string, limit = 20) {
  return db
    .select({
      id: teamQuestions.id,
      question: teamQuestions.question,
      answer: teamQuestions.answer,
      answeredAt: teamQuestions.answeredAt,
      createdAt: teamQuestions.createdAt,
      askedBy: teamQuestions.askedBy,
    })
    .from(teamQuestions)
    .where(eq(teamQuestions.patientId, patientId))
    .orderBy(desc(teamQuestions.createdAt))
    .limit(limit);
}
