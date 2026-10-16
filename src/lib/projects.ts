import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { bareme, projects } from "@/db/schema";
import { fromRow } from "@/db/seed";
import { TRANCHES, type BaremeLigne } from "@/lib/estimate/bareme";
import { estimate } from "@/lib/estimate/estimate";
import { WORK_IDS } from "@/lib/estimate/works";
import { buildHouse } from "@/lib/house/geometry";
import { houseParamsSchema } from "@/lib/house/params";
import { computeSurfaces } from "@/lib/house/surfaces";

export const projectInputSchema = z.object({
  params: houseParamsSchema,
  works: z.array(z.enum(WORK_IDS)).max(WORK_IDS.length),
  tranche: z.enum(TRANCHES),
});
export type ProjectInput = z.infer<typeof projectInputSchema>;

export async function getBareme(): Promise<BaremeLigne[]> {
  const db = await getDb();
  const rows = await db.select().from(bareme);
  return rows.map(fromRow);
}

/** Valide l'entrée et recalcule surfaces et estimation côté serveur : on ne fait pas confiance au client. */
export async function createProject(input: unknown): Promise<string> {
  const { params, works, tranche } = projectInputSchema.parse(input);
  const surfaces = computeSurfaces(buildHouse(params));
  const estimation = estimate(works, surfaces, params, await getBareme(), tranche);
  const db = await getDb();
  const [row] = await db
    .insert(projects)
    .values({ params, works: estimation.lignes.map((l) => l.workId), tranche, surfaces, estimation })
    .returning({ id: projects.id });
  return row.id;
}

export async function getProject(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const db = await getDb();
  const [row] = await db.select().from(projects).where(eq(projects.id, id));
  return row ?? null;
}
