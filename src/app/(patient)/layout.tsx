import Link from "next/link";
import { redirect } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { HelpNow } from "@/components/patient/help-now";
import { BottomNav, SideNav } from "@/components/patient/patient-nav";
import { CaregiverSwitcher } from "@/components/patient/caregiver-switcher";
import { LocaleSwitch } from "@/components/patient/locale-switch";
import { getActivePatient, listCaregiverPatients } from "@/server/auth/access";
import { requireUser } from "@/server/auth/session";
import { getHelpContacts } from "@/server/services/help-contacts";

export const dynamic = "force-dynamic";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["patient", "caregiver"]);
  const ctx = await getActivePatient(user);

  if (!ctx) {
    if (user.role === "caregiver") redirect("/link-patient");
    redirect("/onboarding");
  }
  if (user.role === "patient" && !ctx.patient.onboardedAt) redirect("/onboarding");

  const [contacts, linked] = await Promise.all([
    getHelpContacts(ctx.patient.id),
    user.role === "caregiver" ? listCaregiverPatients(user.id) : Promise.resolve([]),
  ]);

  return (
    <LocaleProvider locale={user.locale}>
      <div className="flex min-h-dvh" lang={user.locale}>
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
              <Link href="/home" className="lg:hidden">
                <Logo compact />
              </Link>
              {ctx.viewerRelation === "caregiver" ? (
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <HeartHandshake className="size-4 shrink-0 text-primary" />
                  <span className="hidden text-muted-foreground sm:inline">{user.locale === "hi" ? "आप सहयोग कर रहे हैं" : "Supporting"}</span>
                  <CaregiverSwitcher current={ctx.patient.id} patients={linked} />
                </div>
              ) : (
                <span className="hidden text-sm text-muted-foreground lg:block">
                  {user.locale === "hi" ? "रिकवरी विज़िट के बीच होती है।" : "Recovery happens between visits."}
                </span>
              )}
              <div className="flex items-center gap-2">
                <LocaleSwitch locale={user.locale} />
                <HelpNow contacts={contacts} />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-12">{children}</main>
        </div>
        <BottomNav />
      </div>
    </LocaleProvider>
  );
}
