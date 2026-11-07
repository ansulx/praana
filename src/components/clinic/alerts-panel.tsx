"use client";

import { useState } from "react";
import { BellRing, Check, CheckCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { acknowledgeAlert, resolveAlert } from "@/server/actions/clinic";
import { useAction } from "./use-action";

export type AlertItem = {
  id: string;
  level: "none" | "watch" | "review" | "urgent";
  reasons: string[];
  status: "open" | "acknowledged" | "resolved";
  createdAt: Date;
  acknowledgedAt: Date | null;
};

export function AlertsPanel({ alerts, patientName }: { alerts: AlertItem[]; patientName: string }) {
  if (!alerts.length) {
    return (
      <Card className="border-primary/20 bg-mint/60">
        <CardContent className="flex items-center gap-3 text-sm">
          <CheckCheck className="size-5 text-primary" />
          No open alerts for {patientName}.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className={cn(alerts.some((a) => a.level === "urgent" && a.status === "open") ? "border-coral/50" : "border-amber/50")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-coral" />
          Open alerts
        </CardTitle>
        <CardDescription>Raised by the safety rules from what was reported. A person decides what happens next.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {alerts.map((a) => (
          <AlertRow key={a.id} alert={a} />
        ))}
      </CardContent>
    </Card>
  );
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const urgent = alert.level === "urgent";

  return (
    <div className={cn("rounded-xl border p-3.5", urgent ? "border-coral/40 bg-coral-soft/60" : "border-amber/40 bg-amber-soft/60")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", urgent ? "bg-coral text-white" : "bg-amber text-[oklch(0.3_0.08_70)]")}>
              <BellRing className="size-3" />
              {urgent ? "Urgent" : "Review"}
            </span>
            <span className="text-xs text-muted-foreground">{fmtDateTime(alert.createdAt)}</span>
            {alert.status === "acknowledged" && (
              <span className="text-xs font-medium text-muted-foreground">· Acknowledged {alert.acknowledgedAt ? fmtDateTime(alert.acknowledgedAt) : ""}</span>
            )}
          </div>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
            {alert.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div className="flex gap-2">
          {alert.status === "open" && (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => acknowledgeAlert(alert.id))}>
              <Check />
              Acknowledge
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={pending}>
                <CheckCheck />
                Resolve
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form
                className="grid gap-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await run(() => resolveAlert(alert.id, note));
                  if (ok) {
                    setOpen(false);
                    setNote("");
                  }
                }}
              >
                <DialogHeader>
                  <DialogTitle>Resolve alert</DialogTitle>
                  <DialogDescription>Record what was done, e.g. who was contacted and the outcome. This stays in the team record.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                  <Label htmlFor={`resolve-${alert.id}`}>Resolution note</Label>
                  <Textarea
                    id={`resolve-${alert.id}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Called patient and caregiver at 11:20. Advised review at dressing clinic today."
                    maxLength={2000}
                    rows={4}
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending || note.trim().length < 3}>
                    {pending ? "Saving…" : "Mark resolved"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
