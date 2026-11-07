/** Node-only boot tasks (imported from instrumentation.ts). */
export async function bootNode() {
  const skipMigrate = process.env.SKIP_BOOT_MIGRATE === "true";
  if (!skipMigrate) {
    const { runMigrations } = await import("@/server/db/migrate");
    try {
      await runMigrations();
    } catch (err) {
      // On Vercel, concurrent cold starts can race on CREATE SCHEMA.
      // If the app schema is already present (Neon pre-migrated), keep serving.
      try {
        const { db } = await import("@/server/db");
        const { sql } = await import("drizzle-orm");
        await db.execute(sql`select 1 from "users" limit 1`);
        console.warn("[boot] migrations failed but users table is reachable; continuing", err);
      } catch {
        console.error("[boot] migrations failed and schema is not ready", err);
        throw err;
      }
    }
  } else {
    console.info("[boot] SKIP_BOOT_MIGRATE=true — assuming schema is already applied");
  }

  const seedDemo = (process.env.SEED_DEMO ?? (process.env.NODE_ENV === "production" ? "false" : "true")) === "true";
  if (seedDemo) {
    try {
      const { isEmpty, seedDemo: seed } = await import("@/server/db/seed");
      if (await isEmpty()) {
        await seed();
      }
    } catch (err) {
      // Never take the site down for seed / cold DB wake failures.
      console.error("[boot] demo seed skipped", err);
    }
  }

  try {
    const { redis } = await import("@/server/redis/client");
    redis(); // open the connection early so the first request doesn't pay for it
  } catch (err) {
    console.warn("[boot] redis init skipped", err);
  }
}
