import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6" aria-busy="true">
      <div className="grid gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-72" />
      </div>
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}
