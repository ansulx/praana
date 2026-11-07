"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { switchActivePatient } from "@/server/actions/patient";

export function CaregiverSwitcher({ current, patients }: { current: string; patients: { id: string; name: string; relationship: string | null }[] }) {
  const [pending, start] = useTransition();
  const active = patients.find((p) => p.id === current);
  if (patients.length <= 1) return <span className="truncate font-semibold">{active?.name}</span>;
  return (
    <Select value={current} disabled={pending} onValueChange={(id) => start(() => switchActivePatient(id))}>
      <SelectTrigger size="sm" className="h-9 max-w-48 font-semibold">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {patients.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
            {p.relationship ? ` · ${p.relationship}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
