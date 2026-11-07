import type { Metadata } from "next";
import { LearnBrowser } from "@/components/learn/learn-browser";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Learn" };

export default async function LearnPage() {
  const user = await requireUser(["patient", "caregiver"]);
  const hi = user.locale === "hi";
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{hi ? "भरोसेमंद जानकारी" : "Learn from your care team"}</h1>
        <p className="max-w-2xl text-muted-foreground">
          {hi
            ? "नर्सिंग, पोषण, फ़िज़ियोथेरेपी, मनोविज्ञान और अन्य विशेषज्ञों की छोटी, सरल जानकारी। आपकी अपनी टीम के निर्देश सबसे पहले।"
            : "Short, plain-language guidance from nursing, nutrition, physiotherapy, psychology and more. Your own team's instructions always come first."}
        </p>
      </header>
      <LearnBrowser />
    </div>
  );
}
