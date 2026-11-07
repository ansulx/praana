import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { getAdherence, getTodaySchedule, listMedications } from "@/server/services/medications";
import { MedicinesView } from "./medicines-view";

export const metadata: Metadata = { title: "Medicines" };

export default async function MedicinesPage() {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) notFound();
  const [doses, meds, adherence] = await Promise.all([getTodaySchedule(ctx.patient.id), listMedications(ctx.patient.id), getAdherence(ctx.patient.id, 7)]);
  return (
    <MedicinesView
      doses={doses}
      meds={meds.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name, dose: m.dose, times: m.times, instructions: m.instructions, endDate: m.endDate }))}
      adherence={adherence}
    />
  );
}
