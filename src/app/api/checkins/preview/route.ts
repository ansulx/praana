import { previewSchema } from "@/lib/checkin";
import { limits } from "@/server/redis/rate-limit";
import { previewCheckin } from "@/server/services/checkins";
import { enforceRateLimit, handleError, json, readJson, requirePatientActor } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reads the patient's words back to them before anything is saved. Nothing is persisted here. */
export async function POST(req: Request) {
  try {
    const { user, ctx } = await requirePatientActor();
    await enforceRateLimit(`preview:${user.id}`, limits.preview);
    const input = previewSchema.parse(await readJson(req));
    const result = await previewCheckin(ctx, input.freeText, input.fields);
    return json(result);
  } catch (err) {
    return handleError(err);
  }
}
