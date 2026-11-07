import "server-only";
import { memory, withRedis } from "./client";

/**
 * Read-through cache with namespace versioning.
 *
 * Keys embed a version number per namespace (e.g. one per patient). Writing to a patient's
 * record bumps that number, which instantly orphans every cached view of that patient —
 * no key scans, no stale dashboards. Orphans expire on their own TTL.
 */

const PREFIX = "praana:";
const inflight = new Map<string, Promise<unknown>>();

async function version(ns: string): Promise<string> {
  const key = `${PREFIX}v:${ns}`;
  return withRedis(
    async (r) => (await r.get(key)) ?? "0",
    () => memory().get(key) ?? "0",
  );
}

export async function invalidate(...namespaces: string[]): Promise<void> {
  await Promise.all(
    namespaces.map((ns) => {
      const key = `${PREFIX}v:${ns}`;
      // Bump both stores so a Redis blip can't leave memory serving stale data later.
      memory().incr(key, 60 * 60 * 24 * 7);
      return withRedis(
        async (r) => {
          await r.multi().incr(key).expire(key, 60 * 60 * 24 * 30).exec();
        },
        () => undefined,
      );
    }),
  );
}

type CacheOpts = { ttlSec: number; namespaces?: string[] };

export async function cached<T>(key: string, opts: CacheOpts, load: () => Promise<T>): Promise<T> {
  const versions = await Promise.all((opts.namespaces ?? []).map(version));
  const fullKey = `${PREFIX}c:${key}:${versions.join(".")}`;

  const hit = await withRedis(
    (r) => r.get(fullKey),
    () => memory().get(fullKey),
  );
  if (hit !== null) {
    try {
      return reviveDates(JSON.parse(hit)) as T;
    } catch {
      /* corrupt entry — fall through and reload */
    }
  }

  // Collapse concurrent misses for the same key into one load (thundering-herd guard).
  const pending = inflight.get(fullKey) as Promise<T> | undefined;
  if (pending) return pending;

  const task = (async () => {
    const value = await load();
    const payload = JSON.stringify(value);
    await withRedis(
      async (r) => {
        await r.set(fullKey, payload, "EX", opts.ttlSec);
      },
      () => {
        memory().set(fullKey, payload, opts.ttlSec);
      },
    );
    return value;
  })().finally(() => inflight.delete(fullKey));

  inflight.set(fullKey, task);
  return task;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function reviveDates(v: unknown): unknown {
  if (typeof v === "string" && ISO.test(v)) return new Date(v);
  if (Array.isArray(v)) return v.map(reviveDates);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = reviveDates(val);
    return out;
  }
  return v;
}

export const ns = {
  patient: (id: string) => `patient:${id}`,
  clinician: (id: string) => `clinician:${id}`,
  user: (id: string) => `user:${id}`,
};
