"use client";

import { Edges, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { MODELS, PAC_DIMENSIONS } from "@/lib/assets";
import { WORK_COLORS, WORK_LABELS, workForZone, type WorkId } from "@/lib/estimate/works";
import { directionVue, emplacementPac, normalOf, type House, type Zone, type ZoneKind } from "@/lib/house/geometry";
import type { Surfaces } from "@/lib/house/surfaces";
import { formatM2 } from "@/lib/format";

/** Hauteur du soubassement : la maison est posée dessus, et c'est lui qu'on clique pour le plancher bas. */
const SOCLE = 0.3;

const BASE_COLORS: Record<ZoneKind, string> = {
  mur: "#efe7da",
  pignon: "#e9e0d1",
  rampant: "#a5533a",
  "toiture-terrasse": "#8a8a85",
  "plancher-combles": "#d8cbb4",
  "plancher-bas": "#cfc6b8",
  fenetre: "#9ccbe0",
  porte: "#6e4b33",
};
const MITOYEN = "#bdb6ab";

function zoneGeometry(z: Zone): THREE.BufferGeometry {
  const shape = new THREE.Shape(z.outline.map(([x, y]) => new THREE.Vector2(x, y)));
  shape.holes = z.holes.map((h) => new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ShapeGeometry(shape);
  const basis = new THREE.Matrix4()
    .makeBasis(new THREE.Vector3(...z.u), new THREE.Vector3(...z.v), new THREE.Vector3(...normalOf(z)))
    .setPosition(...z.origin);
  g.applyMatrix4(basis);
  return g;
}

interface Props {
  house: House;
  surfaces: Surfaces;
  works: ReadonlySet<WorkId>;
  onToggleWork?: (w: WorkId) => void;
  /** Rempli par la scène : renvoie une capture PNG (data URL) de la vue courante. */
  snapshotRef?: { current: (() => string) | null };
}

export default function HouseScene(props: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const hovered = props.house.zones.find((z) => z.id === hoverId);
  const hoveredWork = hovered ? workForZone(hovered, props.house.params) : null;
  return (
    <div className="relative h-full w-full" onPointerLeave={() => setHoverId(null)}>
      <Canvas shadows camera={{ fov: 40 }} dpr={[1, 2]} className="touch-none">
        <color attach="background" args={["#e9eef0"]} />
        <hemisphereLight args={["#ffffff", "#b9c4a8", 1.1]} />
        <directionalLight
          position={[12, 18, 10]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <CameraRig house={props.house} pacOn={props.works.has("pac-air-eau")} />
        {props.snapshotRef && <Snapshot target={props.snapshotRef} />}
        <SceneContent {...props} hoverId={hoverId} setHoverId={setHoverId} />
        <OrbitControls
          makeDefault
          target={[0, SOCLE + props.house.hauteurMurs / 2, 0]}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={5}
          maxDistance={60}
        />
      </Canvas>
      {/* Carte fixe plutôt qu'une infobulle qui suit la souris : jamais coupée par le bord du canvas. */}
      <div className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-md bg-foreground/90 px-3 py-2 text-xs text-white shadow-lg">
        {hovered ? (
          <>
            <div className="font-medium">
              {hovered.label} · {formatM2(props.surfaces.parZone[hovered.id])}
            </div>
            <div className="opacity-80">
              {hoveredWork
                ? `${props.works.has(hoveredWork) ? "Clic pour retirer" : "Clic pour ajouter"} : ${WORK_LABELS[hoveredWork].toLowerCase()}`
                : "Pas de travaux associés"}
            </div>
          </>
        ) : (
          <div className="opacity-80">Survolez la maison · glisser pour tourner · molette pour zoomer</div>
        )}
      </div>
    </div>
  );
}

/**
 * Capture à la demande : on rend une image puis on lit le canvas dans la même tâche,
 * avant que le navigateur ne vide le tampon (pas besoin de preserveDrawingBuffer).
 */
function Snapshot({ target }: { target: { current: (() => string) | null } }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    target.current = () => {
      gl.render(scene, camera);
      return gl.domElement.toDataURL("image/png");
    };
    return () => {
      target.current = null;
    };
  }, [gl, scene, camera, target]);
  return null;
}

interface ControlsLike {
  target: THREE.Vector3;
  update(): void;
  addEventListener(type: "start", fn: () => void): void;
  removeEventListener(type: "start", fn: () => void): void;
}

const vec = (v: readonly [number, number, number]) => new THREE.Vector3(v[0], v[1], v[2]);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Cadre la maison entière quel que soit le format du canvas (portrait sur mobile),
 * du côté de la PAC si elle est sélectionnée. Recalculé au montage et au
 * redimensionnement, pas quand les paramètres changent : l'utilisateur garde son point de vue.
 * Exception : cocher la PAC fait pivoter la caméra jusqu'à la façade qui la porte.
 */
function CameraRig({ house, pacOn }: { house: House; pacOn: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const [initial] = useState(() => ({ house, pacOn }));
  const pacFacade = emplacementPac(house.params).facade;

  useEffect(() => {
    const { longueur, largeur } = initial.house.params;
    const rayon = 0.5 * Math.hypot(longueur, largeur, initial.house.hauteurMurs + initial.house.hauteurToit + SOCLE) + 1.5;
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
    const distance = rayon / Math.sin(Math.min(vfov, hfov) / 2);
    const facade = initial.pacOn ? emplacementPac(initial.house.params).facade : "sud";
    const dir = vec(directionVue(facade)).normalize();
    const target = new THREE.Vector3(0, SOCLE + initial.house.hauteurMurs / 2, 0);
    camera.position.copy(target).addScaledVector(dir, distance);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, initial]);

  // Pivot animé vers la PAC quand elle passe de décochée à cochée.
  const anim = useRef<{ from: THREE.Spherical; to: THREE.Spherical; t: number } | null>(null);
  const prev = useRef(pacOn);
  useEffect(() => {
    if (pacOn && !prev.current && controls) {
      const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      const to = new THREE.Spherical().setFromVector3(vec(directionVue(pacFacade)).normalize());
      to.radius = from.radius;
      // Plus court chemin autour de la maison.
      let dTheta = to.theta - from.theta;
      dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
      to.theta = from.theta + dTheta;
      anim.current = { from, to, t: 0 };
    }
    prev.current = pacOn;
  }, [pacOn, pacFacade, camera, controls]);

  // Si l'utilisateur reprend la main pendant le pivot, on le laisse faire.
  useEffect(() => {
    if (!controls) return;
    const stop = () => (anim.current = null);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 0.9);
    const k = easeInOut(a.t);
    const s = new THREE.Spherical(
      a.from.radius,
      THREE.MathUtils.lerp(a.from.phi, a.to.phi, k),
      THREE.MathUtils.lerp(a.from.theta, a.to.theta, k),
    );
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
    camera.lookAt(controls.target);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

function SceneContent({
  house,
  works,
  onToggleWork,
  hoverId,
  setHoverId,
}: Props & { hoverId: string | null; setHoverId: (id: string | null) => void }) {
  const p = house.params;
  const zonesById = useMemo(() => new Map(house.zones.map((z) => [z.id, z])), [house]);
  const hovered = hoverId ? zonesById.get(hoverId) : undefined;
  const hoveredWork = hovered ? workForZone(hovered, p) : null;

  const handlers = (z: Zone) => ({
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (hoverId !== z.id) setHoverId(z.id);
    },
    onPointerOut: () => {
      if (hoverId === z.id) setHoverId(null);
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const w = workForZone(z, p);
      if (w && onToggleWork) onToggleWork(w);
    },
  });

  const colorOf = (z: Zone) => {
    const w = workForZone(z, p);
    const base = z.mitoyen ? MITOYEN : BASE_COLORS[z.kind];
    if (!w || !works.has(w)) return base;
    // Teinte du poste mêlée au matériau : on reconnaît encore le toit ou l'enduit.
    return "#" + new THREE.Color(base).lerp(new THREE.Color(WORK_COLORS[w]), 0.6).getHexString();
  };

  const plancherBas = zonesById.get("plancher-bas")!;
  const pac = emplacementPac(p);

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[45, 64]} />
        <meshStandardMaterial color="#c9d6b8" />
      </mesh>

      {/* Soubassement : proxy cliquable du plancher bas. */}
      <mesh position={[0, SOCLE / 2, 0]} castShadow receiveShadow {...handlers(plancherBas)}>
        <boxGeometry args={[p.longueur, SOCLE, p.largeur]} />
        <meshStandardMaterial
          color={colorOf(plancherBas)}
          emissive={colorOf(plancherBas)}
          emissiveIntensity={hoverId === "plancher-bas" ? 0.35 : 0}
        />
        <Edges color="#7a6f60" />
      </mesh>

      <group position-y={SOCLE}>
        {house.zones
          // Le plancher des combles est caché sous la toiture : on clique les pans à la place.
          .filter((z) => z.kind !== "plancher-bas" && z.kind !== "plancher-combles")
          .map((z) => (
            <ZoneMesh key={z.id} zone={z} color={colorOf(z)} highlighted={isHighlighted(z)} {...handlers(z)} />
          ))}
      </group>

      {works.has("pac-air-eau") && (
        <group position={[pac.position[0], pac.position[1], pac.position[2]]} rotation-y={pac.rotationY}>
          <Pac />
        </group>
      )}

    </>
  );

  function isHighlighted(z: Zone) {
    if (!hovered) return false;
    if (hovered.id === z.id) return true;
    // Survoler une zone met en évidence toutes celles du même poste.
    const w = workForZone(z, p);
    return w !== null && w === hoveredWork;
  }
}

function ZoneMesh({
  zone,
  color,
  highlighted,
  ...handlers
}: {
  zone: Zone;
  color: string;
  highlighted: boolean;
  onPointerMove: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut: () => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const geometry = useMemo(() => zoneGeometry(zone), [zone]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const verre = zone.kind === "fenetre";
  return (
    <mesh geometry={geometry} castShadow={!verre} receiveShadow {...handlers}>
      <meshStandardMaterial
        color={color}
        side={THREE.DoubleSide}
        roughness={verre ? 0.15 : 0.85}
        metalness={verre ? 0.2 : 0}
        emissive={color}
        emissiveIntensity={highlighted ? 0.35 : 0}
        polygonOffset
        polygonOffsetFactor={1}
      />
      <Edges color={verre ? "#5d7f8e" : "#7a6f60"} threshold={15} />
    </mesh>
  );
}

function Pac() {
  const fallback = <PacPlaceholder />;
  if (!MODELS.pac) return fallback;
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <PacModel url={MODELS.pac} />
      </Suspense>
    </ModelBoundary>
  );
}

function PacModel({ url }: { url: string }) {
  // Draco désactivé (décodeur sur CDN), meshopt activé (embarqué).
  const { scene } = useGLTF(url, false, true);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return c;
  }, [scene]);
  return <primitive object={clone} />;
}

/** Volume aux dimensions réelles d'une unité extérieure, en attendant le modèle Tripo3D. */
function PacPlaceholder() {
  const [w, h, d] = PAC_DIMENSIONS;
  return (
    <group>
      <mesh position-y={h / 2 + 0.1} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#f2f2f0" roughness={0.5} />
        <Edges color="#8d8d88" />
      </mesh>
      <mesh position={[-0.15, h / 2 + 0.1, d / 2 + 0.005]}>
        <circleGeometry args={[0.28, 40]} />
        <meshStandardMaterial color="#3b3f42" />
      </mesh>
      <mesh position-y={0.05}>
        <boxGeometry args={[w * 0.9, 0.1, d * 1.2]} />
        <meshStandardMaterial color="#555" />
      </mesh>
    </group>
  );
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

