/**
 * Modèles 3D d'équipements (générés avec Tripo3D, remis à l'échelle dans Blender,
 * compressés en meshopt). `null` tant que l'asset n'est pas dans public/models :
 * la scène affiche alors un volume simplifié aux bonnes dimensions.
 */
export const MODELS: { pac: string | null } = {
  pac: "/models/pac.glb",
};

/**
 * Encombrement de l'unité extérieure de PAC (m) : largeur, hauteur, profondeur.
 * Ce sont les dimensions du modèle après normalisation dans Blender
 * (blender/normalize_asset.py --width 1.0), reprises par le volume de secours.
 */
export const PAC_DIMENSIONS = [1.0, 0.67, 0.49] as const;
