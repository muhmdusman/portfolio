import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
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
import { fabricTexture, floorTexture, glowTexture, plasterTexture, woodGrainTexture } from "./textures";

/** Brand palette shared by the 3D scene and the UI. */
export const palette = {
  night: "#040c16",
  brand: "#0788ff",
  brandSoft: "#49b3ff",
  violet: "#8b5cf6",
  warm: "#ffb36b",
  cream: "#ece6da",
  wall: "#1a2946",
};

export type Materials = ReturnType<typeof createMaterials>;

export function createMaterials() {
  const std = (color: string, roughness = 0.8, metalness = 0, extra: MeshStandardMaterialParameters = {}) =>
    new MeshStandardMaterial({ color, roughness, metalness, ...extra });

  const floorMap = floorTexture();
  floorMap.repeat.set(2, 2);
  const wallMap = plasterTexture();
  wallMap.repeat.set(2.2, 1.6);
  const woodMap = woodGrainTexture();
  woodMap.repeat.set(1.4, 1.4);
  const clothMap = fabricTexture();
  clothMap.repeat.set(4, 4);

  return {
    wall: std("#ffffff", 0.97, 0, { map: wallMap }),
    floor: std("#ffffff", 0.86, 0, { map: floorMap }),
    trim: std("#243656", 0.84),
    wood: std("#ffffff", 0.58, 0.02, { map: woodMap }),
    woodDark: std("#4e3424", 0.72),
    frame: std("#e4dccb", 0.72),
    metalDark: std("#1a1e26", 0.46, 0.72),
    metal: std("#b7bec9", 0.28, 0.86),
    plasticDark: std("#14181f", 0.55),
    plasticLight: std("#ded6c8", 0.5),
    keycap: std("#f3efe6", 0.48),
    deskMat: std("#121820", 0.96),
    accent: std(palette.brand, 0.45),
    orange: std("#e07a32", 0.55),
    fabric: std("#2c3548", 0.94, 0, { map: clothMap }),
    fabricAccent: std("#cbbfa6", 0.9),
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
