import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { patients } from "@/server/db/schema";
import { requireUser } from "@/server/auth/session";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your recovery profile" };

export default async function OnboardingPage() {
  const user = await requireUser(["patient"]);
  const [p] = await db.select().from(patients).where(eq(patients.userId, user.id)).limit(1);
  if (p?.onboardedAt) redirect("/home");
  const hi = user.locale === "hi";
  return (
    <div className="py-4">
      <p className="text-sm font-semibold tracking-[0.14em] text-primary uppercase">{hi ? "नमस्ते" : "Namaste"}, {user.name.split(" ")[0]}</p>
      <h1 className="mt-2 font-heading text-3xl font-bold text-navy">{hi ? "आपकी रिकवरी प्रोफ़ाइल" : "Your recovery profile"}</h1>
      <p className="mt-2 text-muted-foreground">
        {hi
          ? "इससे PRAANA आपके सफ़र के हिसाब से सही मार्गदर्शन दिखा पाता है। जो पता न हो उसे ख़ाली छोड़ दें, बाद में बदल सकते हैं।"
          : "This helps PRAANA show guidance that fits where you are. Leave anything you don't know blank. You can change it later."}
      </p>
      <OnboardingForm locale={user.locale} />
    </div>
  );
}
