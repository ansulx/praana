"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/server/auth/actor";

/** Runs a server action with pending state, toasts the outcome, refreshes server data. */
export function useAction() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (res: ActionResult<T> & { ok: true }) => void) =>
    new Promise<boolean>((resolve) => {
      start(async () => {
        try {
          const res = await fn();
          if (!res.ok) {
            toast.error(res.error);
            resolve(false);
            return;
          }
          if (res.message) toast.success(res.message);
          onOk?.(res);
          router.refresh();
          resolve(true);
        } catch {
          toast.error("Couldn't reach the server. Check your connection and try again.");
          resolve(false);
        }
      });
    });
  return { pending, run };
}
