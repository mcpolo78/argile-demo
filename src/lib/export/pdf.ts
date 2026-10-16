import { TRANCHE_LABELS } from "@/lib/estimate/bareme";
import { formatEuros } from "@/lib/format";
import { describeHouse, formatQuantite, pdfText, type ExportInput } from "./export";

export interface Snapshot {
  /** PNG pleine résolution, pour l'export image. */
  dataUrl: string;
  /** Même vue en JPEG, dix fois plus légère, pour le PDF. */
  jpegDataUrl?: string;
  width: number;
  height: number;
}

const ACCENT: [number, number, number] = [47, 107, 79];
const MUTED: [number, number, number] = [107, 114, 109];
const TEXT: [number, number, number] = [31, 42, 36];

/**
 * Récapitulatif A4 d'une page : vue 3D, logement, postes, totaux, lien du projet.
 * jsPDF est chargé à la demande pour ne pas alourdir le premier affichage.
 */
export async function buildPdf(e: ExportInput, vue: Snapshot | null): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 15;
  const t = (s: string, x: number, y: number, opts?: Parameters<typeof doc.text>[3]) => doc.text(pdfText(s), x, y, opts);
  const color = (c: [number, number, number]) => doc.setTextColor(...c);
  let y = 20;

  // En-tête.
  doc.setFont("helvetica", "bold").setFontSize(18);
  color(TEXT);
  t("Estimation de travaux de rénovation", M, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  color(MUTED);
  y += 6;
  t(`Réf. ${e.id.slice(0, 8)} · ${e.date.toLocaleDateString("fr-FR", { dateStyle: "long" })}`, M, y);

  // Vue 3D, à la largeur de la page, hauteur limitée.
  y += 5;
  if (vue) {
    let w = W - 2 * M;
    let h = (w * vue.height) / vue.width;
    if (h > 90) {
      h = 90;
      w = (h * vue.width) / vue.height;
    }
    if (vue.jpegDataUrl) doc.addImage(vue.jpegDataUrl, "JPEG", (W - w) / 2, y, w, h);
    else doc.addImage(vue.dataUrl, "PNG", (W - w) / 2, y, w, h);
    y += h + 8;
  }

  // Logement.
  const titre = (s: string) => {
    doc.setFont("helvetica", "bold").setFontSize(11);
    color(ACCENT);
    t(s.toUpperCase(), M, y);
    y += 6;
    doc.setFont("helvetica", "normal").setFontSize(10);
    color(TEXT);
  };
  titre("Votre logement");
  for (const ligne of [...describeHouse(e.params), `Revenus du foyer : ${TRANCHE_LABELS[e.tranche]}`]) {
    t(ligne, M, y);
    y += 5;
  }

  // Postes de travaux.
  y += 4;
  titre("Travaux retenus");
  const cols = { poste: M, quantite: 110, cout: 137, mpr: 170, cee: W - M };
  doc.setFont("helvetica", "bold").setFontSize(9);
  color(MUTED);
  t("Poste", cols.poste, y);
  t("Quantité", cols.quantite, y, { align: "right" });
  t("Coût", cols.cout, y, { align: "right" });
  t("MaPrimeRénov'", cols.mpr, y, { align: "right" });
  t("CEE", cols.cee, y, { align: "right" });
  y += 2;
  doc.setDrawColor(220, 214, 204).line(M, y, W - M, y);
  y += 5;
  doc.setFont("helvetica", "normal").setFontSize(10);
  color(TEXT);
  for (const l of e.estimation.lignes) {
    t(l.label, cols.poste, y);
    t(formatQuantite(l.quantite, l.unite, l.workId), cols.quantite, y, { align: "right" });
    t(formatEuros(l.cout), cols.cout, y, { align: "right" });
    t(formatEuros(l.mpr), cols.mpr, y, { align: "right" });
    t(formatEuros(l.cee), cols.cee, y, { align: "right" });
    y += 6;
  }
  doc.line(M, y - 3, W - M, y - 3);

  // Totaux, alignés à droite.
  y += 3;
  const total = (label: string, valeur: string, fort = false) => {
    doc.setFont("helvetica", fort ? "bold" : "normal").setFontSize(fort ? 13 : 10);
    t(label, 120, y);
    t(valeur, W - M, y, { align: "right" });
    y += fort ? 8 : 6;
  };
  const est = e.estimation;
  total("Coût des travaux", formatEuros(est.totalCout));
  total("MaPrimeRénov'", `- ${formatEuros(est.totalMpr)}`);
  total("Primes CEE", `- ${formatEuros(est.totalCee)}`);
  if (est.ecretement > 0) total("dont écrêtement", formatEuros(est.ecretement));
  color(ACCENT);
  y += 1;
  total("Reste à charge", formatEuros(est.resteACharge), true);

  // Pied de page.
  doc.setFont("helvetica", "normal").setFontSize(8);
  color(MUTED);
  const pied = 282;
  t("Estimation indicative : barème de démonstration, non contractuel. Surfaces calculées sur la maquette 3D.", M, pied);
  t("Retrouver et modifier ce projet : ", M, pied + 4.5);
  color(ACCENT);
  doc.textWithLink(e.url, M + doc.getTextWidth("Retrouver et modifier ce projet : "), pied + 4.5, { url: e.url });

  return doc.output("blob");
}

export function download(data: Blob | string, filename: string) {
  const url = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof data !== "string") setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Charge la capture PNG pour connaître ses proportions et en tirer une version JPEG pour le PDF. */
export function snapshotOf(dataUrl: string): Promise<Snapshot> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      let jpegDataUrl: string | undefined;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        jpegDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      }
      resolve({ dataUrl, jpegDataUrl, width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
