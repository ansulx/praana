import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[2.5rem_1fr] gap-4">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className={i === 1 ? "h-64 rounded-2xl" : "h-28 rounded-2xl"} />
        </div>
      ))}
    </div>
  );
}
