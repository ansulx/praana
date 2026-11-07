"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/field";
import { linkPatientByCode } from "@/server/actions/patient";

type State = Awaited<ReturnType<typeof linkPatientByCode>> | undefined;

export function LinkPatientForm() {
  const [state, action, pending] = useActionState<State, FormData>(linkPatientByCode, undefined);
  return (
    <form action={action} className="mt-8 grid gap-5">
      <FormError message={state && !state.ok ? state.error : undefined} />
      <FormField id="code" label="Invite code">
        <Input id="code" name="code" placeholder="ABCD-EF23" autoCapitalize="characters" className="font-mono text-lg tracking-widest uppercase" required />
      </FormField>
      <FormField id="relationship" label="Your relationship" optional>
        <Input id="relationship" name="relationship" placeholder="e.g. Daughter" />
      </FormField>
      <Button size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Connect
      </Button>
    </form>
  );
}
