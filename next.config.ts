import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite charge un binaire WASM : on le laisse hors du bundle serveur.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Pas de badge de dev par-dessus la démo (captures d'écran, iframe).
  devIndicators: false,
  async headers() {
    // La page /embed est faite pour être intégrée en iframe sur le site d'un artisan.
    return [{ source: "/embed", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] }];
  },
};

export default nextConfig;
