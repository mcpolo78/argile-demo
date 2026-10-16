"use client";

import { FACADES, type Facade, type HouseParams } from "@/lib/house/params";

interface Props {
  params: HouseParams;
  errors: Record<string, string>;
  onChange: (next: HouseParams) => void;
}

export default function ParamsPanel({ params: p, errors, onChange }: Props) {
  const set = <K extends keyof HouseParams>(k: K, v: HouseParams[K]) => onChange({ ...p, [k]: v });
  const setFenetres = (f: Facade, n: number) =>
    onChange({ ...p, fenetresParNiveau: { ...p.fenetresParNiveau, [f]: Math.max(0, Math.min(8, n)) } });

  return (
    <div className="space-y-5">
      <Section titre="Volume">
        <Slider label="Longueur" unit="m" min={4} max={25} step={0.5} value={p.longueur} onChange={(v) => set("longueur", v)} error={errors.longueur} />
        <Slider label="Largeur" unit="m" min={4} max={15} step={0.5} value={p.largeur} onChange={(v) => set("largeur", v)} error={errors.largeur} />
        <Slider label="Niveaux" min={1} max={3} step={1} value={p.niveaux} onChange={(v) => set("niveaux", v)} />
        <Slider
          label="Hauteur sous plafond"
          unit="m"
          min={2.3}
          max={3.5}
          step={0.05}
          value={p.hauteurSousPlafond}
          onChange={(v) => set("hauteurSousPlafond", v)}
          error={errors.hauteurSousPlafond}
        />
      </Section>

      <Section titre="Toiture">
        <Segmented
          value={p.toiture}
          options={[
            ["deux-pans", "2 pans"],
            ["quatre-pans", "4 pans"],
            ["plate", "Plate"],
          ]}
          onChange={(v) => onChange({ ...p, toiture: v, combles: v === "plate" ? "perdus" : p.combles })}
        />
        {p.toiture !== "plate" && (
          <>
            <Slider label="Pente" unit="°" min={15} max={60} step={1} value={p.pente} onChange={(v) => set("pente", v)} />
            <Segmented
              value={p.combles}
              options={[
                ["perdus", "Combles perdus"],
                ["amenages", "Combles aménagés"],
              ]}
              onChange={(v) => set("combles", v)}
            />
          </>
        )}
        <Error msg={errors.combles} />
      </Section>

      <Section titre="Plancher bas">
        <Segmented
          value={p.plancherBas}
          options={[
            ["terre-plein", "Terre-plein"],
            ["vide-sanitaire", "Vide sanitaire"],
            ["sous-sol", "Sous-sol"],
          ]}
          onChange={(v) => set("plancherBas", v)}
        />
      </Section>

      <Section titre="Mitoyenneté">
        <Segmented
          value={String(p.mitoyens)}
          options={[
            ["0", "Isolée"],
            ["1", "1 mur (est)"],
            ["2", "2 murs"],
          ]}
          onChange={(v) => {
            const mitoyens = Number(v);
            // Une façade mitoyenne n'a pas de fenêtre : on les retire plutôt que de bloquer.
            const f = { ...p.fenetresParNiveau };
            if (mitoyens >= 1) f.est = 0;
            if (mitoyens >= 2) f.ouest = 0;
            onChange({ ...p, mitoyens, fenetresParNiveau: f });
          }}
        />
      </Section>

      <Section titre="Fenêtres par niveau">
        <div className="grid grid-cols-2 gap-2">
          {FACADES.map((f) => {
            const mitoyen = (f === "est" && p.mitoyens >= 1) || (f === "ouest" && p.mitoyens >= 2);
            return (
              <div key={f} className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1">
                <span className="text-sm capitalize">{f}</span>
                <div className="flex items-center gap-1">
                  <StepButton disabled={mitoyen || p.fenetresParNiveau[f] === 0} onClick={() => setFenetres(f, p.fenetresParNiveau[f] - 1)}>
                    −
                  </StepButton>
                  <span className="w-5 text-center text-sm tabular-nums">{p.fenetresParNiveau[f]}</span>
                  <StepButton disabled={mitoyen} onClick={() => setFenetres(f, p.fenetresParNiveau[f] + 1)}>
                    +
                  </StepButton>
                </div>
              </div>
            );
          })}
        </div>
        {FACADES.map((f) => (
          <Error key={f} msg={errors[`fenetresParNiveau.${f}`]} />
        ))}
      </Section>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{titre}</legend>
      {children}
    </fieldset>
  );
}

function Slider(props: {
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  error?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm">
        <span>{props.label}</span>
        <span className="tabular-nums text-muted">
          {props.value.toLocaleString("fr-FR")}
          {props.unit && ` ${props.unit}`}
        </span>
      </div>
      <input
        type="range"
        className="w-full"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      <Error msg={props.error} />
    </label>
  );
}

function Segmented<T extends string>(props: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-md border border-border bg-background p-0.5">
      {props.options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => props.onChange(v)}
          className={`flex-1 rounded px-2 py-1 text-xs transition ${
            props.value === v ? "bg-accent text-white shadow-sm" : "text-foreground hover:bg-border/60"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StepButton(props: { disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className="h-6 w-6 rounded border border-border text-sm leading-none hover:bg-border/60 disabled:opacity-30"
    >
      {props.children}
    </button>
  );
}

function Error({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-xs text-red-700">{msg}</p> : null;
}
