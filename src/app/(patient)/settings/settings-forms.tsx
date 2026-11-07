"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { localYmd, fmtDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/components/providers/locale-provider";
import { createInvite, removeCaregiver, updateSettings } from "@/server/actions/patient";

export function PreferencesForm({
  isPatient,
  aiAvailable,
  initial,
}: {
  isPatient: boolean;
  aiAvailable: boolean;
  initial: { locale: "en" | "hi"; consentAi: boolean; hasDrain: boolean; dischargeDate: string };
}) {
  const hi = useLocale() === "hi";
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label>{hi ? "भाषा" : "Language"}</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["en", "hi"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={v.locale === l} onClick={() => setV({ ...v, locale: l })} className={cn("h-12 rounded-xl border font-medium", v.locale === l ? "border-primary bg-mint text-primary" : "bg-card")}>
              {l === "en" ? "English" : "हिन्दी"}
            </button>
          ))}
        </div>
      </div>
      {isPatient && (
        <>
          <label className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <span>
              <span className="block font-medium">{hi ? "AI से मेरे शब्द व्यवस्थित करें" : "Let AI organise my words"}</span>
              <span className="block text-sm text-muted-foreground">
                {aiAvailable
                  ? hi
                    ? "बंद करने पर PRAANA नियम-आधारित तरीके से काम करेगा। सुरक्षा जांच हमेशा चालू रहती है।"
                    : "When off, PRAANA uses its built-in rules instead. Safety checks are always on."
                  : hi
                    ? "AI अभी इस सर्वर पर सेट नहीं है; PRAANA नियम-आधारित तरीके से काम कर रहा है।"
                    : "AI isn't configured on this server yet; PRAANA is using its built-in rules."}
              </span>
            </span>
            <Switch checked={v.consentAi} onCheckedChange={(c) => setV({ ...v, consentAi: c })} />
          </label>
          <label className="flex items-start justify-between gap-4 rounded-xl border p-4">
            <span>
              <span className="block font-medium">{hi ? "घर पर ड्रेन लगी है" : "I have a surgical drain"}</span>
              <span className="block text-sm text-muted-foreground">{hi ? "ड्रेन निकलने पर बंद करें, कुछ व्यायाम तभी खुलेंगे।" : "Turn off once it's removed, some exercises unlock then."}</span>
            </span>
            <Switch checked={v.hasDrain} onCheckedChange={(c) => setV({ ...v, hasDrain: c })} />
          </label>
          <div className="grid gap-2">
            <Label htmlFor="discharge">{hi ? "डिस्चार्ज की तारीख़" : "Discharge date"}</Label>
            <Input id="discharge" type="date" max={localYmd()} value={v.dischargeDate} onChange={(e) => setV({ ...v, dischargeDate: e.target.value })} className="max-w-56" />
          </div>
        </>
      )}
      <Button
        disabled={!dirty || pending}
        className="justify-self-start"
        onClick={() =>
          start(async () => {
            const r = await updateSettings(isPatient ? v : { locale: v.locale, consentAi: initial.consentAi });
            if (r.ok) toast.success(hi ? "सेव हो गया" : "Saved");
            else toast.error(r.error);
          })
        }
      >
        {pending && <Loader2 className="animate-spin" />} {hi ? "सेव करें" : "Save changes"}
      </Button>
    </div>
  );
}

export function InviteCard({ kind }: { kind: "caregiver" | "clinician" }) {
  const hi = useLocale() === "hi";
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const copy = async () => {
    if (!invite) return;
    const text =
      kind === "caregiver"
        ? `Join me on PRAANA to support my recovery. Sign up as family at ${window.location.origin}/register?role=caregiver&code=${invite.code}, code ${invite.code}`
        : invite.code;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.message(hi ? "कोड चुनकर कॉपी करें" : "Select the code to copy it");
    }
  };

  return invite ? (
    <div className="rounded-2xl border border-primary/30 bg-mint p-4">
      <p className="text-sm text-muted-foreground">{kind === "caregiver" ? (hi ? "यह कोड परिवारजन को भेजें" : "Send this code to your family member") : hi ? "यह कोड अपनी टीम को दें" : "Give this code to your clinician"}</p>
      <div className="mt-2 flex items-center gap-3">
        <code className="font-mono text-2xl font-bold tracking-[0.2em] text-navy select-all">{invite.code}</code>
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check /> : <Copy />} {copied ? (hi ? "कॉपी हुआ" : "Copied") : hi ? "कॉपी" : "Copy"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {hi ? "एक बार इस्तेमाल होगा · समाप्ति" : "Works once · expires"} {fmtDateTime(invite.expiresAt)}
      </p>
    </div>
  ) : (
    <Button
      variant="outline"
      disabled={pending}
      className="justify-self-start"
      onClick={() =>
        start(async () => {
          const r = await createInvite(kind);
          if (r.ok && r.data) setInvite(r.data);
          else if (!r.ok) toast.error(r.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <KeyRound />}
      {kind === "caregiver" ? (hi ? "परिवार के लिए कोड बनाएं" : "Create family invite code") : hi ? "टीम के लिए कोड बनाएं" : "Create care team code"}
    </Button>
  );
}

export function CaregiverList({ caregivers }: { caregivers: { id: string; name: string; relationship: string | null; email: string }[] }) {
  const hi = useLocale() === "hi";
  const [pending, start] = useTransition();
  if (!caregivers.length) return <p className="text-sm text-muted-foreground">{hi ? "अभी कोई परिवारजन नहीं जुड़ा।" : "No family members connected yet."}</p>;
  return (
    <ul className="grid gap-2">
      {caregivers.map((c) => (
        <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
          <span>
            <span className="block font-medium">
              {c.name}
              {c.relationship ? <span className="font-normal text-muted-foreground"> · {c.relationship}</span> : null}
            </span>
            <span className="text-xs text-muted-foreground">{c.email}</span>
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={`Remove ${c.name}`}
            onClick={() =>
              start(async () => {
                const r = await removeCaregiver(c.id);
                if (r.ok) toast.success(hi ? "हटा दिया गया" : "Removed");
                else toast.error(r.error);
              })
            }
          >
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
