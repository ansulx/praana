import "server-only";
import fs from "node:fs";
import path from "node:path";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { db, dbKind } from "./index";

const g = globalThis as unknown as { __praanaMigrated?: Promise<void> };

function resolveMigrationsFolder(): string {
  const candidates = [
    path.resolve(process.cwd(), "drizzle"),
    path.resolve(process.cwd(), "../drizzle"),
    path.resolve(__dirname, "../../../drizzle"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "meta", "_journal.json"))) return dir;
  }
  throw new Error(
    `Can't find drizzle/meta/_journal.json (looked in: ${candidates.join(", ")})`,
  );
}

/** Applies pending SQL migrations from ./drizzle exactly once per process. */
export function runMigrations(): Promise<void> {
  if (!g.__praanaMigrated) {
    const migrationsFolder = resolveMigrationsFolder();
    g.__praanaMigrated = (async () => {
      const started = Date.now();
      if (dbKind() === "pglite") {
        await migratePglite(db as unknown as PgliteDatabase<Record<string, unknown>>, { migrationsFolder });
      } else {
        await migratePg(db, { migrationsFolder });
      }
      console.info(`[db] ${dbKind()} migrations up to date (${Date.now() - started}ms)`);
    })().catch((err) => {
      g.__praanaMigrated = undefined;
      throw err;
    });
  }
  return g.__praanaMigrated;
}
