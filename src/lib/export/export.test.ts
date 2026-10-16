import { describe, expect, it } from "vitest";
import { DEFAULT_BAREME } from "@/lib/estimate/bareme";
import { estimate } from "@/lib/estimate/estimate";
import { buildHouse } from "@/lib/house/geometry";
import { DEFAULT_PARAMS, houseParamsSchema, type HouseParams } from "@/lib/house/params";
import { computeSurfaces } from "@/lib/house/surfaces";
import { formatEuros } from "@/lib/format";
import { EXPORT_FORMAT, buildExportJson, describeHouse, exportFileName, formatQuantite, pdfText, type ExportInput } from "./export";

const input = (over: Partial<HouseParams> = {}): ExportInput => {
  const params = houseParamsSchema.parse({ ...DEFAULT_PARAMS, ...over });
  const surfaces = computeSurfaces(buildHouse(params));
  const works = ["isolation-combles-perdus", "ite", "menuiseries"] as const;
  return {
    id: "1a2b3c4d-0000-4000-8000-000000000000",
    url: "https://argile-demo.vercel.app/projets/1a2b3c4d-0000-4000-8000-000000000000",
    date: new Date("2026-10-16T09:00:00Z"),
    params,
    works: [...works],
    tranche: "modeste",
    surfaces,
    estimation: estimate(works, surfaces, params, DEFAULT_BAREME, "modeste"),
  };
};

describe("export JSON", () => {
  it("reprend les totaux de l'estimation et le lien du projet", () => {
    const e = input();
    const j = buildExportJson(e);
    expect(j.format).toBe(EXPORT_FORMAT);
    expect(j.projet.url).toBe(e.url);
    expect(j.totaux.resteACharge).toBe(e.estimation.resteACharge);
    expect(j.travaux.map((t) => t.id)).toEqual(["isolation-combles-perdus", "ite", "menuiseries"]);
  });

  it("arrondit le métré au centimètre et n'exporte pas le détail par zone", () => {
    const j = buildExportJson(input());
    expect(j.metre).not.toHaveProperty("parZone");
    for (const v of Object.values(j.metre)) expect(Math.round(v * 100)).toBeCloseTo(v * 100, 6);
  });

  it("est sérialisable tel quel", () => {
    expect(() => JSON.parse(JSON.stringify(buildExportJson(input())))).not.toThrow();
  });
});

describe("textes du récapitulatif", () => {
  it("décrit le logement en français", () => {
    expect(describeHouse(input().params)).toEqual([
      "Maison de 11 × 8 m, 1 niveau, 2,5 m sous plafond",
      "Toiture 2 pans à 35°, combles perdus",
      "Plancher bas sur vide sanitaire, maison isolée",
      "Fenêtres par niveau : nord 2, sud 3, est 1, ouest 1",
    ]);
    expect(describeHouse(input({ toiture: "plate", niveaux: 2 }).params)[1]).toBe("Toiture plate (toiture-terrasse)");
  });

  it("remplace les espaces fines insécables que le PDF ne sait pas afficher", () => {
    const s = pdfText(formatEuros(17350));
    expect(s).toBe("17 350 €");
    expect(pdfText("l’extérieur")).toBe("l'extérieur");
  });

  it("formate les quantités selon l'unité", () => {
    expect(formatQuantite(81.725, "m2", "ite")).toBe("81,7 m²");
    expect(formatQuantite(7, "unite", "menuiseries")).toBe("7 fenêtres");
    expect(formatQuantite(1, "unite", "pac-air-eau")).toBe("1 unité");
  });

  it("nomme les fichiers avec le début de l'identifiant", () => {
    expect(exportFileName("1a2b3c4d-0000", "pdf")).toBe("estimation-renovation-1a2b3c4d.pdf");
  });
});
