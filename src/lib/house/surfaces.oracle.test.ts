import { describe, expect, it } from "vitest";
import cases from "../../../fixtures/cases.json";
import oracle from "../../../fixtures/oracle.json";
import { buildHouse } from "./geometry";
import { houseParamsSchema } from "./params";
import { computeSurfaces, type Surfaces } from "./surfaces";

/**
 * Compare le calcul TypeScript aux aires mesurées dans Blender par une
 * implémentation indépendante (blender/house_oracle.py). Blender travaille en
 * float32 : tolérance relative de 0,01 %.
 * Pour régénérer : npm run oracle (Blender doit être installé).
 */
const TOL = 1e-4;
const CHAMPS = [
  "mursBruts",
  "mursMitoyens",
  "mursNets",
  "ouvertures",
  "fenetres",
  "nbFenetres",
  "pignons",
  "rampants",
  "plancherCombles",
  "toitureTerrasse",
  "plancherBas",
] as const satisfies readonly (keyof Surfaces)[];

const attendu = oracle.cases as Record<string, Record<(typeof CHAMPS)[number], number>>;

describe(`surfaces vs oracle Blender (${oracle.generator})`, () => {
  it("couvre tous les cas de fixtures/cases.json", () => {
    expect(Object.keys(attendu).sort()).toEqual(Object.keys(cases).sort());
  });

  describe.each(Object.entries(cases))("%s", (nom, brut) => {
    const s = computeSurfaces(buildHouse(houseParamsSchema.parse(brut)));
    it.each(CHAMPS)("%s", (champ) => {
      const b = attendu[nom][champ];
      expect(Math.abs(s[champ] - b)).toBeLessThanOrEqual(TOL * Math.max(1, Math.abs(b)));
    });
  });
});
