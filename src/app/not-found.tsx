import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Logo className="justify-center" />
        <h1 className="mt-8 font-heading text-3xl font-bold text-navy">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted-foreground">It may have moved, or you may not have access to it.</p>
        <Button asChild className="mt-6">
          <Link href="/">Go to PRAANA</Link>
        </Button>
      </div>
    </div>
  );
}
