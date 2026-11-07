/**
 * Standalone Neon migrate + demo seed (bypasses Next server-only for CLI).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const require = createRequire(import.meta.url);
// Stub server-only before any app import.
require("./server-only-stub.cjs");

function migrationsFolder(): string {
  const dir = path.resolve(process.cwd(), "drizzle");
  if (!fs.existsSync(path.join(dir, "meta", "_journal.json"))) {
    throw new Error(`Missing ${dir}/meta/_journal.json`);
  }
  return dir;
}

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new Pool({ connectionString: url, max: 2, ssl: { rejectUnauthorized: false } });
  const db = drizzle(pool);

  console.log("[migrate] applying drizzle migrations…");
  await migrate(db, { migrationsFolder: migrationsFolder() });
  console.log("[migrate] migrations ok");
  await pool.end();

  if ((process.env.SEED_DEMO ?? "true") === "true") {
    const { isEmpty, seedDemo } = await import(pathToFileURL(path.resolve("src/server/db/seed.ts")).href);
    const { closeDb } = await import(pathToFileURL(path.resolve("src/server/db/index.ts")).href);
    if (await isEmpty()) {
      console.log("[migrate] seeding demo users…");
      await seedDemo();
    } else {
      console.log("[migrate] skip seed (db not empty)");
    }
    await closeDb();
  }

  console.log("[migrate] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
