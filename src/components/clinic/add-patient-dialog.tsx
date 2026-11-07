"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { linkPatientByCode } from "@/server/actions/clinic";

export function AddPatientDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await linkPatientByCode(code);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(res.message ?? "Patient added");
      setOpen(false);
      setCode("");
      if (res.data?.patientId) router.push(`/clinic/patients/${res.data.patientId}`);
      else router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (setOpen(o), setError(null))}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus />
          <span className="hidden sm:inline">Add patient</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add a patient</DialogTitle>
            <DialogDescription>
              Ask the patient to open <strong>Settings → Share with care team</strong> in PRAANA and read you the code. Codes work once and expire after 72 hours.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="patient-code">Patient code</Label>
            <Input
              id="patient-code"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="ABCD-EF23"
              value={code}
              maxLength={20}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono text-lg tracking-widest"
              aria-invalid={!!error}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || code.trim().length < 6}>
              {pending ? "Adding…" : "Add patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
