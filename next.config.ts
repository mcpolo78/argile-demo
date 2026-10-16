import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite charge un binaire WASM : on le laisse hors du bundle serveur.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    // La page /embed est faite pour être intégrée en iframe sur le site d'un artisan.
    return [{ source: "/embed", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] }];
  },
};

export default nextConfig;
