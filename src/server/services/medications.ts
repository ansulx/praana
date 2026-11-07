import "server-only";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/server/db";
import { medicationLogs, medications, type Medication } from "@/server/db/schema";
import { addDaysYmd, localMinutesNow, localYmd, slotToMinutes } from "@/lib/dates";

export type DoseStatus = "taken" | "skipped" | "due" | "overdue" | "upcoming";
export type Dose = { medicationId: string; name: string; dose: string | null; instructions: string | null; slot: string; status: DoseStatus };

const DUE_WINDOW_MIN = 60;

function activeOn(m: Medication, ymd: string) {
  return m.active && (!m.startDate || m.startDate <= ymd) && (!m.endDate || m.endDate >= ymd);
}

export async function listMedications(patientId: string) {
  return db.select().from(medications).where(eq(medications.patientId, patientId)).orderBy(asc(medications.createdAt));
}

/** Today's doses with their status, in time order. */
export async function getTodaySchedule(patientId: string, now = new Date()): Promise<Dose[]> {
  const today = localYmd(now);
  const nowMin = localMinutesNow(now);
  const [meds, logs] = await Promise.all([
    listMedications(patientId),
    db.select().from(medicationLogs).where(and(eq(medicationLogs.patientId, patientId), eq(medicationLogs.forDate, today))),
  ]);
  const logged = new Map(logs.map((l) => [`${l.medicationId}|${l.slot}`, l.status]));
  const doses: Dose[] = [];
  for (const m of meds) {
    if (!activeOn(m, today)) continue;
    for (const slot of m.times) {
      const log = logged.get(`${m.id}|${slot}`);
      const diff = nowMin - slotToMinutes(slot);
      const status: DoseStatus = log ?? (diff > DUE_WINDOW_MIN ? "overdue" : diff >= -DUE_WINDOW_MIN ? "due" : "upcoming");
      doses.push({ medicationId: m.id, name: m.name, dose: m.dose, instructions: m.instructions, slot, status });
    }
  }
  return doses.sort((a, b) => a.slot.localeCompare(b.slot) || a.name.localeCompare(b.name));
}

/** Per-day adherence for the last `days` days (excluding today). */
export async function getAdherence(patientId: string, days = 7) {
  const today = localYmd();
  const from = addDaysYmd(today, -days);
  const [meds, logs] = await Promise.all([
    listMedications(patientId),
    db.select().from(medicationLogs).where(and(eq(medicationLogs.patientId, patientId), gte(medicationLogs.forDate, from))),
  ]);
  const out: { date: string; expected: number; taken: number; skipped: number }[] = [];
  for (let i = days; i >= 1; i--) {
    const d = addDaysYmd(today, -i);
    const expected = meds.filter((m) => activeOn(m, d) && m.createdAt.toISOString().slice(0, 10) <= d).reduce((n, m) => n + m.times.length, 0);
    const dayLogs = logs.filter((l) => l.forDate === d);
    out.push({ date: d, expected, taken: dayLogs.filter((l) => l.status === "taken").length, skipped: dayLogs.filter((l) => l.status === "skipped").length });
  }
  return out;
}
