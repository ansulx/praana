import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { getActivePatient } from "@/server/auth/access";
import { LinkPatientForm } from "./link-form";

export const metadata: Metadata = { title: "Connect to a patient" };

export default async function LinkPatientPage() {
  const user = await requireUser(["caregiver"]);
  const existing = await getActivePatient(user);
  return (
    <div>
      <h1 className="font-heading text-3xl font-bold text-navy">Connect to the person you support</h1>
      <p className="mt-2 text-muted-foreground">
        Ask them to open PRAANA → Settings → Family and create an invite code. Codes work once and expire after 3 days.
      </p>
      <LinkPatientForm />
      {existing && (
        <p className="mt-6 text-center">
          <Link href="/home" className="text-sm font-semibold text-primary hover:underline">
            Back to {existing.patientName}&apos;s recovery
          </Link>
        </p>
      )}
    </div>
  );
}
