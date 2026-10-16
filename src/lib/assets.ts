/**
 * Modèles 3D d'équipements (générés avec Tripo3D, remis à l'échelle dans Blender,
 * compressés en meshopt). `null` tant que l'asset n'est pas dans public/models :
 * la scène affiche alors un volume simplifié aux bonnes dimensions.
 */
export const MODELS: { pac: string | null } = {
  pac: null,
};

/** Encombrement réel de l'unité extérieure de PAC (m) : largeur, hauteur, profondeur. */
export const PAC_DIMENSIONS = [1.0, 0.8, 0.4] as const;
