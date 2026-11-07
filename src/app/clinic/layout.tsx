import Link from "next/link";
import { LogOut, Stethoscope } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { AddPatientDialog } from "@/components/clinic/add-patient-dialog";
import { logoutAction } from "@/server/actions/auth";
import { requireUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

const DISCIPLINE: Record<string, string> = {
  surgeon: "Surgeon",
  oncologist: "Oncologist",
  nurse: "Nurse",
  physiotherapist: "Physiotherapist",
  nutritionist: "Nutritionist",
  psychologist: "Psychologist",
  anaesthesiologist: "Anaesthesiologist",
  coordinator: "Care coordinator",
};

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["clinician"]);
  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link href="/clinic" className="flex items-center gap-2">
            <Logo compact />
            <span className="hidden rounded-md bg-mint px-2 py-0.5 text-xs font-semibold text-primary sm:inline">Care team</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <AddPatientDialog />
            <div className="hidden items-center gap-2 text-sm md:flex">
              <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
                <Stethoscope className="size-4" />
              </span>
              <span className="leading-tight">
                <span className="block font-semibold">{user.name}</span>
                <span className="block text-xs text-muted-foreground">{user.careRole ? DISCIPLINE[user.careRole] : "Care team"}</span>
              </span>
            </div>
            <form action={logoutAction}>
              <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
                <LogOut />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
