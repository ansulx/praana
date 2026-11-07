import { getSessionUser } from "@/server/auth/session";
import { subscribe, type LiveEvent } from "@/server/redis/pubsub";
import { clinicianPatientIds } from "@/server/services/clinic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;
const REFRESH_LINKS_MS = 5 * 60_000;

/** Server-sent events: live alerts / check-ins for the signed-in clinician's patients only. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "clinician") return new Response("Unauthorized", { status: 401 });

  let allowed = new Set(await clinicianPatientIds(user.id));
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      send(`retry: 5000\n: connected\n\n`);

      const unsubscribe = subscribe((event: LiveEvent) => {
        if (!allowed.has(event.patientId)) return;
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => send(`: ping ${Date.now()}\n\n`), HEARTBEAT_MS);
      // Pick up patients linked after the stream opened.
      const relink = setInterval(() => {
        clinicianPatientIds(user.id)
          .then((ids) => (allowed = new Set(ids)))
          .catch(() => undefined);
      }, REFRESH_LINKS_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(relink);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
