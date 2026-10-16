import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { DEFAULT_BAREME, type BaremeLigne } from "@/lib/estimate/bareme";
import { bareme } from "./schema";

type AnyPgDb = PgDatabase<PgQueryResultHKT, Record<string, unknown>>;

export function toRow(l: BaremeLigne): typeof bareme.$inferInsert {
  return {
    workId: l.workId,
    unite: l.unite,
    prixUnitaire: l.prixUnitaire,
    cee: l.cee,
    mprTresModeste: l.mpr["tres-modeste"],
    mprModeste: l.mpr.modeste,
    mprIntermediaire: l.mpr.intermediaire,
    mprSuperieur: l.mpr.superieur,
    plafondUnites: l.plafondUnites,
  };
}

export function fromRow(r: typeof bareme.$inferSelect): BaremeLigne {
  return {
    workId: r.workId,
    unite: r.unite,
    prixUnitaire: r.prixUnitaire,
    cee: r.cee,
    mpr: {
      "tres-modeste": r.mprTresModeste,
      modeste: r.mprModeste,
      intermediaire: r.mprIntermediaire,
      superieur: r.mprSuperieur,
    },
    plafondUnites: r.plafondUnites,
  };
}

/** Insère le barème de démonstration sans écraser une ligne déjà modifiée. */
export async function seedBareme(db: AnyPgDb) {
  await db.insert(bareme).values(DEFAULT_BAREME.map(toRow)).onConflictDoNothing();
}
