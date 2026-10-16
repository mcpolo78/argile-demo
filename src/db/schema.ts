import { integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Estimation } from "@/lib/estimate/estimate";
import type { Tranche } from "@/lib/estimate/bareme";
import type { WorkId } from "@/lib/estimate/works";
import type { HouseParams } from "@/lib/house/params";
import type { Surfaces } from "@/lib/house/surfaces";

/** Barème indicatif : une ligne par poste de travaux. */
export const bareme = pgTable("bareme", {
  workId: text("work_id").$type<WorkId>().primaryKey(),
  unite: text("unite").$type<"m2" | "unite">().notNull(),
  prixUnitaire: real("prix_unitaire").notNull(),
  cee: real("cee").notNull(),
  mprTresModeste: real("mpr_tres_modeste").notNull(),
  mprModeste: real("mpr_modeste").notNull(),
  mprIntermediaire: real("mpr_intermediaire").notNull(),
  mprSuperieur: real("mpr_superieur").notNull(),
  plafondUnites: integer("plafond_unites"),
});

/**
 * Projet sauvegardé. Les paramètres et les postes sont la source de vérité ;
 * surfaces et estimation sont recalculées côté serveur à l'enregistrement et gardées
 * telles qu'elles étaient, même si le barème change ensuite.
 */
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  params: jsonb("params").$type<HouseParams>().notNull(),
  works: jsonb("works").$type<WorkId[]>().notNull(),
  tranche: text("tranche").$type<Tranche>().notNull(),
  surfaces: jsonb("surfaces").$type<Surfaces>().notNull(),
  estimation: jsonb("estimation").$type<Estimation>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
