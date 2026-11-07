import "server-only";
import { localBus, redis, redisSubscriber } from "./client";

/**
 * Live events for the care team (new alerts, new check-ins, questions).
 * Uses Redis pub/sub so every server instance hears every event; falls back to an
 * in-process bus. Delivery is best-effort — the database stays the source of truth,
 * and dashboards re-fetch from it when an event arrives.
 */

export type LiveEvent =
  | { type: "alert"; patientId: string; level: "review" | "urgent"; alertId: string; at: string }
  | { type: "checkin"; patientId: string; checkinId: string; at: string }
  | { type: "question"; patientId: string; at: string }
  | { type: "alert-updated"; patientId: string; alertId: string; at: string };

const CHANNEL = "praana:events";

export async function publish(event: LiveEvent): Promise<void> {
  const payload = JSON.stringify(event);
  const r = redis();
  if (r && r.status === "ready") {
    try {
      await r.publish(CHANNEL, payload);
      return;
    } catch {
      /* fall through to local bus */
    }
  }
  localBus().emit(CHANNEL, payload);
}

type Listener = (event: LiveEvent) => void;
const listeners = new Set<Listener>();
let wired = false;

function dispatch(raw: string) {
  let event: LiveEvent;
  try {
    event = JSON.parse(raw) as LiveEvent;
  } catch {
    return;
  }
  for (const l of listeners) {
    try {
      l(event);
    } catch (err) {
      console.error("[pubsub] listener failed", err);
    }
  }
}

function wire() {
  if (wired) return;
  wired = true;
  localBus().on(CHANNEL, dispatch);
  const sub = redisSubscriber();
  if (sub) {
    sub.subscribe(CHANNEL).catch(() => undefined);
    sub.on("ready", () => sub.subscribe(CHANNEL).catch(() => undefined));
    sub.on("message", (_ch: string, msg: string) => dispatch(msg));
  }
}

export function subscribe(listener: Listener): () => void {
  wire();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
