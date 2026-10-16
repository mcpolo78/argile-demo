import "server-only";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { seedBareme } from "./seed";

/** Type commun aux deux drivers : le code applicatif ne sait pas lequel tourne. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { dbPromise?: Promise<Db> };

/**
 * Neon si DATABASE_URL est défini (prod), sinon PGlite embarqué dans `.pglite/`,
 * migré et seedé au premier appel : aucun Postgres à installer en local.
 */
async function connect(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    return drizzleNeon(neon(process.env.DATABASE_URL), { schema }) as unknown as Db;
  }
  const db = drizzlePglite(new PGlite(".pglite"), { schema });
  await migratePglite(db, { migrationsFolder: "drizzle" });
  await seedBareme(db);
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  // Mémorisé sur globalThis pour survivre au rechargement à chaud de Next en dev.
  globalForDb.dbPromise ??= connect();
  return globalForDb.dbPromise;
}
