import { describe, expect, it } from "vitest";
import { buildHouse, emplacementPac, normalOf, toWorld, type Vec3 } from "./geometry";
import { DEFAULT_PARAMS, OUVERTURES, houseParamsSchema, type HouseParams } from "./params";
import { computeSurfaces, polygonArea } from "./surfaces";

const P = (over: Partial<HouseParams>): HouseParams => houseParamsSchema.parse({ ...DEFAULT_PARAMS, ...over });
const sansFenetre = { nord: 0, sud: 0, est: 0, ouest: 0 };
const PORTE = OUVERTURES.porte.largeur * OUVERTURES.porte.hauteur;
const FEN = OUVERTURES.fenetre.largeur * OUVERTURES.fenetre.hauteur;

describe("polygonArea", () => {
  it("calcule l'aire d'un rectangle et d'un triangle, quel que soit le sens", () => {
    expect(polygonArea([[0, 0], [4, 0], [4, 3], [0, 3]])).toBe(12);
    expect(polygonArea([[0, 0], [0, 3], [4, 0]])).toBe(6);
  });
});

describe("surfaces calculées à la main", () => {
  it("boîte à toiture plate, 10 × 6 m, un niveau, porte seule", () => {
    const s = computeSurfaces(buildHouse(P({ longueur: 10, largeur: 6, toiture: "plate", fenetresParNiveau: sansFenetre })));
    expect(s.emprise).toBe(60);
    expect(s.mursBruts).toBeCloseTo(2 * (10 + 6) * 2.5);
    expect(s.ouvertures).toBeCloseTo(PORTE);
    expect(s.mursNets).toBeCloseTo(80 - PORTE);
    expect(s.toitureTerrasse).toBeCloseTo(60);
    expect(s.plancherBas).toBeCloseTo(60);
    expect(s.rampants).toBe(0);
    expect(s.plancherCombles).toBe(0);
    expect(s.pignons).toBe(0);
  });

  it("deux pans à 45°, 10 × 8 m : rampants, pignons et plancher des combles", () => {
    const house = buildHouse(P({ longueur: 10, largeur: 8, toiture: "deux-pans", pente: 45 }));
    const s = computeSurfaces(house);
    expect(house.hauteurToit).toBeCloseTo(4);
    expect(s.parZone["rampant-sud"]).toBeCloseTo(10 * 4 * Math.SQRT2);
    expect(s.rampants).toBeCloseTo(2 * 10 * 4 * Math.SQRT2);
    expect(s.pignons).toBeCloseTo(2 * ((8 * 4) / 2));
    expect(s.plancherCombles).toBeCloseTo(80);
  });

  it("quatre pans à 45°, 10 × 8 m : trapèzes et croupes", () => {
    const s = computeSurfaces(buildHouse(P({ longueur: 10, largeur: 8, toiture: "quatre-pans", pente: 45 })));
    const r = 4 * Math.SQRT2;
    expect(s.parZone["rampant-sud"]).toBeCloseTo(((10 + 2) / 2) * r);
    expect(s.parZone["rampant-est"]).toBeCloseTo((8 * r) / 2);
    expect(s.pignons).toBe(0);
  });

  it("quatre pans sur plan carré : quatre triangles, sans sommet dupliqué", () => {
    const house = buildHouse(P({ longueur: 8, largeur: 8, toiture: "quatre-pans", pente: 30 }));
    const sud = house.zones.find((z) => z.id === "rampant-sud")!;
    expect(sud.outline).toHaveLength(3);
  });

  it("ouvertures : murs nets = murs bruts − ouvertures, sur plusieurs niveaux", () => {
    const p = P({ niveaux: 2, fenetresParNiveau: { nord: 2, sud: 3, est: 1, ouest: 1 } });
    const s = computeSurfaces(buildHouse(p));
    expect(s.nbFenetres).toBe(2 * (2 + 3 + 1 + 1));
    expect(s.fenetres).toBeCloseTo(s.nbFenetres * FEN);
    expect(s.ouvertures).toBeCloseTo(s.fenetres + PORTE);
    expect(s.mursNets).toBeCloseTo(s.mursBruts - s.ouvertures);
  });

  it("murs mitoyens : exclus des murs nets et des pignons", () => {
    const p = P({ mitoyens: 2, fenetresParNiveau: { nord: 2, sud: 3, est: 0, ouest: 0 } });
    const s = computeSurfaces(buildHouse(p));
    const H = p.niveaux * p.hauteurSousPlafond;
    expect(s.mursMitoyens).toBeCloseTo(2 * p.largeur * H);
    expect(s.mursNets).toBeCloseTo(2 * p.longueur * H - s.ouvertures);
    expect(s.pignons).toBe(0);
  });
});

