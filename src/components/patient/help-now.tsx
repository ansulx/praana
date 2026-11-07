"use client";

import { LifeBuoy, Phone, PhoneCall, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLocale } from "@/components/providers/locale-provider";

export type HelpContacts = {
  emergency: string;
  helpline: string;
  helplineName: string;
  primary: { name: string; role: string; phone: string; availability: string | null } | null;
};

const copy = {
  en: {
    trigger: "Need help now?",
    title: "Get help now",
    desc: "If something feels wrong, you don't need to wait for a check-in.",
    team: "Call your care team",
    emergency: "Emergency",
    emergencyBody: "Heavy bleeding, trouble breathing, chest pain, fainting, or you feel very unwell.",
    mh: "Talk to someone",
    mhBody: "Free, confidential, 24×7 mental health support.",
    noTeam: "Your care team's number hasn't been added yet. Add it under Care team.",
  },
  hi: {
    trigger: "अभी मदद चाहिए?",
    title: "अभी मदद लें",
    desc: "कुछ ठीक न लगे तो हाल बताने का इंतज़ार न करें।",
    team: "केयर टीम को कॉल करें",
    emergency: "इमरजेंसी",
    emergencyBody: "बहुत ख़ून, सांस में तकलीफ़, सीने में दर्द, बेहोशी या तबीयत बहुत ख़राब हो।",
    mh: "किसी से बात करें",
    mhBody: "मुफ़्त, गोपनीय, 24×7 मानसिक स्वास्थ्य सहायता।",
    noTeam: "केयर टीम का नंबर अभी जोड़ा नहीं गया है। 'केयर टीम' में जोड़ें।",
  },
};

const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;

export function HelpNow({ contacts, variant = "header" }: { contacts: HelpContacts; variant?: "header" | "inline" }) {
  const locale = useLocale();
  const c = copy[locale];
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant={variant === "header" ? "outline" : "destructive"}
          size={variant === "header" ? "sm" : "default"}
          className={variant === "header" ? "border-coral/40 text-coral hover:bg-coral-soft hover:text-coral" : ""}
        >
          <LifeBuoy />
          <span>{c.trigger}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-3xl px-2 pb-8">
        <SheetHeader>
          <SheetTitle className="text-xl">{c.title}</SheetTitle>
          <SheetDescription>{c.desc}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3 px-4">
          {contacts.primary ? (
            <a href={tel(contacts.primary.phone)} className="flex items-center gap-4 rounded-2xl border bg-mint p-4 transition hover:border-primary">
              <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
                <PhoneCall className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{c.team}</span>
                <span className="block text-sm text-muted-foreground">
                  {contacts.primary.name} · {contacts.primary.phone}
                </span>
                {contacts.primary.availability && <span className="block text-xs text-muted-foreground">{contacts.primary.availability}</span>}
              </span>
            </a>
          ) : (
            <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">{c.noTeam}</p>
          )}
          <a href={tel(contacts.emergency)} className="flex items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 transition hover:border-destructive">
            <span className="grid size-12 place-items-center rounded-full bg-destructive text-white">
              <Phone className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold text-destructive">
                {c.emergency} · {contacts.emergency}
              </span>
              <span className="block text-sm text-muted-foreground">{c.emergencyBody}</span>
            </span>
          </a>
          <a href={tel(contacts.helpline)} className="flex items-center gap-4 rounded-2xl border p-4 transition hover:border-primary">
            <span className="grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground">
              <HeartHandshake className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">
                {c.mh} · {contacts.helplineName} {contacts.helpline}
              </span>
              <span className="block text-sm text-muted-foreground">{c.mhBody}</span>
            </span>
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
