import { Stethoscope } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Opening patient record">
      <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3">
        <Stethoscope className="size-5 text-primary" />
        <div>
          <p className="text-sm font-semibold text-navy">Opening patient record…</p>
          <p className="text-xs text-muted-foreground">Observations only. Clinical judgement stays with you.</p>
        </div>
      </div>
      <Skeleton className="h-36 rounded-xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-6">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-10 w-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="grid content-start gap-6">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
