import type { House, Vec2, Zone } from "./geometry";

/** Aire d'un polygone simple (formule du lacet), toujours positive. */
export function polygonArea(pts: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

/** Aire nette d'une zone : contour moins les trous. Exacte car u et v sont orthonormés. */
export function zoneArea(z: Pick<Zone, "outline" | "holes">): number {
  return polygonArea(z.outline) - z.holes.reduce((s, h) => s + polygonArea(h), 0);
}

export interface Surfaces {
  /** Aire nette de chaque zone, en m². */
  parZone: Record<string, number>;
  emprise: number;
  /** Murs sous l'égout, ouvertures comprises, mitoyens compris. */
  mursBruts: number;
  mursMitoyens: number;
  /** Murs extérieurs non mitoyens, ouvertures déduites : la surface isolable par l'extérieur. */
  mursNets: number;
  /** Pignons non mitoyens (au-dessus de l'égout, toiture 2 pans). */
  pignons: number;
  ouvertures: number;
  fenetres: number;
  nbFenetres: number;
  rampants: number;
  plancherCombles: number;
  toitureTerrasse: number;
  plancherBas: number;
}

export function computeSurfaces(house: House): Surfaces {
  const s: Surfaces = {
    parZone: {},
    emprise: house.params.longueur * house.params.largeur,
    mursBruts: 0,
    mursMitoyens: 0,
    mursNets: 0,
    pignons: 0,
    ouvertures: 0,
    fenetres: 0,
    nbFenetres: 0,
    rampants: 0,
    plancherCombles: 0,
    toitureTerrasse: 0,
    plancherBas: 0,
  };
  for (const z of house.zones) {
    const a = zoneArea(z);
    s.parZone[z.id] = a;
    switch (z.kind) {
      case "mur":
        s.mursBruts += polygonArea(z.outline);
        if (z.mitoyen) s.mursMitoyens += polygonArea(z.outline);
        else s.mursNets += a;
        break;
      case "pignon":
        if (!z.mitoyen) s.pignons += a;
        break;
      case "fenetre":
        s.fenetres += a;
        s.nbFenetres++;
        s.ouvertures += a;
        break;
      case "porte":
        s.ouvertures += a;
        break;
      case "rampant":
        s.rampants += a;
        break;
      case "plancher-combles":
        s.plancherCombles += a;
        break;
      case "toiture-terrasse":
        s.toitureTerrasse += a;
        break;
      case "plancher-bas":
        s.plancherBas += a;
        break;
    }
  }
  return s;
}
