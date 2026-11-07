import "server-only";
import type { HelpContacts } from "@/components/patient/help-now";
import { env } from "@/server/env";
import { getPrimaryContact } from "./patient";

export async function getHelpContacts(patientId: string): Promise<HelpContacts> {
  const primary = await getPrimaryContact(patientId);
  return {
    emergency: env.EMERGENCY_NUMBER,
    helpline: env.MENTAL_HEALTH_HELPLINE,
    helplineName: env.MENTAL_HEALTH_HELPLINE_NAME,
    primary: primary?.phone ? { name: primary.name, role: primary.role, phone: primary.phone, availability: primary.availability } : null,
  };
}
