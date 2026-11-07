import "server-only";
import { memory, withRedis } from "./client";

/**
 * Claims an idempotency key so a double-tap, a flaky network retry, or a refresh
 * cannot file the same check-in twice. The database's unique index is the final guard;
 * this lock just stops concurrent duplicates before they reach it.
 */
export async function claim(key: string, ttlSec = 60): Promise<boolean> {
  const k = `praana:idem:${key}`;
  return withRedis(
    async (r) => (await r.set(k, "1", "EX", ttlSec, "NX")) === "OK",
    () => memory().set(k, "1", ttlSec, true),
  );
}

export async function release(key: string): Promise<void> {
  const k = `praana:idem:${key}`;
  memory().del(k);
  await withRedis(
    async (r) => {
      await r.del(k);
    },
    () => undefined,
  );
}
