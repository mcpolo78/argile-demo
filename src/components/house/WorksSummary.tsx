"use client";

import { TRANCHES, TRANCHE_LABELS, type Tranche } from "@/lib/estimate/bareme";
import type { Estimation } from "@/lib/estimate/estimate";
import { WORK_COLORS, WORK_LABELS, availableWorks, workQuantity, type WorkId } from "@/lib/estimate/works";
import { formatEuros, formatM2 } from "@/lib/format";
import type { HouseParams } from "@/lib/house/params";
import type { Surfaces } from "@/lib/house/surfaces";

interface Props {
  params: HouseParams;
  surfaces: Surfaces;
  works: ReadonlySet<WorkId>;
  tranche: Tranche;
  estimation: Estimation;
  onToggleWork: (w: WorkId) => void;
  onTranche: (t: Tranche) => void;
}

export default function WorksSummary({ params, surfaces, works, tranche, estimation: e, onToggleWork, onTranche }: Props) {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Travaux</h2>
        <p className="mb-2 text-xs text-muted">Cliquez sur la maison ou cochez ci-dessous.</p>
        <ul className="space-y-1">
          {availableWorks(params).map((w) => {
            const q = workQuantity(w, surfaces, params);
            const unite = w === "menuiseries" ? `${q} fenêtre${q > 1 ? "s" : ""}` : w.startsWith("pac") || w.startsWith("ballon") ? "" : formatM2(q);
            return (
              <li key={w}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-border/40">
                  <input type="checkbox" checked={works.has(w)} onChange={() => onToggleWork(w)} className="accent-accent" />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: WORK_COLORS[w] }} />
                  <span className="flex-1">{WORK_LABELS[w]}</span>
                  <span className="tabular-nums text-xs text-muted">{unite}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Revenus du foyer</h2>
        <select
          value={tranche}
          onChange={(ev) => onTranche(ev.target.value as Tranche)}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          {TRANCHES.map((t) => (
            <option key={t} value={t}>
              {TRANCHE_LABELS[t]}
            </option>
          ))}
        </select>
      </section>

      <section className="rounded-lg border border-border bg-background p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Estimation indicative</h2>
        {e.lignes.length === 0 ? (
          <p className="text-sm text-muted">Aucun poste sélectionné.</p>
        ) : (
          <dl className="space-y-1 text-sm">
            <Row label="Coût des travaux" value={formatEuros(e.totalCout)} />
            <Row label="MaPrimeRénov'" value={`− ${formatEuros(e.totalMpr)}`} />
            <Row label="Primes CEE" value={`− ${formatEuros(e.totalCee)}`} />
            {e.ecretement > 0 && <Row label="dont écrêtement" value={formatEuros(e.ecretement)} muted />}
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>Reste à charge</dt>
              <dd className="tabular-nums">{formatEuros(e.resteACharge)}</dd>
            </div>
          </dl>
        )}
        <p className="mt-2 text-[11px] leading-snug text-muted">
          Barème de démonstration, non contractuel. Les surfaces sont celles de la maquette.
        </p>
      </section>

      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">Métré</summary>
        <dl className="mt-2 space-y-1">
          <Row label="Emprise au sol" value={formatM2(surfaces.emprise)} />
          <Row label="Murs bruts" value={formatM2(surfaces.mursBruts)} />
          <Row label="Murs mitoyens" value={formatM2(surfaces.mursMitoyens)} />
          <Row label="Ouvertures" value={formatM2(surfaces.ouvertures)} />
          <Row label="Murs nets" value={formatM2(surfaces.mursNets)} />
          {surfaces.pignons > 0 && <Row label="Pignons" value={formatM2(surfaces.pignons)} />}
          {surfaces.rampants > 0 && <Row label="Rampants" value={formatM2(surfaces.rampants)} />}
          {surfaces.plancherCombles > 0 && <Row label="Plancher des combles" value={formatM2(surfaces.plancherCombles)} />}
          {surfaces.toitureTerrasse > 0 && <Row label="Toiture-terrasse" value={formatM2(surfaces.toitureTerrasse)} />}
          <Row label="Plancher bas" value={formatM2(surfaces.plancherBas)} />
        </dl>
      </details>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-xs text-muted" : ""}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
