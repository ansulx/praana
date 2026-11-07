import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { careLinks, careTeamMembers, inviteCodes, users } from "@/server/db/schema";
import { invalidate, ns } from "@/server/redis/cache";
import { invalidateTeam } from "./alerts";

/** Atomically redeems a code and creates the care link. Returns the patient id. */
export async function redeemInvite(code: string, kind: "caregiver" | "clinician", userId: string, relationship: string | null): Promise<string> {
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .update(inviteCodes)
      .set({ usedAt: new Date(), usedBy: userId })
      .where(and(eq(inviteCodes.code, code), eq(inviteCodes.kind, kind), isNull(inviteCodes.usedAt), gt(inviteCodes.expiresAt, new Date())))
      .returning();
    if (!invite) throw new Error("This code is invalid, already used, or expired. Please ask for a new one.");
    const [existing] = await tx
      .select({ id: careLinks.id })
      .from(careLinks)
      .where(and(eq(careLinks.patientId, invite.patientId), eq(careLinks.userId, userId)))
      .limit(1);
    if (existing) throw new Error("You're already connected to this person.");
    await tx.insert(careLinks).values({ patientId: invite.patientId, userId, kind, relationship });
    if (kind === "clinician") {
      const [u] = await tx.select().from(users).where(eq(users.id, userId));
      if (u) {
        await tx
          .insert(careTeamMembers)
          .values({ patientId: invite.patientId, userId, name: u.name, role: u.careRole ?? "coordinator", phone: u.phone, email: u.email })
          .onConflictDoNothing();
      }
    }
    return invite.patientId;
  }).then(async (patientId) => {
    await invalidateTeam(patientId);
    await invalidate(ns.clinician(userId), ns.user(userId));
    return patientId;
  });
}

