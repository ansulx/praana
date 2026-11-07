import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckinFlow } from "@/components/checkin/checkin-flow";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { aiEnabled, openaiEnabled } from "@/server/env";
import { recentForTriage } from "@/server/services/checkins";
import { getHelpContacts } from "@/server/services/help-contacts";

export const metadata: Metadata = { title: "Check in" };

export default async function CheckinPage() {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) notFound();
  const [previous, contacts] = await Promise.all([recentForTriage(ctx.patient.id), getHelpContacts(ctx.patient.id)]);

  return (
    <CheckinFlow
      storageKey={`praana:draft:${ctx.patient.id}:${user.id}`}
      previous={previous}
      contacts={contacts}
      caregiverFor={ctx.viewerRelation === "caregiver" ? ctx.patientName : null}
      serverVoice={openaiEnabled && ctx.patient.consentAi}
      aiOn={aiEnabled && ctx.patient.consentAi}
    />
  );
}
