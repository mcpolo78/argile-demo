import type { WorkId } from "./works";

export const TRANCHES = ["tres-modeste", "modeste", "intermediaire", "superieur"] as const;
export type Tranche = (typeof TRANCHES)[number];

export const TRANCHE_LABELS: Record<Tranche, string> = {
  "tres-modeste": "Très modestes (bleu)",
  modeste: "Modestes (jaune)",
  intermediaire: "Intermédiaires (violet)",
  superieur: "Supérieurs (rose)",
};

/** Part maximale du coût couverte par l'ensemble des aides (écrêtement). */
export const ECRETEMENT: Record<Tranche, number> = {
  "tres-modeste": 0.9,
  modeste: 0.75,
  intermediaire: 0.6,
  superieur: 0.4,
};

export interface BaremeLigne {
  workId: WorkId;
  unite: "m2" | "unite";
  /** Prix TTC posé, par unité. */
  prixUnitaire: number;
  /** Prime CEE par unité, indépendante des revenus dans ce barème simplifié. */
  cee: number;
  /** Forfait MaPrimeRénov' par unité, selon la tranche de revenus. */
  mpr: Record<Tranche, number>;
  /** Nombre d'unités au-delà duquel l'aide n'est plus versée. */
  plafondUnites: number | null;
}

/**
 * Barème de démonstration : ordres de grandeur inspirés des forfaits par geste,
 * à ne pas prendre pour les montants officiels en vigueur.
 * Il sert de seed à la table `bareme` et de valeur par défaut dans les tests.
 */
export const DEFAULT_BAREME: BaremeLigne[] = [
  {
    workId: "isolation-combles-perdus",
    unite: "m2",
    prixUnitaire: 30,
    cee: 12,
    mpr: { "tres-modeste": 0, modeste: 0, intermediaire: 0, superieur: 0 },
    plafondUnites: null,
  },
  {
    workId: "isolation-rampants",
    unite: "m2",
    prixUnitaire: 70,
    cee: 12,
    mpr: { "tres-modeste": 25, modeste: 20, intermediaire: 15, superieur: 0 },
    plafondUnites: 100,
  },
  {
    workId: "isolation-toiture-terrasse",
    unite: "m2",
    prixUnitaire: 120,
    cee: 12,
    mpr: { "tres-modeste": 75, modeste: 60, intermediaire: 40, superieur: 0 },
    plafondUnites: 100,
  },
  {
    workId: "ite",
    unite: "m2",
    prixUnitaire: 180,
    cee: 10,
    mpr: { "tres-modeste": 75, modeste: 60, intermediaire: 40, superieur: 0 },
    plafondUnites: 100,
  },
  {
    workId: "isolation-plancher-bas",
    unite: "m2",
    prixUnitaire: 45,
    cee: 15,
    mpr: { "tres-modeste": 0, modeste: 0, intermediaire: 0, superieur: 0 },
    plafondUnites: null,
  },
  {
    workId: "menuiseries",
    unite: "unite",
    prixUnitaire: 900,
    cee: 0,
    mpr: { "tres-modeste": 100, modeste: 80, intermediaire: 40, superieur: 0 },
    plafondUnites: null,
  },
  {
    workId: "pac-air-eau",
    unite: "unite",
    prixUnitaire: 14000,
    cee: 2500,
    mpr: { "tres-modeste": 5000, modeste: 4000, intermediaire: 3000, superieur: 0 },
    plafondUnites: 1,
  },
];
