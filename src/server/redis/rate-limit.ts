import "server-only";
import { memory, withRedis } from "./client";

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

/** Fixed-window limiter. Cheap, atomic in Redis, and good enough for abuse protection. */
export async function rateLimit(bucket: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const key = `praana:rl:${bucket}`;
  const [count, ttl] = await withRedis(
    async (r) => {
      const res = await r.multi().incr(key).expire(key, windowSec, "NX").ttl(key).exec();
      return [Number(res?.[0]?.[1] ?? 0), Number(res?.[2]?.[1] ?? windowSec)] as const;
    },
    () => {
      const c = memory().incr(key, windowSec);
      return [c, memory().ttl(key)] as const;
    },
  );
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSec: ttl > 0 ? ttl : windowSec,
  };
}

export const limits = {
  login: { limit: 8, windowSec: 15 * 60 },
  register: { limit: 5, windowSec: 60 * 60 },
  checkin: { limit: 30, windowSec: 60 * 60 },
  preview: { limit: 40, windowSec: 60 * 60 },
  companion: { limit: 40, windowSec: 10 * 60 },
  upload: { limit: 30, windowSec: 60 * 60 },
  transcribe: { limit: 30, windowSec: 60 * 60 },
  invite: { limit: 10, windowSec: 60 * 60 },
  generic: { limit: 120, windowSec: 60 },
} as const;
