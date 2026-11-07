import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { photos } from "@/server/db/schema";
import { limits } from "@/server/redis/rate-limit";
import { audit } from "@/server/audit";
import { enforceRateLimit, handleError, HttpError, json, requirePatientActor } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PENDING = 12;

/** Identify by content, not by the (spoofable) filename or MIME header. */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export async function POST(req: Request) {
  try {
    const { user, ctx, ip } = await requirePatientActor();
    await enforceRateLimit(`upload:${user.id}`, limits.upload);

    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES + 64_000) throw new HttpError(413, "That photo is too large. Please use one under 5 MB.", "too_large");

    const form = await req.formData().catch(() => null);
    const file = form?.get("photo");
    if (!(file instanceof File)) throw new HttpError(400, "No photo was received. Please try again.", "no_file");
    if (file.size > MAX_BYTES) throw new HttpError(413, "That photo is too large. Please use one under 5 MB.", "too_large");
    if (file.size === 0) throw new HttpError(400, "That photo looks empty. Please take it again.", "empty");

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = sniff(buf);
    if (!mime) throw new HttpError(415, "Please upload a JPG, PNG or WebP photo.", "bad_type");

    // Tidy photos that were uploaded but never attached to a check-in.
    await db.delete(photos).where(and(eq(photos.patientId, ctx.patient.id), isNull(photos.checkinId), lt(photos.createdAt, new Date(Date.now() - 86_400_000))));
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(photos)
      .where(and(eq(photos.patientId, ctx.patient.id), isNull(photos.checkinId)));
    if (n >= MAX_PENDING) throw new HttpError(429, "Too many unsent photos. Please send your check-in first.", "too_many");

    const [row] = await db
      .insert(photos)
      .values({ patientId: ctx.patient.id, uploadedBy: user.id, mime, bytes: buf.length, data: buf })
      .returning({ id: photos.id });
    await audit({ actorId: user.id, patientId: ctx.patient.id, action: "photo.upload", ip, meta: { photoId: row.id, bytes: buf.length } });
    return json({ id: row.id }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
