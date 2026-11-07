import { submitSchema } from "@/lib/checkin";
import { limits } from "@/server/redis/rate-limit";
import { CheckinError, submitCheckin } from "@/server/services/checkins";
import { enforceRateLimit, handleError, HttpError, json, readJson, requirePatientActor } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user, ctx, ip } = await requirePatientActor();
    await enforceRateLimit(`checkin:${user.id}`, limits.checkin, "You've sent many updates in the last hour. If something is urgent, please call your care team.");
    const input = submitSchema.parse(await readJson(req));
    try {
      const result = await submitCheckin(user, ctx, input, ip);
      return json(result, { status: result.duplicate ? 200 : 201 });
    } catch (err) {
      if (err instanceof CheckinError) {
        throw new HttpError(err.code === "duplicate_inflight" ? 409 : 400, err.message, err.code);
      }
      throw err;
    }
  } catch (err) {
    return handleError(err);
  }
}
