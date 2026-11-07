import "server-only";
import { cookies } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { careLinks, patients, users, type Patient } from "@/server/db/schema";
import type { SessionUser } from "./session";

export const ACTIVE_PATIENT_COOKIE = "praana_patient";

export type PatientContext = {
  patient: Patient;
  patientName: string;
  patientUserId: string;
  /** How the viewer relates to this record. */
  viewerRelation: "self" | "caregiver" | "clinician";
};

export class AccessError extends Error {
  constructor(message = "You don't have access to this record.") {
    super(message);
    this.name = "AccessError";
  }
}

/**
 * The record a patient-facing screen should show:
 *  - patient   → their own record
 *  - caregiver → the linked patient (a caregiver may support more than one person; the
 *                selection is remembered in a cookie and re-validated on every request)
 */
export async function getActivePatient(user: SessionUser): Promise<PatientContext | null> {
  if (user.role === "patient") {
    const [row] = await db.select().from(patients).where(eq(patients.userId, user.id)).limit(1);
    if (!row) return null;
    return { patient: row, patientName: user.name, patientUserId: user.id, viewerRelation: "self" };
  }

  if (user.role === "caregiver") {
    const linked = await db
      .select({ patient: patients, name: users.name })
      .from(careLinks)
      .innerJoin(patients, eq(patients.id, careLinks.patientId))
      .innerJoin(users, eq(users.id, patients.userId))
      .where(and(eq(careLinks.userId, user.id), eq(careLinks.kind, "caregiver")))
      .orderBy(asc(careLinks.createdAt));
    if (!linked.length) return null;
    const wanted = (await cookies()).get(ACTIVE_PATIENT_COOKIE)?.value;
    const pick = linked.find((l) => l.patient.id === wanted) ?? linked[0];
    return { patient: pick.patient, patientName: pick.name, patientUserId: pick.patient.userId, viewerRelation: "caregiver" };
  }

  return null;
}

export async function listCaregiverPatients(userId: string) {
  return db
    .select({ id: patients.id, name: users.name, relationship: careLinks.relationship })
    .from(careLinks)
    .innerJoin(patients, eq(patients.id, careLinks.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(eq(careLinks.userId, userId), eq(careLinks.kind, "caregiver")))
    .orderBy(asc(careLinks.createdAt));
}

/** Throws unless `user` may read (and write, for patient/caregiver) this patient's record. */
export async function assertPatientAccess(user: SessionUser, patientId: string): Promise<PatientContext> {
  if (user.role === "patient") {
    const ctx = await getActivePatient(user);
    if (!ctx || ctx.patient.id !== patientId) throw new AccessError();
    return ctx;
  }

  const kind = user.role === "clinician" ? "clinician" : "caregiver";
  const [row] = await db
    .select({ patient: patients, name: users.name })
    .from(careLinks)
    .innerJoin(patients, eq(patients.id, careLinks.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(eq(careLinks.userId, user.id), eq(careLinks.patientId, patientId), eq(careLinks.kind, kind)))
    .limit(1);
  if (!row) throw new AccessError();
  return { patient: row.patient, patientName: row.name, patientUserId: row.patient.userId, viewerRelation: kind };
}
