"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Clock, Loader2, Plus, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/field";
import { useLocale } from "@/components/providers/locale-provider";
import { addMyMedication, logDose, stopMyMedication } from "@/server/actions/medicines";
import type { Dose, DoseStatus } from "@/server/services/medications";

type Med = { id: string; name: string; dose: string | null; times: string[]; instructions: string | null; endDate: string | null };

const STATUS: Record<DoseStatus, { en: string; hi: string; cls: string }> = {
  taken: { en: "Taken", hi: "ली", cls: "bg-mint text-primary border-primary/30" },
  skipped: { en: "Skipped", hi: "छोड़ी", cls: "bg-muted text-muted-foreground" },
  due: { en: "Due now", hi: "अभी लेनी है", cls: "bg-amber-soft border-amber/50" },
  overdue: { en: "Overdue", hi: "समय निकल गया", cls: "bg-coral-soft text-coral border-coral/40" },
  upcoming: { en: "Later", hi: "बाद में", cls: "bg-card text-muted-foreground" },
};

export function MedicinesView({ doses, meds, adherence }: { doses: Dose[]; meds: Med[]; adherence: { date: string; expected: number; taken: number; skipped: number }[] }) {
  const locale = useLocale();
  const hi = locale === "hi";
  const [, start] = useTransition();
  const [optimistic, apply] = useOptimistic(doses, (state, u: { id: string; slot: string; status: DoseStatus | null }) =>
    state.map((d) => (d.medicationId === u.id && d.slot === u.slot ? { ...d, status: u.status ?? "due" } : d)),
  );

  const mark = (d: Dose, status: "taken" | "skipped" | null) =>
    start(async () => {
      apply({ id: d.medicationId, slot: d.slot, status });
      const res = await logDose({ medicationId: d.medicationId, slot: d.slot, status });
      if (!res.ok) toast.error(res.error);
    });

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold text-navy">{hi ? "दवाइयाँ" : "Medicines"}</h1>
          <p className="mt-1 text-muted-foreground">{hi ? "हर ख़ुराक लेने के बाद टिक करें।" : "Tick each dose when you take it."}</p>
        </div>
        <AddMedicationDialog />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{hi ? "आज" : "Today"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {optimistic.length === 0 && <p className="text-sm text-muted-foreground">{hi ? "आज कोई दवा नहीं।" : "No doses today."}</p>}
          {optimistic.map((d) => {
            const s = STATUS[d.status];
            const done = d.status === "taken" || d.status === "skipped";
            return (
              <div key={`${d.medicationId}-${d.slot}`} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-3", s.cls)}>
                <div className="flex w-16 items-center gap-1.5 font-semibold tabular-nums">
                  <Clock className="size-4 opacity-60" /> {d.slot}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">
                    {d.name} <span className="font-normal text-muted-foreground">{d.dose}</span>
                  </p>
                  {d.instructions && <p className="text-xs text-muted-foreground">{d.instructions}</p>}
                </div>
                {done ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{s[locale]}</span>
                    <Button size="sm" variant="ghost" onClick={() => mark(d, null)} aria-label={hi ? "वापस लें" : "Undo"}>
                      <Undo2 />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="hidden text-xs font-medium sm:inline">{s[locale]}</span>
                    <Button size="sm" variant="outline" onClick={() => mark(d, "skipped")}>
                      <X /> {hi ? "छोड़ी" : "Skip"}
                    </Button>
                    <Button size="sm" onClick={() => mark(d, "taken")}>
                      <Check /> {hi ? "ली" : "Taken"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{hi ? "पिछले 7 दिन" : "Last 7 days"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {adherence.map((a) => {
              const pct = a.expected ? a.taken / a.expected : null;
              return (
                <div key={a.date} className="text-center">
                  <div
                    className={cn(
                      "mx-auto grid aspect-square w-full max-w-14 place-items-center rounded-xl text-xs font-semibold",
                      pct === null ? "bg-muted text-muted-foreground" : pct >= 0.99 ? "bg-primary text-primary-foreground" : pct >= 0.6 ? "bg-amber-soft" : "bg-coral-soft text-coral",
                    )}
                    title={`${a.taken}/${a.expected}`}
                  >
                    {pct === null ? "None yet" : `${a.taken}/${a.expected}`}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{fmtDate(`${a.date}T12:00:00+05:30`)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{hi ? "मेरी दवाइयों की सूची" : "My medicine list"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {meds.length === 0 && <p className="text-sm text-muted-foreground">{hi ? "अभी कोई दवा नहीं जोड़ी गई।" : "No medicines added yet."}</p>}
          {meds.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="font-semibold">
                  {m.name} <span className="font-normal text-muted-foreground">{m.dose}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {m.times.join(" · ")}
                  {m.endDate ? ` · ${hi ? "तक" : "until"} ${fmtDate(`${m.endDate}T12:00:00+05:30`)}` : ""}
                </p>
              </div>
              <StopButton id={m.id} name={m.name} />
            </div>
          ))}
          <p className="mt-2 text-xs text-muted-foreground">
            {hi ? "दवा बदलने या बंद करने से पहले अपनी केयर टीम से पूछें।" : "Always check with your care team before changing or stopping a medicine."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StopButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`}>
          <Trash2 />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {name}?</DialogTitle>
          <DialogDescription>It will no longer appear in your daily list. Your care team will see that you removed it.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await stopMyMedication(id);
                if (r.ok) {
                  toast.success(r.message ?? "Removed");
                  setOpen(false);
                } else toast.error(r.error);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />} Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMedicationDialog() {
  const locale = useLocale();
  const hi = locale === "hi";
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [error, setError] = useState<string | null>(null);

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const r = await addMyMedication({
        name: String(form.get("name") ?? ""),
        dose: String(form.get("dose") ?? ""),
        instructions: String(form.get("instructions") ?? ""),
        endDate: String(form.get("endDate") ?? "") || undefined,
        times: times.filter(Boolean),
      });
      if (r.ok) {
        toast.success(hi ? "दवा जोड़ी गई" : "Medicine added");
        setOpen(false);
        setTimes(["08:00"]);
      } else setError(r.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus /> {hi ? "दवा जोड़ें" : "Add medicine"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hi ? "दवा जोड़ें" : "Add a medicine"}</DialogTitle>
          <DialogDescription>{hi ? "डिस्चार्ज पर्चे के अनुसार।" : "As written on your discharge prescription."}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          {error && <p className="rounded-xl bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
          <FormField id="med-name" label={hi ? "नाम" : "Name"}>
            <Input id="med-name" name="name" required />
          </FormField>
          <FormField id="med-dose" label={hi ? "ख़ुराक" : "Dose"} optional>
            <Input id="med-dose" name="dose" placeholder="e.g. 500 mg" />
          </FormField>
          <div className="grid gap-2">
            <span className="text-[15px] font-medium">{hi ? "समय" : "Times"}</span>
            {times.map((tm, i) => (
              <div key={i} className="flex gap-2">
                <Input type="time" value={tm} onChange={(e) => setTimes((ts) => ts.map((x, j) => (j === i ? e.target.value : x)))} required />
                {times.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => setTimes((ts) => ts.filter((_, j) => j !== i))} aria-label="Remove time">
                    <X />
                  </Button>
                )}
              </div>
            ))}
            {times.length < 8 && (
              <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setTimes((ts) => [...ts, ""])}>
                <Plus /> {hi ? "और समय" : "Another time"}
              </Button>
            )}
          </div>
          <FormField id="med-instr" label={hi ? "निर्देश" : "Instructions"} optional>
            <Input id="med-instr" name="instructions" placeholder={hi ? "जैसे: खाने के बाद" : "e.g. after food"} />
          </FormField>
          <FormField id="med-end" label={hi ? "कब तक" : "Until"} optional>
            <Input id="med-end" name="endDate" type="date" />
          </FormField>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} {hi ? "सेव करें" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
