import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { companionMessages } from "@/server/db/schema";
import { aiEnabled } from "@/server/env";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { getHelpContacts } from "@/server/services/help-contacts";
import { CompanionChat } from "@/components/companion/companion-chat";

export const metadata: Metadata = { title: "Ask PRAANA" };

export default async function CompanionPage() {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) notFound();
  const [history, contacts] = await Promise.all([
    db
      .select({ id: companionMessages.id, role: companionMessages.role, content: companionMessages.content, flagged: companionMessages.flagged, source: companionMessages.source })
      .from(companionMessages)
      .where(and(eq(companionMessages.patientId, ctx.patient.id), eq(companionMessages.userId, user.id)))
      .orderBy(desc(companionMessages.createdAt))
      .limit(40),
    getHelpContacts(ctx.patient.id),
  ]);

  return <CompanionChat initial={history.reverse()} aiOn={aiEnabled && ctx.patient.consentAi} contacts={contacts} />;
}
