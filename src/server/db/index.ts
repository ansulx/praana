import "server-only";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/server/env";
import * as schema from "./schema";

/**
 * One database handle per process, reused across hot reloads.
 * - DATABASE_URL set   → pooled connection to a real Postgres server.
 * - DATABASE_URL empty → embedded Postgres (PGlite) on disk. Same SQL, zero setup.
 * Both drivers expose the identical Drizzle query API, so callers never branch.
 */
export type Database = NodePgDatabase<typeof schema>;

type DbState = { db: Database; kind: "postgres" | "pglite"; close: () => Promise<void> };

const g = globalThis as unknown as { __praanaDb?: DbState };

function create(): DbState {
  if (env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on("error", (err) => console.error("[db] idle client error", err.message));
    return { db: drizzlePg(pool, { schema }), kind: "postgres", close: () => pool.end() };
  }

  const dir = path.resolve(process.cwd(), env.PGLITE_DIR);
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema }) as unknown as Database;
  return { db, kind: "pglite", close: () => client.close() };
}

function state(): DbState {
  if (!g.__praanaDb) g.__praanaDb = create();
  return g.__praanaDb;
}

export const db: Database = new Proxy({} as Database, {
  get(_t, prop, receiver) {
    return Reflect.get(state().db, prop, receiver);
  },
});

export const dbKind = () => state().kind;
export const closeDb = () => state().close();
export { schema };
