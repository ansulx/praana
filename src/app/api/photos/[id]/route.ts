import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { photos } from "@/server/db/schema";
import { assertPatientAccess } from "@/server/auth/access";
import { audit } from "@/server/audit";
import { handleError, HttpError, json, requireApiUser, requirePatientActor } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

/** Serves a wound photo only to people on that patient's record. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const id = idSchema.safeParse((await params).id);
    if (!id.success) throw new HttpError(404, "Not found");
    const [meta] = await db.select({ patientId: photos.patientId }).from(photos).where(eq(photos.id, id.data)).limit(1);
    if (!meta) throw new HttpError(404, "Not found");
    await assertPatientAccess(user, meta.patientId);
    const [row] = await db.select({ data: photos.data, mime: photos.mime }).from(photos).where(eq(photos.id, id.data)).limit(1);
    if (user.role === "clinician") void audit({ actorId: user.id, patientId: meta.patientId, action: "photo.view", meta: { photoId: id.data } });
    return new Response(new Uint8Array(row.data), {
      headers: {
        "Content-Type": row.mime,
        "Cache-Control": "private, max-age=3600, immutable",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Remove a photo that hasn't been sent yet. Sent photos are part of the record. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx } = await requirePatientActor();
    const id = idSchema.safeParse((await params).id);
    if (!id.success) throw new HttpError(404, "Not found");
    const res = await db
      .delete(photos)
      .where(and(eq(photos.id, id.data), eq(photos.patientId, ctx.patient.id), isNull(photos.checkinId)))
      .returning({ id: photos.id });
    if (!res.length) throw new HttpError(404, "That photo was already sent or removed.");
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
