import "server-only";
import { db } from "@/server/db";
import { auditLog } from "@/server/db/schema";

/** Append-only access/change trail. Never throws — auditing must not block care. */
export async function audit(entry: {
  actorId?: string | null;
  patientId?: string | null;
  action: string;
  meta?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: entry.actorId ?? null,
      patientId: entry.patientId ?? null,
      action: entry.action,
      meta: entry.meta,
      ip: entry.ip ?? null,
    });
  } catch (err) {
    console.error("[audit] failed to write", entry.action, (err as Error).message);
  }
}
