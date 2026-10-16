import type { HouseParams } from "@/lib/house/params";
import type { Surfaces } from "@/lib/house/surfaces";
import { ECRETEMENT, type BaremeLigne, type Tranche } from "./bareme";
import { WORK_LABELS, availableWorks, workQuantity, type WorkId } from "./works";

export interface LigneEstimation {
  workId: WorkId;
  label: string;
  unite: "m2" | "unite";
  quantite: number;
  cout: number;
  mpr: number;
  cee: number;
}

export interface Estimation {
  lignes: LigneEstimation[];
  totalCout: number;
  totalMpr: number;
  totalCee: number;
  /** Montant retiré aux aides pour respecter le plafond de l'écrêtement. */
  ecretement: number;
  totalAides: number;
  resteACharge: number;
}

const euros = (x: number) => Math.round(x);

/**
 * Estimation indicative : quantités issues de la maquette × barème.
 * Les postes non disponibles pour cette maison (combles perdus sous une toiture plate…) sont ignorés.
 */
export function estimate(
  works: readonly WorkId[],
  surfaces: Surfaces,
  params: HouseParams,
  bareme: readonly BaremeLigne[],
  tranche: Tranche,
): Estimation {
  const dispo = new Set(availableWorks(params));
  const lignes: LigneEstimation[] = [];
  for (const w of new Set(works)) {
    const b = bareme.find((l) => l.workId === w);
    if (!b || !dispo.has(w)) continue;
    const quantite = workQuantity(w, surfaces, params);
    if (quantite <= 0) continue;
    const aidable = b.plafondUnites === null ? quantite : Math.min(quantite, b.plafondUnites);
    lignes.push({
      workId: w,
      label: WORK_LABELS[w],
      unite: b.unite,
      quantite,
      cout: euros(quantite * b.prixUnitaire),
      mpr: euros(aidable * b.mpr[tranche]),
      cee: euros(aidable * b.cee),
    });
  }

  const totalCout = lignes.reduce((s, l) => s + l.cout, 0);
  const mprBrut = lignes.reduce((s, l) => s + l.mpr, 0);
  const ceeBrut = lignes.reduce((s, l) => s + l.cee, 0);
  // Écrêtement : on réduit MaPrimeRénov' en premier, les CEE ensuite.
  const plafond = euros(totalCout * ECRETEMENT[tranche]);
  const totalCee = Math.min(ceeBrut, plafond);
  const totalMpr = Math.min(mprBrut, plafond - totalCee);
  const totalAides = totalMpr + totalCee;

  return {
    lignes,
    totalCout,
    totalMpr,
    totalCee,
    ecretement: mprBrut + ceeBrut - totalAides,
    totalAides,
    resteACharge: totalCout - totalAides,
  };
}
