"use client";

import { useState } from "react";
import { CalendarPlus, MapPin, Pill, Plus, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { addAppointment, addMedication, cancelAppointment, stopMedication } from "@/server/actions/clinic";
import { useAction } from "./use-action";

// ─── Medications ───────────────────────────────────────────────────────────

export type MedItem = {
  id: string;
  name: string;
  dose: string | null;
  times: string[];
  instructions: string | null;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  adherence: { taken: number; skipped: number; expected: number };
};

export function MedicationsPanel({ patientId, meds, total }: { patientId: string; meds: MedItem[]; total: { taken: number; skipped: number; expected: number } }) {
  const { pending, run } = useAction();
  const active = meds.filter((m) => m.active);
  const stopped = meds.filter((m) => !m.active);
  const pct = total.expected ? Math.round((total.taken / total.expected) * 100) : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {pct === null ? (
            <span className="text-muted-foreground">No doses due in the last 7 days.</span>
          ) : (
            <span>
              <strong className="tabular-nums">{total.taken}</strong> of {total.expected} doses logged as taken in 7 days ({pct}%)
              {total.skipped > 0 && <span className="text-muted-foreground"> · {total.skipped} skipped</span>}
            </span>
          )}
        </div>
        <AddMedicationDialog patientId={patientId} />
      </div>

      {active.length === 0 && <p className="text-center text-sm text-muted-foreground">No active medicines.</p>}
      <ul className="grid gap-2">
        {active.map((m) => {
          const p = m.adherence.expected ? Math.round((m.adherence.taken / m.adherence.expected) * 100) : null;
          return (
            <li key={m.id} className="grid gap-2 rounded-xl border p-3">
              <div className="flex items-start gap-3">
                <Pill className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {m.name} {m.dose && <span className="font-normal text-muted-foreground">· {m.dose}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.times.join(", ")}
                    {m.endDate && ` · until ${fmtDate(m.endDate)}`}
                  </p>
                  {m.instructions && <p className="mt-1 text-xs">{m.instructions}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => run(() => stopMedication(m.id))}
                  aria-label={`Stop ${m.name}`}
                >
                  <X />
                  Stop
                </Button>
              </div>
              {p !== null && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Progress value={p} className={cn("h-1.5", p < 70 && "[&>div]:bg-coral")} />
                  <span className="w-24 shrink-0 text-right tabular-nums">
                    {m.adherence.taken}/{m.adherence.expected} taken
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {stopped.length > 0 && (
        <p className="text-xs text-muted-foreground">Stopped: {stopped.map((m) => m.name).join(", ")}</p>
      )}
    </div>
  );
}

function AddMedicationDialog({ patientId }: { patientId: string }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [times, setTimes] = useState<string[]>(["08:00"]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus />
          Add medicine
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const ok = await run(() =>
              addMedication(patientId, {
                name: String(f.get("name") ?? ""),
                dose: String(f.get("dose") ?? ""),
                times: times.filter(Boolean),
                instructions: String(f.get("instructions") ?? ""),
                startDate: String(f.get("startDate") ?? ""),
                endDate: String(f.get("endDate") ?? ""),
              }),
            );
            if (ok) {
              setOpen(false);
              setTimes(["08:00"]);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Add medicine</DialogTitle>
            <DialogDescription>The patient sees this on their Medicines screen with reminders at these times.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="med-name">Name</Label>
              <Input id="med-name" name="name" required maxLength={120} placeholder="Paracetamol" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="med-dose">Dose</Label>
              <Input id="med-dose" name="dose" maxLength={60} placeholder="650 mg" />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Times</Label>
            <div className="flex flex-wrap gap-2">
              {times.map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input
                    type="time"
                    value={t}
                    onChange={(e) => setTimes((ts) => ts.map((x, j) => (j === i ? e.target.value : x)))}
                    className="h-10 w-32"
                    aria-label={`Time ${i + 1}`}
                  />
                  {times.length > 1 && (
                    <Button type="button" size="icon-sm" variant="ghost" onClick={() => setTimes((ts) => ts.filter((_, j) => j !== i))} aria-label="Remove time">
                      <X />
                    </Button>
                  )}
                </div>
              ))}
              {times.length < 8 && (
                <Button type="button" size="sm" variant="outline" onClick={() => setTimes((ts) => [...ts, "20:00"])}>
                  <Plus /> Time
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="med-instr">Instructions</Label>
            <Textarea id="med-instr" name="instructions" rows={2} maxLength={500} placeholder="After food" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="med-start">Start</Label>
              <Input id="med-start" name="startDate" type="date" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="med-end">End (optional)</Label>
              <Input id="med-end" name="endDate" type="date" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add medicine"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Appointments ──────────────────────────────────────────────────────────

export type ApptItem = {
  id: string;
  title: string;
  kind: "in_person" | "tele_physio" | "video" | "phone";
  withName: string | null;
  startsAt: Date;
  durationMin: number;
  location: string | null;
  joinUrl: string | null;
  notes: string | null;
};

const KIND_LABEL: Record<ApptItem["kind"], string> = { in_person: "In person", tele_physio: "Live physio", video: "Video call", phone: "Phone call" };

export function AppointmentsPanel({ patientId, appointments }: { patientId: string; appointments: ApptItem[] }) {
  const { pending, run } = useAction();
  return (
    <div className="grid gap-3">
      <div className="flex justify-end">
        <AddAppointmentDialog patientId={patientId} />
      </div>
      {appointments.length === 0 && <p className="text-center text-sm text-muted-foreground">Nothing scheduled.</p>}
      <ul className="grid gap-2">
        {appointments.map((a) => (
          <li key={a.id} className="flex items-start gap-3 rounded-xl border p-3">
            {a.joinUrl ? <Video className="mt-0.5 size-4 text-primary" /> : <MapPin className="mt-0.5 size-4 text-primary" />}
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {fmtDateTime(a.startsAt)} · {a.durationMin} min · {KIND_LABEL[a.kind]}
                {a.withName && ` · ${a.withName}`}
              </p>
              {a.location && <p className="text-xs">{a.location}</p>}
              {a.joinUrl && (
                <a href={a.joinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline-offset-2 hover:underline">
                  {a.joinUrl}
                </a>
              )}
            </div>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelAppointment(a.id))}>
              Cancel
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddAppointmentDialog({ patientId }: { patientId: string }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ApptItem["kind"]>("in_person");
  const online = kind === "tele_physio" || kind === "video";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarPlus />
          Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const local = String(f.get("startsAt") ?? "");
            const startsAt = local ? new Date(local).toISOString() : "";
            const ok = await run(() =>
              addAppointment(patientId, {
                title: String(f.get("title") ?? ""),
                kind,
                withName: String(f.get("withName") ?? ""),
                startsAt,
                durationMin: Number(f.get("durationMin") ?? 30),
                location: String(f.get("location") ?? ""),
                joinUrl: String(f.get("joinUrl") ?? ""),
                notes: String(f.get("notes") ?? ""),
              }),
            );
            if (ok) setOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Schedule appointment</DialogTitle>
            <DialogDescription>Appears on the patient&apos;s Today screen. Online sessions get a Join button 10 minutes before.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="appt-title">Title</Label>
            <Input id="appt-title" name="title" required maxLength={120} placeholder="Drain review" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ApptItem["kind"])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([k, l]) => (
                    <SelectItem key={k} value={k}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="appt-dur">Minutes</Label>
              <Input id="appt-dur" name="durationMin" type="number" min={5} max={240} defaultValue={30} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="appt-at">Date &amp; time</Label>
            <Input id="appt-at" name="startsAt" type="datetime-local" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="appt-with">With</Label>
            <Input id="appt-with" name="withName" maxLength={100} placeholder="Leave empty for yourself" />
          </div>
          {online ? (
            <div className="grid gap-1.5">
              <Label htmlFor="appt-url">Video link</Label>
              <Input id="appt-url" name="joinUrl" type="url" required placeholder="https://meet.example.com/…" />
            </div>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="appt-loc">Location</Label>
              <Input id="appt-loc" name="location" maxLength={200} placeholder="Dressing room, 2nd floor" />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="appt-notes">Notes for the patient</Label>
            <Textarea id="appt-notes" name="notes" rows={2} maxLength={500} placeholder="Bring your drain chart." />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
