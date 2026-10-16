"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState, useTransition } from "react";
import { saveProject } from "@/app/actions";
import type { BaremeLigne, Tranche } from "@/lib/estimate/bareme";
import { estimate } from "@/lib/estimate/estimate";
import { normalizeWorks, type WorkId } from "@/lib/estimate/works";
import { buildHouse } from "@/lib/house/geometry";
import { DEFAULT_PARAMS, houseParamsSchema, type HouseParams } from "@/lib/house/params";
import { computeSurfaces } from "@/lib/house/surfaces";
import { buildExportJson, exportFileName, type ExportInput } from "@/lib/export/export";
import { buildPdf, download, snapshotOf, type Snapshot } from "@/lib/export/pdf";
import ParamsPanel from "./ParamsPanel";
import WorksSummary from "./WorksSummary";

// three.js a besoin du DOM : la scène n'est rendue que côté client.
const HouseScene = dynamic(() => import("./HouseScene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Chargement de la maquette…</div>,
});

export interface ConfiguratorInitial {
  params: HouseParams;
  works: WorkId[];
  tranche: Tranche;
}

interface Props {
  bareme: BaremeLigne[];
  initial?: ConfiguratorInitial;
  variant?: "page" | "embed";
}

const DEFAULT_WORKS: WorkId[] = ["isolation-combles-perdus", "ite", "pac-air-eau"];

export default function Configurator({ bareme, initial, variant = "page" }: Props) {
  const [draft, setDraft] = useState<HouseParams>(initial?.params ?? DEFAULT_PARAMS);
  const [valid, setValid] = useState<HouseParams>(initial?.params ?? DEFAULT_PARAMS);
  const [works, setWorks] = useState<WorkId[]>(initial?.works ?? DEFAULT_WORKS);
  const [tranche, setTranche] = useState<Tranche>(initial?.tranche ?? "modeste");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  // Dernière estimation enregistrée et exportée ; effacée dès que l'utilisateur modifie quelque chose.
  const [exported, setExported] = useState<{ input: ExportInput; vue: Snapshot | null } | null>(null);
  const snapshotRef = useRef<(() => string) | null>(null);

  // Le brouillon suit les curseurs ; la maquette garde le dernier état valide.
  const onParams = (next: HouseParams) => {
    setDraft(next);
    setExported(null);
    const r = houseParamsSchema.safeParse(next);
    if (r.success) {
      setValid(r.data);
      setErrors({});
      setWorks((w) => normalizeWorks(w, r.data));
    } else {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message])));
    }
  };

  const house = useMemo(() => buildHouse(valid), [valid]);
  const surfaces = useMemo(() => computeSurfaces(house), [house]);
  const workSet = useMemo(() => new Set(works), [works]);
  const estimation = useMemo(
    () => estimate(works, surfaces, valid, bareme, tranche),
    [works, surfaces, valid, bareme, tranche],
  );

  const toggleWork = (w: WorkId) => {
    setExported(null);
    setWorks((cur) => normalizeWorks(cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w], valid));
  };

  const save = () =>
    startSaving(async () => {
      setSaveError(null);
      const r = await saveProject({ params: valid, works, tranche });
      if (!r.ok) return setSaveError(r.error);
      const input: ExportInput = {
        id: r.id,
        url: `${window.location.origin}/projets/${r.id}`,
        date: new Date(),
        params: valid,
        works,
        tranche,
        surfaces,
        estimation,
      };
      const shot = snapshotRef.current?.();
      const vue = shot ? await snapshotOf(shot) : null;
      setExported({ input, vue });
      download(await buildPdf(input, vue), exportFileName(r.id, "pdf"));
    });

  const exportPng = () => exported?.vue && download(exported.vue.dataUrl, exportFileName(exported.input.id, "png"));
  const exportJson = () =>
    exported &&
    download(
      new Blob([JSON.stringify(buildExportJson(exported.input), null, 2)], { type: "application/json" }),
      exportFileName(exported.input.id, "json"),
    );
  const exportPdf = async () =>
    exported && download(await buildPdf(exported.input, exported.vue), exportFileName(exported.input.id, "pdf"));

  const embed = variant === "embed";
  return (
    <div className={`grid gap-4 ${embed ? "lg:grid-cols-[260px_1fr_300px]" : "lg:grid-cols-[280px_1fr_320px]"}`}>
      <aside className="rounded-xl border border-border bg-card p-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <ParamsPanel params={draft} errors={errors} onChange={onParams} />
      </aside>

      <div className={`relative overflow-hidden rounded-xl border border-border bg-card ${embed ? "h-[55vh] lg:h-auto" : "h-[60vh] lg:h-[calc(100vh-7rem)]"}`}>
        <HouseScene house={house} surfaces={surfaces} works={workSet} onToggleWork={toggleWork} snapshotRef={snapshotRef} />
        {Object.keys(errors).length > 0 && (
          <div className="absolute left-3 top-3 rounded-md bg-amber-100 px-2 py-1 text-xs text-amber-900 shadow">
            Paramètres incohérents : la maquette affiche le dernier état valide.
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <WorksSummary
          params={valid}
          surfaces={surfaces}
          works={workSet}
          tranche={tranche}
          estimation={estimation}
          onToggleWork={toggleWork}
          onTranche={(t) => {
            setTranche(t);
            setExported(null);
          }}
        />
        <div className="mt-auto space-y-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || estimation.lignes.length === 0}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Préparation du PDF…" : "Télécharger mon estimation"}
          </button>
          {saveError && <p className="text-xs text-red-700">{saveError}</p>}
          {exported && (
            <div className="rounded-lg border border-border bg-background p-2.5 text-xs">
              <p className="mb-2">Estimation téléchargée en PDF. Autres formats :</p>
              <div className="flex flex-wrap gap-1.5">
                <ExportButton onClick={exportPdf}>PDF</ExportButton>
                {exported.vue && <ExportButton onClick={exportPng}>Image 3D</ExportButton>}
                <ExportButton onClick={exportJson}>Données JSON</ExportButton>
                <a
                  href={exported.input.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-border px-2 py-1 text-accent hover:bg-border/40"
                >
                  Lien du projet ↗
                </a>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ExportButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-border px-2 py-1 hover:bg-border/40">
      {children}
    </button>
  );
}
