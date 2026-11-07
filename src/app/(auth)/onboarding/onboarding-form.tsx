"use client";

import { useActionState, useState } from "react";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { SURGERY_TYPES } from "@/lib/labels";
import { localYmd } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError, FormField } from "@/components/forms/field";
import { onboardingAction, type FormState } from "@/server/actions/auth";

export function OnboardingForm({ locale }: { locale: "en" | "hi" }) {
  const [state, action, pending] = useActionState<FormState, FormData>(onboardingAction, undefined);
  const [surgeryType, setSurgeryType] = useState("");
  const [drain, setDrain] = useState<"yes" | "no">("no");
  const [care, setCare] = useState(false);
  const [ai, setAi] = useState(true);
  const fe = state?.fieldErrors ?? {};
  const hi = locale === "hi";
  const today = localYmd();

  return (
    <form action={action} className="mt-8 grid gap-6" noValidate>
      <FormError message={state?.error ?? (Object.keys(fe).length ? (hi ? "कृपया नीचे लाल रंग में दिखी जानकारी ठीक करें।" : "Please fix the highlighted fields below.") : undefined)} />
      <input type="hidden" name="locale" value={locale} />

      <section className="grid gap-5 rounded-2xl border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">{hi ? "आपकी सर्जरी" : "Your surgery"}</h2>
        <FormField id="surgeryType" label={hi ? "सर्जरी का प्रकार" : "Type of surgery"} error={fe.surgeryType}>
          <input type="hidden" name="surgeryType" value={surgeryType} />
          <Select value={surgeryType} onValueChange={setSurgeryType}>
            <SelectTrigger id="surgeryType" className="w-full">
              <SelectValue placeholder={hi ? "चुनें…" : "Choose…"} />
            </SelectTrigger>
            <SelectContent>
              {SURGERY_TYPES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="surgeryName" label={hi ? "ऑपरेशन का नाम" : "Name of the operation"} optional hint={hi ? "जैसा डिस्चार्ज पेपर पर लिखा है" : "As written on your hospital papers"} error={fe.surgeryName}>
          <Input id="surgeryName" name="surgeryName" placeholder={hi ? "जैसे: मास्टेक्टॉमी" : "e.g. Left mastectomy"} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="surgeryDate" label={hi ? "सर्जरी की तारीख़" : "Surgery date"} optional hint={hi ? "अभी तय नहीं तो ख़ाली छोड़ें" : "Leave blank if not scheduled yet"} error={fe.surgeryDate}>
            <Input id="surgeryDate" name="surgeryDate" type="date" />
          </FormField>
          <FormField id="dischargeDate" label={hi ? "डिस्चार्ज की तारीख़" : "Discharge date"} optional hint={hi ? "घर आ गए हों तो" : "If you're already home"} error={fe.dischargeDate}>
            <Input id="dischargeDate" name="dischargeDate" type="date" max={today} />
          </FormField>
        </div>
        <FormField id="hospital" label={hi ? "अस्पताल" : "Hospital"} optional error={fe.hospital}>
          <Input id="hospital" name="hospital" autoComplete="organization" />
        </FormField>
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[15px] font-medium">{hi ? "क्या घर पर ड्रेन (नली) लगी है?" : "Do you have a surgical drain at home?"}</legend>
          <input type="hidden" name="hasDrain" value={drain} />
          <div className="grid grid-cols-2 gap-2">
            {(["no", "yes"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={drain === v} onClick={() => setDrain(v)} className={cn("h-12 rounded-xl border font-medium", drain === v ? "border-primary bg-mint text-primary" : "bg-background")}>
                {v === "yes" ? (hi ? "हाँ" : "Yes") : hi ? "नहीं" : "No"}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="grid gap-5 rounded-2xl border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">{hi ? "आपके बारे में" : "About you"}</h2>
        <FormField id="dateOfBirth" label={hi ? "जन्म तिथि" : "Date of birth"} optional error={fe.dateOfBirth}>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" max={today} autoComplete="bday" />
        </FormField>
        <FormField id="allergies" label={hi ? "एलर्जी" : "Allergies"} optional hint={hi ? "दवा या खाने से" : "To medicines or food"} error={fe.allergies}>
          <Textarea id="allergies" name="allergies" rows={2} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="emergencyContactName" label={hi ? "आपातकालीन संपर्क" : "Emergency contact"} optional error={fe.emergencyContactName}>
            <Input id="emergencyContactName" name="emergencyContactName" placeholder={hi ? "नाम और रिश्ता" : "Name and relationship"} />
          </FormField>
          <FormField id="emergencyContactPhone" label={hi ? "उनका फ़ोन" : "Their phone"} optional error={fe.emergencyContactPhone}>
            <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" inputMode="tel" />
          </FormField>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">{hi ? "आपकी अनुमति" : "Your permission"}</h2>
        <label className={cn("flex gap-3 rounded-xl border p-4", fe.consentCareTeam && "border-destructive")}>
          <Checkbox name="consentCareTeam" checked={care} onCheckedChange={(v) => setCare(v === true)} className="mt-0.5 size-5" aria-describedby="consent-care-desc" />
          <span id="consent-care-desc" className="text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-4 text-primary" />
              {hi ? "मेरी केयर टीम के साथ साझा करें (ज़रूरी)" : "Share my updates with my care team (required)"}
            </span>
            <span className="mt-1 block text-muted-foreground">
              {hi
                ? "आपके हाल, फ़ोटो और सवाल केवल आपकी केयर टीम और आपके चुने परिवारजन देख सकते हैं। हर पहुंच का रिकॉर्ड रखा जाता है।"
                : "Your check-ins, photos and questions are visible only to your care team and family members you invite. Every access is logged."}
            </span>
          </span>
        </label>
        {fe.consentCareTeam && <p className="text-sm text-destructive">{fe.consentCareTeam}</p>}
        <label className="flex gap-3 rounded-xl border p-4">
          <Checkbox name="consentAi" checked={ai} onCheckedChange={(v) => setAi(v === true)} className="mt-0.5 size-5" />
          <span className="text-sm">
            <span className="flex items-center gap-2 font-semibold">
              <Sparkles className="size-4 text-primary" />
              {hi ? "AI से मेरे शब्दों को व्यवस्थित करने दें (वैकल्पिक)" : "Let AI organise my words (optional)"}
            </span>
            <span className="mt-1 block text-muted-foreground">
              {hi
                ? "AI आपके लिखे या बोले हाल को टीम के लिए छोटे सार में बदलता है। यह निदान नहीं करता। बंद रखने पर भी PRAANA पूरी तरह काम करेगा।"
                : "AI turns what you write or say into a short summary for your team. It never diagnoses. PRAANA still works fully if you leave this off."}
            </span>
          </span>
        </label>
      </section>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {hi ? "शुरू करें" : "Start my recovery companion"}
      </Button>
    </form>
  );
}
