import { headers } from "next/headers";
import Configurator from "@/components/house/Configurator";
import { getBareme } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function Home() {
  const bareme = await getBareme();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const snippet = `<iframe src="${origin}/embed" width="100%" height="760" style="border:0" loading="lazy"></iframe>`;

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-4">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Maquette 3D paramétrique</h1>
          <p className="text-sm text-muted">
            Décrivez la maison, cliquez les zones à rénover : surfaces et estimation des aides se mettent à jour.
          </p>
        </div>
        <span className="text-xs text-muted">Démo réalisée pour une candidature chez Argile</span>
      </header>

      <Configurator bareme={bareme} />

      <section className="mt-8 max-w-3xl rounded-xl border border-border bg-card p-4">
        <h2 className="mb-1 font-semibold">Intégrer le simulateur sur le site d&apos;un artisan</h2>
        <p className="mb-3 text-sm text-muted">
          La version compacte est servie sur <code>/embed</code> et accepte d&apos;être affichée en iframe.
        </p>
        <pre className="overflow-x-auto rounded-md bg-foreground p-3 text-xs text-white">{snippet}</pre>
      </section>
    </main>
  );
}
