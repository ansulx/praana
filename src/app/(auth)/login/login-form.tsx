"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField } from "@/components/forms/field";
import { loginAction, type FormState } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="mt-8 grid gap-5" noValidate>
      <FormError message={state?.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      <FormField id="email" label="Email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus aria-invalid={!!state?.fieldErrors?.email} />
      </FormField>
      <FormField id="password" label="Password" error={state?.fieldErrors?.password}>
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-12" aria-invalid={!!state?.fieldErrors?.password} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </FormField>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}
