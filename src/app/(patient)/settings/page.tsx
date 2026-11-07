import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { careLinks, users } from "@/server/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { aiEnabled } from "@/server/env";
import { getActivePatient } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { logoutAction } from "@/server/actions/auth";
import { surgeryLabel } from "@/lib/labels";
import { fmtDate } from "@/lib/dates";
import { CaregiverList, InviteCard, PreferencesForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);
  if (!ctx) notFound();
  const p = ctx.patient;
  const hi = user.locale === "hi";
  const isPatient = user.role === "patient";

  const caregivers = isPatient
    ? await db
        .select({ id: careLinks.id, name: users.name, relationship: careLinks.relationship, email: users.email })
        .from(careLinks)
        .innerJoin(users, eq(users.id, careLinks.userId))
        .where(and(eq(careLinks.patientId, p.id), eq(careLinks.kind, "caregiver")))
    : [];

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <h1 className="font-heading text-3xl font-bold text-navy">{hi ? "सेटिंग्स" : "Settings"}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{hi ? "पसंद" : "Preferences"}</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            isPatient={isPatient}
            aiAvailable={aiEnabled}
            initial={{ locale: user.locale, consentAi: p.consentAi, hasDrain: p.hasDrain, dischargeDate: p.dischargeDate ?? "" }}
          />
        </CardContent>
      </Card>

      {isPatient && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{hi ? "परिवार" : "Family"}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {hi
                  ? "परिवार के लोग आपकी ओर से हाल बता सकते हैं और आपकी टाइमलाइन देख सकते हैं।"
                  : "Family members can check in on your behalf and see your recovery timeline."}
              </p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <CaregiverList caregivers={caregivers} />
              <InviteCard kind="caregiver" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{hi ? "केयर टीम से जोड़ें" : "Share with your care team"}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {hi
                  ? "अगर आपके डॉक्टर या नर्स PRAANA इस्तेमाल करते हैं, यह कोड उन्हें दें ताकि वे आपकी रिकवरी देख सकें।"
                  : "If your doctor or nurse uses PRAANA, give them this code so they can follow your recovery."}
              </p>
            </CardHeader>
            <CardContent>
              <InviteCard kind="clinician" />
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{hi ? "प्रोफ़ाइल" : "Profile"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Row k={hi ? "नाम" : "Name"} v={user.name} />
          <Row k="Email" v={user.email} />
          {isPatient ? (
            <>
              <Row k={hi ? "सर्जरी" : "Surgery"} v={p.surgeryName ?? surgeryLabel(p.surgeryType, user.locale)} />
              <Row k={hi ? "सर्जरी की तारीख़" : "Surgery date"} v={p.surgeryDate ? fmtDate(`${p.surgeryDate}T12:00:00+05:30`) : hi ? "जोड़ा नहीं गया" : "Not added"} />
              <Row k={hi ? "अस्पताल" : "Hospital"} v={p.hospital ?? (hi ? "जोड़ा नहीं गया" : "Not added")} />
              <Row k={hi ? "एलर्जी" : "Allergies"} v={p.allergies ?? (hi ? "जोड़ा नहीं गया" : "Not added")} />
            </>
          ) : (
            <Row k={hi ? "आप सहयोग कर रहे हैं" : "Supporting"} v={ctx.patientName} />
          )}
          {!isPatient && (
            <Button asChild variant="outline" className="mt-3 justify-self-start">
              <Link href="/link-patient">{hi ? "किसी और से जुड़ें" : "Connect to another person"}</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <form action={logoutAction}>
        <Button variant="outline" className="w-full">
          {hi ? "साइन आउट" : "Sign out"}
        </Button>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        PRAANA · {hi ? "रिकवरी विज़िट के बीच होती है।" : "Recovery happens between visits."}
      </p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