describe("invariants géométriques", () => {
  const cas: Partial<HouseParams>[] = [
    { toiture: "deux-pans", pente: 20 },
    { toiture: "deux-pans", pente: 55, niveaux: 2 },
    { toiture: "quatre-pans", pente: 30, longueur: 14, largeur: 9 },
    { toiture: "quatre-pans", pente: 40, longueur: 9, largeur: 9 },
    { toiture: "plate", niveaux: 3 },
  ];

  it.each(cas)("toiture = emprise / cos(pente) (%o)", (over) => {
    const p = P(over);
    const s = computeSurfaces(buildHouse(p));
    const toit = s.rampants + s.toitureTerrasse;
    const cos = p.toiture === "plate" ? 1 : Math.cos((p.pente * Math.PI) / 180);
    expect(toit).toBeCloseTo(s.emprise / cos, 6);
  });

  it.each(cas)("normales unitaires et orientées vers l'extérieur (%o)", (over) => {
    const house = buildHouse(P(over));
    const centre: Vec3 = [0, house.hauteurMurs / 2, 0];
    for (const z of house.zones) {
      const n = normalOf(z);
      expect(Math.hypot(...n)).toBeCloseTo(1);
      const c = z.outline.map((pt) => toWorld(z, pt)).reduce<Vec3>(
        (a, b) => [a[0] + b[0] / z.outline.length, a[1] + b[1] / z.outline.length, a[2] + b[2] / z.outline.length],
        [0, 0, 0],
      );
      const d = (c[0] - centre[0]) * n[0] + (c[1] - centre[1]) * n[1] + (c[2] - centre[2]) * n[2];
      expect(d, z.id).toBeGreaterThan(0);
    }
  });

  it.each(cas)("les ouvertures tiennent dans leur mur sans se chevaucher (%o)", (over) => {
    const house = buildHouse(P(over));
    for (const mur of house.zones.filter((z) => z.kind === "mur")) {
      const [, , [lf, H]] = mur.outline;
      const boites = mur.holes.map((h) => ({ x0: h[0][0], x1: h[2][0], y0: h[0][1], y1: h[2][1] }));
      for (const b of boites) {
        expect(b.x0).toBeGreaterThanOrEqual(OUVERTURES.espaceMin - 1e-9);
        expect(b.x1).toBeLessThanOrEqual(lf - OUVERTURES.espaceMin + 1e-9);
        expect(b.y1).toBeLessThanOrEqual(H);
      }
      for (const [i, a] of boites.entries()) {
        for (const b of boites.slice(i + 1)) {
          const chevauche = a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
          expect(chevauche).toBe(false);
        }
      }
    }
  });

  it("les deux pans d'une toiture 2 pans sont symétriques", () => {
    const s = computeSurfaces(buildHouse(P({ toiture: "deux-pans" })));
    expect(s.parZone["rampant-nord"]).toBeCloseTo(s.parZone["rampant-sud"]);
  });
});

describe("validation des paramètres", () => {
  const erreur = (over: Partial<HouseParams>) => {
    const r = houseParamsSchema.safeParse({ ...DEFAULT_PARAMS, ...over });
    return r.success ? null : r.error.issues.map((i) => i.path.join("."));
  };

  it("accepte les valeurs par défaut", () => {
    expect(erreur({})).toBeNull();
  });
  it("refuse une largeur supérieure à la longueur", () => {
    expect(erreur({ longueur: 6, largeur: 8 })).toContain("largeur");
  });
  it("refuse des combles aménagés sous une toiture plate", () => {
    expect(erreur({ toiture: "plate", combles: "amenages" })).toContain("combles");
  });
  it("refuse une fenêtre sur une façade mitoyenne", () => {
    expect(erreur({ mitoyens: 1 })).toContain("fenetresParNiveau.est");
  });
  it("refuse trop de fenêtres pour la façade", () => {
    expect(erreur({ largeur: 5, fenetresParNiveau: { ...DEFAULT_PARAMS.fenetresParNiveau, est: 4 } })).toContain(
      "fenetresParNiveau.est",
    );
  });
});

describe("emplacement de la PAC", () => {
  it("se place devant la façade nord, hors de l'emprise", () => {
    const p = P({});
    const { position } = emplacementPac(p);
    expect(position[2]).toBeLessThan(-p.largeur / 2);
  });
  it("évite les façades mitoyennes", () => {
    const p = P({ mitoyens: 2, fenetresParNiveau: { nord: 2, sud: 3, est: 0, ouest: 0 } });
    const { position } = emplacementPac(p);
    expect(Math.abs(position[0])).toBeLessThan(p.longueur / 2);
  });
});
