import {
  FACADES,
  OUVERTURES,
  facadesMitoyennes,
  longueurFacade,
  type Facade,
  type HouseParams,
} from "./params";

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export type ZoneKind =
  | "mur"
  | "pignon"
  | "rampant"
  | "toiture-terrasse"
  | "plancher-combles"
  | "plancher-bas"
  | "fenetre"
  | "porte";

/**
 * Une zone est un polygone plan (éventuellement troué).
 * Un point 2D (x, y) du contour vaut `origin + x·u + y·v` dans l'espace,
 * avec `u` et `v` orthonormés et `u × v` orienté vers l'extérieur.
 * Repère three.js : y vers le haut, x vers l'est, z vers le sud.
 */
export interface Zone {
  id: string;
  kind: ZoneKind;
  label: string;
  facade?: Facade;
  mitoyen?: boolean;
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  outline: Vec2[];
  holes: Vec2[][];
}

export interface House {
  params: HouseParams;
  /** Hauteur des murs (à l'égout du toit). */
  hauteurMurs: number;
  /** Hauteur du faîtage au-dessus de l'égout, 0 pour une toiture plate. */
  hauteurToit: number;
  zones: Zone[];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Point 3D d'un point 2D de zone. */
export function toWorld(z: Pick<Zone, "origin" | "u" | "v">, [x, y]: Vec2): Vec3 {
  return [
    z.origin[0] + x * z.u[0] + y * z.v[0],
    z.origin[1] + x * z.u[1] + y * z.v[1],
    z.origin[2] + x * z.u[2] + y * z.v[2],
  ];
}

export const normalOf = (z: Pick<Zone, "u" | "v">): Vec3 => cross(z.u, z.v);

const rect = (x: number, y: number, w: number, h: number): Vec2[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

/** Supprime les sommets consécutifs confondus (toit 4 pans sur plan carré). */
function dedupe(pts: Vec2[]): Vec2[] {
  return pts.filter((p, i) => {
    const q = pts[(i + pts.length - 1) % pts.length];
    return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9;
  });
}

/** Repère de chaque façade, origine au pied de l'angle gauche vu de l'extérieur. */
function facadeFrame(f: Facade, hx: number, hz: number): Pick<Zone, "origin" | "u" | "v"> {
  const up: Vec3 = [0, 1, 0];
  switch (f) {
    case "sud":
      return { origin: [-hx, 0, hz], u: [1, 0, 0], v: up };
    case "nord":
      return { origin: [hx, 0, -hz], u: [-1, 0, 0], v: up };
    case "est":
      return { origin: [hx, 0, hz], u: [0, 0, -1], v: up };
    case "ouest":
      return { origin: [-hx, 0, -hz], u: [0, 0, 1], v: up };
  }
}

const LABEL_FACADE: Record<Facade, string> = {
  nord: "nord",
  sud: "sud",
  est: "est",
  ouest: "ouest",
};

/** Ouvertures d'une façade, en coordonnées du repère de la façade. */
function ouvertures(p: HouseParams, f: Facade) {
  const { fenetre, porte } = OUVERTURES;
  const lf = longueurFacade(p, f);
  const out: { id: string; kind: "fenetre" | "porte"; label: string; rect: Vec2[] }[] = [];
  for (let niveau = 0; niveau < p.niveaux; niveau++) {
    const n = p.fenetresParNiveau[f];
    const avecPorte = f === "sud" && niveau === 0;
    const slots: ("fenetre" | "porte")[] = Array(n).fill("fenetre");
    if (avecPorte) slots.splice(Math.floor(n / 2), 0, "porte");
    if (slots.length === 0) continue;
    const largeurs = slots.reduce((s, k) => s + (k === "porte" ? porte.largeur : fenetre.largeur), 0);
    const gap = (lf - largeurs) / (slots.length + 1);
    let x = gap;
    let i = 0;
    for (const k of slots) {
      const y0 = niveau * p.hauteurSousPlafond;
      if (k === "porte") {
        out.push({
          id: `porte-${f}`,
          kind: "porte",
          label: `Porte d'entrée (${LABEL_FACADE[f]})`,
          rect: rect(x, y0, porte.largeur, porte.hauteur),
        });
        x += porte.largeur + gap;
      } else {
        out.push({
          id: `fenetre-${f}-${niveau}-${i}`,
          kind: "fenetre",
          label: `Fenêtre ${LABEL_FACADE[f]}, niveau ${niveau}`,
          rect: rect(x, y0 + fenetre.allege, fenetre.largeur, fenetre.hauteur),
        });
        x += fenetre.largeur + gap;
        i++;
      }
    }
  }
  return out;
}

export function buildHouse(p: HouseParams): House {
  const hx = p.longueur / 2;
  const hz = p.largeur / 2;
  const H = p.niveaux * p.hauteurSousPlafond;
  const pente = (p.pente * Math.PI) / 180;
  const h = p.toiture === "plate" ? 0 : hz * Math.tan(pente);
  const mitoyennes = facadesMitoyennes(p.mitoyens);
  const zones: Zone[] = [];

  // Murs, ouvertures et pignons.
  for (const f of FACADES) {
    const frame = facadeFrame(f, hx, hz);
    const lf = longueurFacade(p, f);
    const ouv = ouvertures(p, f);
    zones.push({
      id: `mur-${f}`,
      kind: "mur",
      label: `Mur ${LABEL_FACADE[f]}`,
      facade: f,
      mitoyen: mitoyennes.includes(f),
      ...frame,
      outline: rect(0, 0, lf, H),
      holes: ouv.map((o) => o.rect),
    });
    for (const o of ouv) {
      zones.push({ id: o.id, kind: o.kind, label: o.label, facade: f, ...frame, outline: o.rect, holes: [] });
    }
    if (p.toiture === "deux-pans" && (f === "est" || f === "ouest")) {
      zones.push({
        id: `pignon-${f}`,
        kind: "pignon",
        label: `Pignon ${LABEL_FACADE[f]}`,
        facade: f,
        mitoyen: mitoyennes.includes(f),
        ...frame,
        outline: [
          [0, H],
          [lf, H],
          [lf / 2, H + h],
        ],
        holes: [],
      });
    }
  }

  // Toiture.
  const horizontal = (id: string, kind: ZoneKind, label: string, y: number, vers: "haut" | "bas"): Zone => ({
    id,
    kind,
    label,
    origin: vers === "haut" ? [-hx, y, hz] : [-hx, y, -hz],
    u: [1, 0, 0],
    // u × v doit pointer vers le haut (toiture) ou vers le bas (plancher bas).
    v: vers === "haut" ? [0, 0, -1] : [0, 0, 1],
    outline: rect(0, 0, p.longueur, p.largeur),
    holes: [],
  });

  if (p.toiture === "plate") {
    zones.push(horizontal("toiture-terrasse", "toiture-terrasse", "Toiture-terrasse", H, "haut"));
  } else {
    const r = Math.hypot(hz, h); // longueur de rampant, de l'égout au faîtage
    const inset = p.toiture === "quatre-pans" ? hz : 0; // retrait du faîtage aux extrémités
    const ridge = p.longueur - 2 * inset;
    // Pans sud et nord : de l'égout vers le faîtage (z = 0).
    for (const f of ["sud", "nord"] as const) {
      const s = f === "sud" ? 1 : -1;
      zones.push({
        id: `rampant-${f}`,
        kind: "rampant",
        label: `Pan de toiture ${LABEL_FACADE[f]}`,
        facade: f,
        origin: [-s * hx, H, s * hz],
        u: [s, 0, 0],
        v: norm(sub([0, H + h, 0], [0, H, s * hz])),
        outline: dedupe([
          [0, 0],
          [p.longueur, 0],
          [inset + ridge, r],
          [inset, r],
        ]),
        holes: [],
      });
    }
    // Croupes est et ouest des toitures 4 pans.
    if (p.toiture === "quatre-pans") {
      for (const f of ["est", "ouest"] as const) {
        const s = f === "est" ? 1 : -1;
        zones.push({
          id: `rampant-${f}`,
          kind: "rampant",
          label: `Croupe ${LABEL_FACADE[f]}`,
          facade: f,
          origin: [s * hx, H, s * hz],
          u: [0, 0, -s],
          v: norm([-s * hz, h, 0]),
          outline: [
            [0, 0],
            [p.largeur, 0],
            [p.largeur / 2, r],
          ],
          holes: [],
        });
      }
    }
    zones.push(horizontal("plancher-combles", "plancher-combles", "Plancher des combles", H, "haut"));
  }

  zones.push(horizontal("plancher-bas", "plancher-bas", "Plancher bas", 0, "bas"));

  return { params: p, hauteurMurs: H, hauteurToit: h, zones };
}

/**
 * Emplacement de l'unité extérieure de PAC : sur un pignon plutôt que sur la façade
 * d'entrée (sud), donc la première façade non mitoyenne parmi est, ouest, nord, sud,
 * à 1,2 m de l'angle droit vu de l'extérieur.
 */
export function emplacementPac(p: HouseParams): { facade: Facade; position: Vec3; rotationY: number } {
  const mitoyennes = facadesMitoyennes(p.mitoyens);
  const f = (["est", "ouest", "nord", "sud"] as const).find((x) => !mitoyennes.includes(x)) ?? "nord";
  const frame = facadeFrame(f, p.longueur / 2, p.largeur / 2);
  const n = normalOf(frame);
  const base = toWorld(frame, [longueurFacade(p, f) - 1.2, 0]);
  return {
    facade: f,
    position: [base[0] + 0.5 * n[0], 0, base[2] + 0.5 * n[2]],
    rotationY: Math.atan2(n[0], n[2]),
  };
}

/**
 * Direction de caméra (non normalisée, depuis le centre de la maison) qui montre
 * une façade de trois quarts, avec un peu de la façade voisine pour garder le contexte.
 */
export function directionVue(f: Facade): Vec3 {
  switch (f) {
    case "est":
      return [0.85, 0.45, 0.55];
    case "ouest":
      return [-0.85, 0.45, 0.55];
    case "nord":
      return [0.55, 0.45, -0.85];
    case "sud":
      return [0.55, 0.42, 0.72];
  }
}
