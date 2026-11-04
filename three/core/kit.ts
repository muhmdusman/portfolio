import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
  Color,
  Group,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  type Object3D,
  PlaneGeometry,
  type Texture,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { floorTexture, glowTexture } from "./textures";

/** Brand palette shared by the 3D scene and the UI. */
export const palette = {
  night: "#040c16",
  brand: "#0788ff",
  brandSoft: "#49b3ff",
  violet: "#8b5cf6",
  warm: "#ffb36b",
  cream: "#ece6da",
  wall: "#1a2946",
  wallEdge: "#2f4a7c",
};

export type Materials = ReturnType<typeof createMaterials>;

export function createMaterials() {
  const std = (color: string, roughness = 0.8, metalness = 0, extra: MeshStandardMaterialParameters = {}) =>
    new MeshStandardMaterial({ color, roughness, metalness, ...extra });

  const floorMap = floorTexture();
  floorMap.repeat.set(2, 2);

  return {
    wall: std(palette.wall, 0.95),
    wallEdge: std(palette.wallEdge, 0.85),
    floor: std("#ffffff", 0.82, 0, { map: floorMap }),
    trim: std("#2a426e", 0.8),
    wood: std("#a86f45", 0.62),
    woodDark: std("#5e3d28", 0.7),
    frame: std(palette.cream, 0.7),
    metalDark: std("#171c27", 0.42, 0.65),
    metal: std("#a3acbd", 0.3, 0.9),
    plasticDark: std("#0f131b", 0.5),
    plasticLight: std(palette.cream, 0.55),
    keycap: std("#ffffff", 0.55),
    deskMat: std("#0d1830", 0.95),
    accent: std(palette.brand, 0.45),
    orange: std("#ff8a3d", 0.55),
    fabric: std("#222b3f", 0.95),
    fabricAccent: std(palette.brand, 0.9),
    leafA: std("#2e9b5f", 0.7),
    leafB: std("#3cbf73", 0.7),
    leafC: std("#1f7a48", 0.7),
    pot: std("#c9673e", 0.85),
    duck: std("#ffd23f", 0.45),
    black: std("#0a0c11", 0.45),
    glass: std("#1d3152", 0.08, 0.2, { transparent: true, opacity: 0.32, depthWrite: false }),
    paper: std("#f4f1ea", 0.9),
    neon: new MeshBasicMaterial({ color: palette.brandSoft, toneMapped: false }),
    bulb: new MeshBasicMaterial({ color: "#ffe2b8", toneMapped: false }),
    led: new MeshBasicMaterial({ color: "#5cff9d", toneMapped: false }),
    cloud: std("#5d6f98", 1, 0, { emissive: new Color("#1a2748"), emissiveIntensity: 0.75 }),
  };
}

let sharedGlow: Texture | null = null;
export function getGlowTexture() {
  sharedGlow ??= glowTexture();
  return sharedGlow;
}

/** Camera-independent additive glow card (cheap fake bloom). */
export function glowCard(color: string, width: number, height: number, opacity = 0.6) {
  const material = new MeshBasicMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new Mesh(new PlaneGeometry(width, height), material);
  mesh.renderOrder = 2;
  return mesh;
}

interface MeshOpts {
  cast?: boolean;
  receive?: boolean;
}

export function mesh(geometry: BufferGeometry, material: Material | Material[], opts: MeshOpts = {}) {
  const m = new Mesh(geometry, material);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  return m;
}

export function box(
  w: number,
  h: number,
  d: number,
  material: Material | Material[],
  x = 0,
  y = 0,
  z = 0,
  opts?: MeshOpts,
) {
  const m = mesh(new BoxGeometry(w, h, d), material, opts);
  m.position.set(x, y, z);
  return m;
}

export function rbox(
  w: number,
  h: number,
  d: number,
  radius: number,
  material: Material | Material[],
  x = 0,
  y = 0,
  z = 0,
  opts?: MeshOpts,
  segments = 4,
) {
  const m = mesh(new RoundedBoxGeometry(w, h, d, segments, radius), material, opts);
  m.position.set(x, y, z);
  return m;
}

export function group(name: string, ...children: Object3D[]) {
  const g = new Group();
  g.name = name;
  if (children.length) g.add(...children);
  return g;
}
