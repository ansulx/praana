import "server-only";
import { EventEmitter } from "node:events";
import Redis from "ioredis";
import { env } from "@/server/env";

/**
 * Redis is an accelerator, never a single point of failure.
 * Every helper here checks `redisReady()` and falls back to an in-process store
 * when Redis is not configured or the connection drops. Patients must never see an
 * error page because a cache went away.
 */

type G = {
  __praanaRedis?: Redis | null;
  __praanaRedisSub?: Redis | null;
  __praanaMem?: MemoryStore;
  __praanaBus?: EventEmitter;
};
const g = globalThis as unknown as G;

function connect(name: string): Redis | null {
  if (!env.REDIS_URL) return null;
  const client = new Redis(env.REDIS_URL, {
    connectionName: `praana:${name}`,
    lazyConnect: false,
    enableOfflineQueue: false, // fail fast instead of queueing while disconnected
    maxRetriesPerRequest: 1,
    connectTimeout: 2_000,
    commandTimeout: 1_500,
    retryStrategy: (times) => Math.min(times * 500, 10_000),
  });
  let warned = false;
  client.on("error", (err) => {
    if (!warned) console.warn(`[redis:${name}] unavailable, using in-memory fallback, ${err.message}`);
    warned = true;
  });
  client.on("ready", () => {
    if (warned) console.info(`[redis:${name}] reconnected`);
    warned = false;
  });
  return client;
}

export function redis(): Redis | null {
  if (g.__praanaRedis === undefined) g.__praanaRedis = connect("main");
  return g.__praanaRedis;
}

/** Dedicated connection for SUBSCRIBE (a subscribed client cannot run other commands). */
export function redisSubscriber(): Redis | null {
  if (g.__praanaRedisSub === undefined) g.__praanaRedisSub = connect("sub");
  return g.__praanaRedisSub;
}

export function redisReady(): boolean {
  return redis()?.status === "ready";
}

// ─── In-memory fallback ─────────────────────────────────────────────────────

class MemoryStore {
  private data = new Map<string, { value: string; expiresAt: number | null }>();

  private live(key: string) {
    const hit = this.data.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt !== null && hit.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return hit;
  }

  get(key: string): string | null {
    return this.live(key)?.value ?? null;
  }

  set(key: string, value: string, ttlSec?: number, onlyIfAbsent = false): boolean {
    if (onlyIfAbsent && this.live(key)) return false;
    this.data.set(key, { value, expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : null });
    if (this.data.size > 20_000) this.sweep();
    return true;
  }

  incr(key: string, ttlSec: number): number {
    const hit = this.live(key);
    const next = (hit ? Number(hit.value) : 0) + 1;
    this.data.set(key, { value: String(next), expiresAt: hit?.expiresAt ?? Date.now() + ttlSec * 1000 });
    return next;
  }

  ttl(key: string): number {
    const hit = this.live(key);
    if (!hit) return -2;
    return hit.expiresAt === null ? -1 : Math.ceil((hit.expiresAt - Date.now()) / 1000);
  }

  del(...keys: string[]) {
    keys.forEach((k) => this.data.delete(k));
  }

  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.data) if (v.expiresAt !== null && v.expiresAt <= now) this.data.delete(k);
  }
}

export function memory(): MemoryStore {
  if (!g.__praanaMem) g.__praanaMem = new MemoryStore();
  return g.__praanaMem;
}

/** Local event bus used for pub/sub when Redis is absent (single-instance deployments). */
export function localBus(): EventEmitter {
  if (!g.__praanaBus) {
    g.__praanaBus = new EventEmitter();
    g.__praanaBus.setMaxListeners(500);
  }
  return g.__praanaBus;
}

/** Runs a Redis command, returning `fallback()` if Redis is down or the command fails. */
export async function withRedis<T>(op: (r: Redis) => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  const r = redis();
  if (!r || r.status !== "ready") return fallback();
  try {
    return await op(r);
  } catch (err) {
    console.warn("[redis] command failed, falling back:", (err as Error).message);
    return fallback();
  }
}
