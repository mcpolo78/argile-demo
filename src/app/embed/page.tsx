import Configurator from "@/components/house/Configurator";
import { getBareme } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function EmbedPage() {
  const bareme = await getBareme();
  return (
    <main className="p-3">
      <h1 className="mb-3 text-base font-semibold">Estimez vos travaux de rénovation</h1>
      <Configurator bareme={bareme} variant="embed" />
    </main>
  );
}
