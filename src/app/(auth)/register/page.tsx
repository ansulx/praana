import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, homeFor } from "@/server/auth/session";
import { googleAuthEnabled } from "@/server/env";
import { GoogleSignInButton } from "@/components/auth/google-sign-in";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string; code?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect(homeFor(user.role));
  const { role, code } = await searchParams;
  const initialRole = role === "caregiver" || role === "clinician" ? role : "patient";
  return (
    <div className="py-4">
      <h1 className="font-heading text-3xl font-bold text-navy">Create your account</h1>
      <p className="mt-2 text-muted-foreground">It takes about two minutes.</p>
      {initialRole === "patient" && (
        <GoogleSignInButton enabled={googleAuthEnabled} label="Continue with Google" />
      )}
      <RegisterForm initialRole={initialRole} initialCode={code?.slice(0, 20)} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
