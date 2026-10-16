import Link from "next/link";
import { notFound } from "next/navigation";
import Configurator from "@/components/house/Configurator";
import { formatEuros } from "@/lib/format";
import { getBareme, getProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, bareme] = await Promise.all([getProject(id), getBareme()]);
  if (!project) notFound();
  const e = project.estimation;

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-accent underline">
            ← Nouveau projet
          </Link>
          <h1 className="text-xl font-semibold">Projet enregistré</h1>
          <p className="text-sm text-muted">
            Le {project.createdAt.toLocaleDateString("fr-FR", { dateStyle: "long" })} · estimation figée à l&apos;enregistrement :{" "}
            {formatEuros(e.totalCout)} de travaux, {formatEuros(e.totalAides)} d&apos;aides,{" "}
            <strong className="text-foreground">{formatEuros(e.resteACharge)}</strong> de reste à charge.
          </p>
        </div>
      </header>
      <Configurator
        bareme={bareme}
        initial={{ params: project.params, works: project.works, tranche: project.tranche }}
      />
    </main>
  );
}
