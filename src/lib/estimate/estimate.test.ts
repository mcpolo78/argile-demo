import { describe, expect, it } from "vitest";
import { buildHouse } from "@/lib/house/geometry";
import { DEFAULT_PARAMS, houseParamsSchema, type HouseParams } from "@/lib/house/params";
import { computeSurfaces } from "@/lib/house/surfaces";
import { DEFAULT_BAREME, type BaremeLigne, type Tranche } from "./bareme";
import { estimate } from "./estimate";
import { availableWorks, normalizeWorks, workForZone, type WorkId } from "./works";

const P = (over: Partial<HouseParams> = {}) => houseParamsSchema.parse({ ...DEFAULT_PARAMS, ...over });
const run = (works: WorkId[], over: Partial<HouseParams> = {}, tranche: Tranche = "modeste", bareme = DEFAULT_BAREME) => {
  const p = P(over);
  return estimate(works, computeSurfaces(buildHouse(p)), p, bareme, tranche);
};

describe("correspondance zones → travaux", () => {
  it("un clic sur un pan de toit vise les combles perdus ou les rampants selon les combles", () => {
    const rampant = (p: HouseParams) => buildHouse(p).zones.find((z) => z.id === "rampant-sud")!;
    expect(workForZone(rampant(P()), P())).toBe("isolation-combles-perdus");
    const am = P({ combles: "amenages" });
    expect(workForZone(rampant(am), am)).toBe("isolation-rampants");
  });

  it("les murs mitoyens, les portes et les planchers sur terre-plein ne portent aucun poste", () => {
    const p = P({ mitoyens: 1, plancherBas: "terre-plein", fenetresParNiveau: { nord: 2, sud: 3, est: 0, ouest: 1 } });
    const byId = Object.fromEntries(buildHouse(p).zones.map((z) => [z.id, z]));
    expect(workForZone(byId["mur-est"], p)).toBeNull();
    expect(workForZone(byId["porte-sud"], p)).toBeNull();
    expect(workForZone(byId["plancher-bas"], p)).toBeNull();
    expect(workForZone(byId["mur-ouest"], p)).toBe("ite");
  });

  it("transpose l'isolation du toit quand le type de toit ou de combles change", () => {
    const sel: WorkId[] = ["isolation-combles-perdus", "ite", "isolation-plancher-bas"];
    expect(normalizeWorks(sel, P({ combles: "amenages" }))).toEqual(["isolation-rampants", "ite", "isolation-plancher-bas"]);
    expect(normalizeWorks(sel, P({ toiture: "plate", plancherBas: "terre-plein" }))).toEqual([
      "isolation-toiture-terrasse",
      "ite",
    ]);
  });

  it("propose les postes de toiture selon le type de toit", () => {
    expect(availableWorks(P({ toiture: "plate" }))).toContain("isolation-toiture-terrasse");
    expect(availableWorks(P({ toiture: "plate" }))).not.toContain("isolation-combles-perdus");
  });
});

describe("estimation", () => {
  it("combles perdus 11 × 8 : 88 m² × 30 € et 12 €/m² de CEE", () => {
    const e = run(["isolation-combles-perdus"]);
    expect(e.lignes[0].quantite).toBeCloseTo(88);
    expect(e.totalCout).toBe(2640);
    expect(e.totalCee).toBe(1056);
    expect(e.totalMpr).toBe(0);
    expect(e.resteACharge).toBe(2640 - 1056);
  });

  it("plafonne l'aide ITE à 100 m² mais facture toute la surface", () => {
    const e = run(["ite"], { niveaux: 2, longueur: 14, largeur: 10 });
    const l = e.lignes[0];
    expect(l.quantite).toBeGreaterThan(100);
    expect(l.cout).toBe(Math.round(l.quantite * 180));
    expect(l.mpr).toBe(100 * 60);
    expect(l.cee).toBe(100 * 10);
  });

  it("inclut les pignons dans l'ITE seulement sous des combles aménagés", () => {
    const perdus = run(["ite"]).lignes[0].quantite;
    const amenages = run(["ite"], { combles: "amenages" }).lignes[0].quantite;
    expect(amenages).toBeGreaterThan(perdus);
  });

  it("écrête les aides en réduisant MaPrimeRénov' d'abord", () => {
    const genereux: BaremeLigne[] = DEFAULT_BAREME.map((l) =>
      l.workId === "pac-air-eau" ? { ...l, mpr: { ...l.mpr, superieur: 10000 } } : l,
    );
    const e = run(["pac-air-eau"], {}, "superieur", genereux);
    // Plafond 40 % de 14 000 € = 5 600 € ; CEE 2 500 € conservés, MPR ramenée à 3 100 €.
    expect(e.totalAides).toBe(5600);
    expect(e.totalCee).toBe(2500);
    expect(e.totalMpr).toBe(3100);
    expect(e.ecretement).toBe(10000 + 2500 - 5600);
    expect(e.resteACharge).toBe(14000 - 5600);
  });

  it("ignore les postes indisponibles et les doublons", () => {
    const e = run(["isolation-toiture-terrasse", "menuiseries", "menuiseries"]);
    expect(e.lignes.map((l) => l.workId)).toEqual(["menuiseries"]);
    expect(e.lignes[0].quantite).toBe(7);
  });

  it("le reste à charge est toujours coût − aides, et jamais négatif", () => {
    const tous = availableWorks(P());
    for (const t of ["tres-modeste", "modeste", "intermediaire", "superieur"] as const) {
      const e = run(tous, {}, t);
      expect(e.resteACharge).toBe(e.totalCout - e.totalAides);
      expect(e.resteACharge).toBeGreaterThanOrEqual(0);
    }
  });
});
