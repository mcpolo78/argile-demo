import { TRANCHE_LABELS, type Tranche } from "@/lib/estimate/bareme";
import type { Estimation } from "@/lib/estimate/estimate";
import { WORK_LABELS, type WorkId } from "@/lib/estimate/works";
import type { HouseParams } from "@/lib/house/params";
import type { Surfaces } from "@/lib/house/surfaces";

export interface ExportInput {
  id: string;
  url: string;
  date: Date;
  params: HouseParams;
  works: WorkId[];
  tranche: Tranche;
  surfaces: Surfaces;
  estimation: Estimation;
}

/** Version du format JSON exporté, à incrémenter si sa structure change. */
export const EXPORT_FORMAT = "argile-demo/estimation@1";

/**
 * Données structurées de l'estimation, pensées pour être importées ailleurs
 * (CRM d'artisan, tableur) : identifiants stables + libellés lisibles.
 */
export function buildExportJson(e: ExportInput) {
  return {
    format: EXPORT_FORMAT,
    projet: { id: e.id, url: e.url, date: e.date.toISOString() },
    logement: e.params,
    revenus: { tranche: e.tranche, libelle: TRANCHE_LABELS[e.tranche] },
    travaux: e.estimation.lignes.map((l) => ({
      id: l.workId,
      libelle: l.label,
      quantite: arrondi(l.quantite),
      unite: l.unite,
      cout: l.cout,
      maPrimeRenov: l.mpr,
      cee: l.cee,
    })),
    totaux: {
      cout: e.estimation.totalCout,
      maPrimeRenov: e.estimation.totalMpr,
      cee: e.estimation.totalCee,
      ecretement: e.estimation.ecretement,
      aides: e.estimation.totalAides,
      resteACharge: e.estimation.resteACharge,
    },
    metre: Object.fromEntries(
      Object.entries(e.surfaces)
        .filter(([k]) => k !== "parZone")
        .map(([k, v]) => [k, arrondi(v as number)]),
    ),
    avertissement: "Estimation indicative, barème de démonstration non contractuel.",
  };
}

const arrondi = (x: number) => Math.round(x * 100) / 100;

/** Nom de fichier court et stable : estimation-renovation-1a2b3c4d.pdf */
export function exportFileName(id: string, ext: "pdf" | "png" | "json") {
  return `estimation-renovation-${id.slice(0, 8)}.${ext}`;
}

/**
 * Les polices standard du PDF (WinAnsi) ne connaissent pas les espaces fines
 * insécables que toLocaleString("fr-FR") place dans « 17 350 € » : on les remplace.
 */
export function pdfText(s: string) {
  return s.replace(/[   ]/g, " ").replace(/[‘’]/g, "'");
}

const nb = (x: number) => x.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/** Description du logement en phrases courtes, pour le récapitulatif. */
export function describeHouse(p: HouseParams): string[] {
  const toit =
    p.toiture === "plate"
      ? "Toiture plate (toiture-terrasse)"
      : `Toiture ${p.toiture === "deux-pans" ? "2 pans" : "4 pans"} à ${nb(p.pente)}°, combles ${p.combles === "perdus" ? "perdus" : "aménagés"}`;
  const plancher = { "terre-plein": "terre-plein", "vide-sanitaire": "vide sanitaire", "sous-sol": "sous-sol" }[p.plancherBas];
  const mitoyennete = ["maison isolée", "1 mur mitoyen (est)", "2 murs mitoyens (est et ouest)"][p.mitoyens];
  const f = p.fenetresParNiveau;
  return [
    `Maison de ${nb(p.longueur)} × ${nb(p.largeur)} m, ${p.niveaux} niveau${p.niveaux > 1 ? "x" : ""}, ${nb(p.hauteurSousPlafond)} m sous plafond`,
    toit,
    `Plancher bas sur ${plancher}, ${mitoyennete}`,
    `Fenêtres par niveau : nord ${f.nord}, sud ${f.sud}, est ${f.est}, ouest ${f.ouest}`,
  ];
}

export function formatQuantite(quantite: number, unite: "m2" | "unite", workId: WorkId) {
  if (unite === "m2") return `${nb(Math.round(quantite * 10) / 10)} m²`;
  if (workId === "menuiseries") return `${quantite} fenêtre${quantite > 1 ? "s" : ""}`;
  return `${quantite} unité`;
}

export const workLabel = (w: WorkId) => WORK_LABELS[w];
