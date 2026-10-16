/**
 * Migre et seed la base Neon de prod : `DATABASE_URL=... npm run db:migrate`.
 * En local, rien à lancer : PGlite est migré au premier appel de getDb().
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import * as schema from "./schema";
import { seedBareme } from "./seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant");

const db = drizzle(neon(url), { schema });
await migrate(db, { migrationsFolder: "drizzle" });
await seedBareme(db);
console.log("Base migrée et barème seedé.");
