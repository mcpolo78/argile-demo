import type { Zone } from "@/lib/house/geometry";
import type { HouseParams } from "@/lib/house/params";
import type { Surfaces } from "@/lib/house/surfaces";

export const WORK_IDS = [
  "isolation-combles-perdus",
  "isolation-rampants",
  "isolation-toiture-terrasse",
  "ite",
  "isolation-plancher-bas",
  "menuiseries",
  "pac-air-eau",
] as const;
export type WorkId = (typeof WORK_IDS)[number];

export const WORK_LABELS: Record<WorkId, string> = {
  "isolation-combles-perdus": "Isolation des combles perdus",
  "isolation-rampants": "Isolation des rampants",
  "isolation-toiture-terrasse": "Isolation de la toiture-terrasse",
  ite: "Isolation des murs par l'extérieur",
  "isolation-plancher-bas": "Isolation du plancher bas",
  menuiseries: "Remplacement des fenêtres",
  "pac-air-eau": "Pompe à chaleur air-eau",
};

/** Couleur de surbrillance de chaque poste dans la vue 3D. */
export const WORK_COLORS: Record<WorkId, string> = {
  "isolation-combles-perdus": "#e8a33d",
  "isolation-rampants": "#e8a33d",
  "isolation-toiture-terrasse": "#e8a33d",
  ite: "#3b82c4",
  "isolation-plancher-bas": "#8b6bd1",
  menuiseries: "#2fa58f",
  // Gris de l'unité extérieure : c'est un équipement, pas une zone à colorer.
  "pac-air-eau": "#9aa0a6",
};

/** Poste de travaux associé à une zone cliquée, ou null si la zone n'en porte pas. */
export function workForZone(z: Zone, p: HouseParams): WorkId | null {
  switch (z.kind) {
    case "rampant":
    case "plancher-combles":
      return p.combles === "perdus" ? "isolation-combles-perdus" : "isolation-rampants";
    case "toiture-terrasse":
      return "isolation-toiture-terrasse";
    case "mur":
      return z.mitoyen ? null : "ite";
    case "pignon":
      // Sous des combles perdus, le pignon ferme un volume non chauffé : on ne l'isole pas.
      return !z.mitoyen && p.combles === "amenages" ? "ite" : null;
    case "fenetre":
      return "menuiseries";
    case "plancher-bas":
      return p.plancherBas === "terre-plein" ? null : "isolation-plancher-bas";
    case "porte":
      return null;
  }
}

/** Postes réalisables pour cette maison. */
export function availableWorks(p: HouseParams): WorkId[] {
  return WORK_IDS.filter((w) => {
    switch (w) {
      case "isolation-combles-perdus":
        return p.toiture !== "plate" && p.combles === "perdus";
      case "isolation-rampants":
        return p.toiture !== "plate" && p.combles === "amenages";
      case "isolation-toiture-terrasse":
        return p.toiture === "plate";
      case "isolation-plancher-bas":
        return p.plancherBas !== "terre-plein";
      default:
        return true;
    }
  });
}

const POSTES_TOITURE: WorkId[] = ["isolation-combles-perdus", "isolation-rampants", "isolation-toiture-terrasse"];

/**
 * Remet la sélection en cohérence après un changement de paramètres : un poste
 * d'isolation de toiture devient celui qui correspond au nouveau toit, et les
 * postes devenus impossibles sont retirés.
 */
export function normalizeWorks(works: Iterable<WorkId>, p: HouseParams): WorkId[] {
  const dispo = availableWorks(p);
  const out = new Set<WorkId>();
  for (const w of works) {
    if (POSTES_TOITURE.includes(w)) {
      const toit = dispo.find((d) => POSTES_TOITURE.includes(d));
      if (toit) out.add(toit);
    } else if (dispo.includes(w)) {
      out.add(w);
    }
  }
  return WORK_IDS.filter((w) => out.has(w));
}

/** Quantité d'un poste : m² pour l'isolation, unités pour les fenêtres et les équipements. */
export function workQuantity(w: WorkId, s: Surfaces, p: HouseParams): number {
  switch (w) {
    case "isolation-combles-perdus":
      return s.plancherCombles;
    case "isolation-rampants":
      return s.rampants;
    case "isolation-toiture-terrasse":
      return s.toitureTerrasse;
    case "ite":
      return s.mursNets + (p.combles === "amenages" ? s.pignons : 0);
    case "isolation-plancher-bas":
      return s.plancherBas;
    case "menuiseries":
      return s.nbFenetres;
    case "pac-air-eau":
      return 1;
  }
}
