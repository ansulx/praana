"use client";

import { useActionState, useState } from "react";
import { HeartHandshake, Loader2, Stethoscope, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARE_ROLES } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError, FormField } from "@/components/forms/field";
import { registerAction, type FormState } from "@/server/actions/auth";

type Role = "patient" | "caregiver" | "clinician";

const ROLES: { value: Role; title: string; body: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "patient", title: "I'm the patient", body: "Track my recovery and stay connected to my team.", icon: UserRound },
  { value: "caregiver", title: "I'm family", body: "Support someone I care for. You'll need their invite code.", icon: HeartHandshake },
  { value: "clinician", title: "I'm on the care team", body: "Doctor, nurse, physio or other clinician.", icon: Stethoscope },
];

export function RegisterForm({ initialRole, initialCode }: { initialRole: Role; initialCode?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, undefined);
  const [role, setRole] = useState<Role>(initialRole);
  const [careRole, setCareRole] = useState<string>("");
  const [locale, setLocale] = useState<"en" | "hi">("en");
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="mt-8 grid gap-5" noValidate>
      <FormError message={state?.error} />
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[15px] font-medium">Who are you?</legend>
        {ROLES.map((r) => (
          <label
            key={r.value}
            className={cn(
              "flex cursor-pointer items-start gap-4 rounded-2xl border bg-card p-4 transition has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              role === r.value ? "border-primary bg-mint" : "hover:border-primary/40",
            )}
          >
            <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="sr-only" />
            <r.icon className={cn("mt-0.5 size-6 shrink-0", role === r.value ? "text-primary" : "text-muted-foreground")} />
            <span>
              <span className="block font-semibold">{r.title}</span>
              <span className="block text-sm text-muted-foreground">{r.body}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {role === "caregiver" && (
        <div className="grid gap-5 rounded-2xl border border-dashed p-4">
          <FormField id="inviteCode" label="Family invite code" hint="The patient can create one in PRAANA under Settings → Family. It's valid for 3 days." error={fe.inviteCode}>
            <Input id="inviteCode" name="inviteCode" defaultValue={initialCode} placeholder="ABCD-EF23" autoCapitalize="characters" className="font-mono tracking-widest uppercase" />
          </FormField>
          <FormField id="relationship" label="Your relationship" optional error={fe.relationship}>
            <Input id="relationship" name="relationship" placeholder="e.g. Son, Daughter, Husband" />
          </FormField>
        </div>
      )}

      {role === "clinician" && (
        <div className="grid gap-5 rounded-2xl border border-dashed p-4">
          <FormField id="clinicCode" label="Clinic access code" hint="Provided by your hospital's PRAANA administrator." error={fe.clinicCode}>
            <Input id="clinicCode" name="clinicCode" autoComplete="off" />
          </FormField>
          <FormField id="careRole" label="Discipline" error={fe.careRole}>
            <input type="hidden" name="careRole" value={careRole} />
            <Select value={careRole} onValueChange={setCareRole}>
              <SelectTrigger id="careRole" className="w-full">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {CARE_ROLES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      )}

      <FormField id="name" label="Full name" error={fe.name}>
        <Input id="name" name="name" autoComplete="name" required />
      </FormField>
      <FormField id="email" label="Email" error={fe.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </FormField>
      <FormField id="phone" label="Mobile number" optional hint="Used by your care team to reach you." error={fe.phone}>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98xxx xxxxx" />
      </FormField>
      <FormField id="password" label="Password" hint="At least 8 characters, with a number." error={fe.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </FormField>

      {role !== "clinician" && (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[15px] font-medium">Language for the app</legend>
          <input type="hidden" name="locale" value={locale} />
          <div className="grid grid-cols-2 gap-2">
            {(["en", "hi"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                aria-pressed={locale === l}
                className={cn("h-12 rounded-xl border font-medium", locale === l ? "border-primary bg-mint text-primary" : "bg-card")}
              >
                {l === "en" ? "English" : "हिन्दी"}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Create account
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        PRAANA is not an emergency service. In an emergency, call 112.
      </p>
    </form>
  );
}
