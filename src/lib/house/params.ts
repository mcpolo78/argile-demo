import { z } from "zod";

export const FACADES = ["nord", "sud", "est", "ouest"] as const;
export type Facade = (typeof FACADES)[number];

/** Dimensions fixes des menuiseries (m). */
export const OUVERTURES = {
  fenetre: { largeur: 1.2, hauteur: 1.35, allege: 0.9 },
  porte: { largeur: 0.9, hauteur: 2.15 },
  /** Trumeau minimal entre deux ouvertures ou entre une ouverture et un angle. */
  espaceMin: 0.3,
} as const;

/** Façades mitoyennes selon le nombre de murs mitoyens : les pignons d'abord. */
export function facadesMitoyennes(mitoyens: number): Facade[] {
  return (["est", "ouest"] as const).slice(0, mitoyens);
}

/** Longueur d'une façade : le faîtage est parallèle à la longueur (axe x). */
export function longueurFacade(p: Pick<HouseParams, "longueur" | "largeur">, f: Facade) {
  return f === "nord" || f === "sud" ? p.longueur : p.largeur;
}

const fenetres = z.object({
  nord: z.number().int().min(0).max(8),
  sud: z.number().int().min(0).max(8),
  est: z.number().int().min(0).max(8),
  ouest: z.number().int().min(0).max(8),
});

export const houseParamsSchema = z
  .object({
    longueur: z.number().min(4).max(25),
    largeur: z.number().min(4).max(15),
    niveaux: z.number().int().min(1).max(3),
    hauteurSousPlafond: z.number().min(2.3).max(3.5),
    toiture: z.enum(["deux-pans", "quatre-pans", "plate"]),
    /** Pente des pans en degrés, ignorée pour une toiture plate. */
    pente: z.number().min(15).max(60),
    combles: z.enum(["perdus", "amenages"]),
    plancherBas: z.enum(["terre-plein", "vide-sanitaire", "sous-sol"]),
    mitoyens: z.number().int().min(0).max(2),
    /** Nombre de fenêtres par niveau et par façade. */
    fenetresParNiveau: fenetres,
  })
  .superRefine((p, ctx) => {
    if (p.largeur > p.longueur) {
      ctx.addIssue({
        code: "custom",
        path: ["largeur"],
        message: "La largeur ne peut pas dépasser la longueur (le faîtage suit la longueur).",
      });
    }
    if (p.toiture === "plate" && p.combles === "amenages") {
      ctx.addIssue({
        code: "custom",
        path: ["combles"],
        message: "Pas de combles aménagés sous une toiture plate.",
      });
    }
    const { fenetre, porte, espaceMin } = OUVERTURES;
    if (fenetre.allege + fenetre.hauteur > p.hauteurSousPlafond - 0.1) {
      ctx.addIssue({
        code: "custom",
        path: ["hauteurSousPlafond"],
        message: "Hauteur sous plafond insuffisante pour les fenêtres.",
      });
    }
    const mitoyennes = facadesMitoyennes(p.mitoyens);
    for (const f of FACADES) {
      const n = p.fenetresParNiveau[f];
      if (mitoyennes.includes(f) && n > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["fenetresParNiveau", f],
          message: `La façade ${f} est mitoyenne : pas de fenêtre possible.`,
        });
        continue;
      }
      // Le rez-de-chaussée sud porte aussi la porte d'entrée : c'est le cas le plus chargé.
      const largeurs = n * fenetre.largeur + (f === "sud" ? porte.largeur : 0);
      const slots = n + (f === "sud" ? 1 : 0);
      if (largeurs + (slots + 1) * espaceMin > longueurFacade(p, f)) {
        ctx.addIssue({
          code: "custom",
          path: ["fenetresParNiveau", f],
          message: `Trop d'ouvertures pour la façade ${f}.`,
        });
      }
    }
  });

export type HouseParams = z.infer<typeof houseParamsSchema>;

export const DEFAULT_PARAMS: HouseParams = {
  longueur: 11,
  largeur: 8,
  niveaux: 1,
  hauteurSousPlafond: 2.5,
  toiture: "deux-pans",
  pente: 35,
  combles: "perdus",
  plancherBas: "vide-sanitaire",
  mitoyens: 0,
  fenetresParNiveau: { nord: 2, sud: 3, est: 1, ouest: 1 },
};
