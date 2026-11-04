import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  Curve,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  type Group,
  InstancedBufferAttribute,
  InstancedMesh,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  Euler,
} from "three";
import { box, group, mesh, palette, type Materials } from "../core/kit";
import { createCanvas, textureQuality } from "../core/textures";

/**
 * A 75% mechanical keyboard: F-row, arrow cluster and a volume knob.
 *
 * - Keycaps are lofted from rounded rectangles: tapered sides, filleted top
 *   edge and a cylindrical dish. Rows have their own height and tilt
 *   (a sculpted "Cherry"-like profile).
 * - All 82 keycaps are one InstancedMesh. Wide keys are stretched in the
 *   vertex shader by moving the left and right halves apart, so their
 *   rounded edges keep the same shape ("nine-slice").
 * - Legends come from a canvas atlas and are printed in the fragment shader.
 * - Pressed keys sink and glow; an RGB backlight shows between the caps.
 */

const U = 0.04; // key pitch
const GAP = 0.0035; // space between neighbouring caps
const CAP_H = 0.0175;
const BASE_HALF = (U - GAP) / 2;
const TOP_INSET = 0.0046;
const DISH = 0.0011;
const FILLET = 0.0022;

type Kind = "alpha" | "mod" | "accent" | "esc";
interface KeyDef {
  code: string;
  w: number;
  kind: Kind;
  /** Main legend; `top` is the shifted symbol shown above it. */
  label: string;
  top?: string;
  /** Extra space before this key, in units. */
  gap?: number;
}

const k = (code: string, label: string, w = 1, kind: Kind = "alpha", top?: string, gap?: number): KeyDef => ({
  code,
  label,
  w,
  kind,
  top,
  gap,
});

const fRow: KeyDef[] = [
  k("Escape", "esc", 1, "esc"),
  ...Array.from({ length: 12 }, (_, i) => k(`F${i + 1}`, `F${i + 1}`, 1, "mod", undefined, i % 4 === 0 ? 0.25 : 0)),
  k("Delete", "del", 1, "mod", undefined, 0.25),
];

const symbols: Array<[string, string]> = [
  ["`", "~"], ["1", "!"], ["2", "@"], ["3", "#"], ["4", "$"], ["5", "%"], ["6", "^"],
  ["7", "&"], ["8", "*"], ["9", "("], ["0", ")"], ["-", "_"], ["=", "+"],
];

const ROWS: KeyDef[][] = [
  fRow,
  [...symbols.map(([c, t]) => k(c, c, 1, "alpha", t)), k("Backspace", "backspace", 2, "mod"), k("Home", "home", 1, "mod")],
  [
    k("Tab", "tab", 1.5, "mod"),
    ..."qwertyuiop".split("").map((c) => k(c, c.toUpperCase())),
    k("[", "[", 1, "alpha", "{"),
    k("]", "]", 1, "alpha", "}"),
    k("\\", "\\", 1.5, "alpha", "|"),
    k("PageUp", "pg up", 1, "mod"),
  ],
  [
    k("CapsLock", "caps lock", 1.75, "mod"),
    ..."asdfghjkl".split("").map((c) => k(c, c.toUpperCase())),
    k(";", ";", 1, "alpha", ":"),
    k("'", "'", 1, "alpha", '"'),
    k("Enter", "enter", 2.25, "accent"),
    k("PageDown", "pg dn", 1, "mod"),
  ],
  [
    k("Shift", "shift", 2.25, "mod"),
    ..."zxcvbnm".split("").map((c) => k(c, c.toUpperCase())),
    k(",", ",", 1, "alpha", "<"),
    k(".", ".", 1, "alpha", ">"),
    k("/", "/", 1, "alpha", "?"),
    k("ShiftRight", "shift", 1.75, "mod"),
    k("ArrowUp", "▲", 1, "mod"),
    k("End", "end", 1, "mod"),
  ],
  [
    k("Control", "ctrl", 1.25, "mod"),
    k("Meta", "win", 1.25, "mod"),
    k("Alt", "alt", 1.25, "mod"),
    k(" ", "", 6.25, "alpha"),
    k("AltRight", "alt", 1, "mod"),
    k("Fn", "fn", 1, "mod"),
    k("ControlRight", "ctrl", 1, "mod"),
    k("ArrowLeft", "◀", 1, "mod"),
    k("ArrowDown", "▼", 1, "mod"),
    k("ArrowRight", "▶", 1, "mod"),
  ],
];

/** Sculpted profile per row (back to front): cap height scale and top tilt. */
const ROW_HEIGHT = [1.08, 1.06, 0.99, 0.94, 0.98, 1.0];
const ROW_TILT = [0.17, 0.12, 0.06, 0.0, -0.05, -0.09];

const CAP_COLORS: Record<Kind, string> = {
  alpha: "#ece6da",
  mod: "#3d4b6c",
  accent: palette.brand,
  esc: "#ff8a3d",
};

const SHIFTED: Record<string, string> = Object.fromEntries(
  symbols.map(([c, t]) => [t, c]).concat([["{", "["], ["}", "]"], ["|", "\\"], [":", ";"], ['"', "'"], ["<", ","], [">", "."], ["?", "/"]]),
);

// ------------------------------------------------------------------ geometry

/**
 * Builds one 1u keycap. Each horizontal ring is a rounded rectangle sampled
 * with the same parameters, so rings connect vertex-to-vertex and the top
 * cap can be filled row by row (which gives the cylindrical dish).
 */
function keycapGeometry() {
  const m = 5; // points per corner arc
  const mid = 5; // points along the straight left/right sides
  // parametric samples for the right side, back (-z) to front (+z)
  type Sample = { corner: -1 | 0 | 1; a: number; f: number };
  const samples: Sample[] = [];
  for (let i = 0; i <= m; i++) samples.push({ corner: -1, a: -Math.PI / 2 + (i / m) * (Math.PI / 2), f: 0 });
  for (let i = 1; i <= mid; i++) samples.push({ corner: 0, a: 0, f: i / (mid + 1) });
  for (let i = 0; i <= m; i++) samples.push({ corner: 1, a: (i / m) * (Math.PI / 2), f: 0 });
  const P = samples.length;

  const pointAt = (s: Sample, halfW: number, halfD: number, r: number): [number, number] => {
    if (s.corner === 0) return [halfW, -(halfD - r) + s.f * 2 * (halfD - r)];
    const cz = s.corner * (halfD - r);
    return [halfW - r + r * Math.cos(s.a), cz + r * Math.sin(s.a)];
  };

  // side profile: [inset, y, cornerRadius, dishWeight]
  const sideTop = CAP_H - FILLET;
  const taperAt = (y: number) => (TOP_INSET - FILLET * 0.6) * (y / sideTop);
  const levels: Array<[number, number, number, number]> = [
    [0, 0, 0.0034, 0],
    [taperAt(0.003), 0.003, 0.0035, 0],
    [taperAt(sideTop * 0.55), sideTop * 0.55, 0.0039, 0],
    [taperAt(sideTop), sideTop, 0.0042, 0],
  ];
  const insetTop = taperAt(sideTop);
  for (let j = 1; j <= 4; j++) {
    const a = (j / 4) * (Math.PI / 2);
    levels.push([insetTop + FILLET * 0.6 * (1 - Math.cos(a)) + FILLET * 0.4 * (1 - Math.cos(a)), sideTop + FILLET * Math.sin(a), 0.0042 + 0.0008 * (j / 4), Math.sin(a)]);
  }

  const positions: number[] = [];
  const halfTopD = BASE_HALF - levels[levels.length - 1][0];
  for (const [inset, y, r, dishW] of levels) {
    const halfW = BASE_HALF - inset;
    const halfD = BASE_HALF - inset;
    const ring: Array<[number, number]> = [];
    for (const s of samples) ring.push(pointAt(s, halfW, halfD, r));
    // right side back->front, then the mirrored left side front->back
    const full = [...ring, ...ring.slice().reverse().map(([x, z]) => [-x, z] as [number, number])];
    for (const [x, z] of full) {
      const t = Math.min(1, Math.abs(z) / halfTopD);
      positions.push(x, y - DISH * (1 - t * t) * dishW, z);
    }
  }

  const index: number[] = [];
  const ringSize = 2 * P;
  for (let l = 0; l < levels.length - 1; l++) {
    const a0 = l * ringSize;
    const a1 = (l + 1) * ringSize;
    for (let i = 0; i < ringSize; i++) {
      const j = (i + 1) % ringSize;
      // outward-facing winding
      index.push(a0 + i, a1 + i, a1 + j, a0 + i, a1 + j, a0 + j);
    }
  }
  // top cap: one quad per row between the right point k and its mirror
  const top = (levels.length - 1) * ringSize;
  for (let kk = 0; kk < P - 1; kk++) {
    const R0 = top + kk;
    const R1 = top + kk + 1;
    const L0 = top + P + (P - 1 - kk);
    const L1 = top + P + (P - 2 - kk);
    index.push(R0, L0, R1, L0, L1, R1);
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** Height of the cap's top centre in local units (bottom of the dish). */
const TOP_Y = CAP_H - DISH;

function roundedRect(w: number, d: number, r: number) {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A coiled cable: a helix wound around a straight axis. */
class CoilCurve extends Curve<Vector3> {
  private readonly u = new Vector3();
  private readonly v = new Vector3();
  constructor(
    private readonly a: Vector3,
    private readonly b: Vector3,
    private readonly turns: number,
    private readonly radius: number,
  ) {
    super();
    const axis = new Vector3().subVectors(b, a).normalize();
    this.u.set(0, 1, 0).cross(axis).normalize();
    this.v.crossVectors(axis, this.u).normalize();
  }
  override getPoint(t: number, target = new Vector3()) {
    const ang = t * this.turns * Math.PI * 2;
    // taper the coil into the straight cable at both ends
    const ease = Math.min(1, t * 8, (1 - t) * 8);
    return target
      .lerpVectors(this.a, this.b, t)
      .addScaledVector(this.u, Math.cos(ang) * this.radius * ease)
      .addScaledVector(this.v, Math.sin(ang) * this.radius * ease);
  }
}

// ------------------------------------------------------------------ legends

interface Cell {
  u: number;
  v: number;
  du: number;
  dv: number;
  wide: boolean;
}

function drawArrow(ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number, size: number) {
  const rot = { "▲": 0, "▶": Math.PI / 2, "▼": Math.PI, "◀": -Math.PI / 2 }[label] ?? 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.55);
  ctx.lineTo(size * 0.5, size * 0.35);
  ctx.lineTo(-size * 0.5, size * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** White-on-black legend atlas (the shader reads the red channel as ink). */
function legendAtlas(keys: KeyDef[], font: string) {
  const cell = Math.round(64 * textureQuality.scale); // 128 px on desktop
  const W = cell * 16;
  const H = cell * 8;
  const { canvas, ctx } = createCanvas(W, H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cells = new Map<string, Cell>();
  let x = 0;
  let y = 0;
  for (const key of keys) {
    const id = `${key.top ?? ""}|${key.label}`;
    if (!key.label || cells.has(id)) continue;
    const wide = key.w >= 1.6;
    const cw = wide ? cell * 2 : cell;
    if (x + cw > W) {
      x = 0;
      y += cell;
    }
    const cx = x + cw / 2;
    const cy = y + cell / 2;
    const isArrow = "▲▶▼◀".includes(key.label);
    if (isArrow) {
      drawArrow(ctx, key.label, cx, cy, cell * 0.3);
    } else if (key.top) {
      ctx.font = `600 ${cell * 0.32}px ${font}`;
      ctx.fillText(key.top, cx, cy - cell * 0.19);
      ctx.fillText(key.label, cx, cy + cell * 0.2);
    } else if (key.label.length === 1) {
      ctx.font = `600 ${cell * 0.46}px ${font}`;
      ctx.fillText(key.label, cx, cy + cell * 0.02);
    } else {
      const size = key.label.length > 4 && !wide ? 0.21 : 0.26;
      ctx.font = `600 ${cell * size}px ${font}`;
      ctx.fillText(key.label, cx, cy + cell * 0.02);
    }
    cells.set(id, { u: x / W, v: y / H, du: cw / W, dv: cell / H, wide });
    x += cw;
  }
  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(8, textureQuality.anisotropy);
  return { texture, cells };
}

function backlightTexture() {
  const { canvas, ctx } = createCanvas(512, 8);
  const g = ctx.createLinearGradient(0, 0, 512, 0);
  for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${(i / 6) * 360}, 100%, 60%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 8);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  return t;
}

// ------------------------------------------------------------------ keyboard

export type BacklightMode = "rainbow" | "brand" | "off";

export interface KeyboardParts {
  root: Group;
  /** World-space point just above the keys, for particles. */
  center: Vector3;
  pressKey(key: string): void;
  setBacklight(mode: BacklightMode): void;
  update(dt: number, time: number, motion: number): void;
  dispose(): void;
}

export function createKeyboard(mats: Materials, opts: { position: Vector3; rotationY?: number; font: string }): KeyboardParts {
  const disposables: Array<{ dispose(): void }> = [];
  const root = group("keyboard");
  const keysW = 16 * U;
  const keysD = 6.25 * U;
  const caseW = keysW + 0.034;
  const caseD = keysD + 0.034;
  const slabH = 0.02;
  const rimH = 0.011;
  const plateY = slabH + 0.003;

  // ---- aluminium case: bevelled slab + rim with a recessed plate ----------
  const caseMat = new MeshStandardMaterial({ color: "#253553", metalness: 0.75, roughness: 0.34 });
  disposables.push(caseMat);
  const slabGeo = new ExtrudeGeometry(roundedRect(caseW, caseD, 0.014), {
    depth: slabH - 0.004,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 3,
    curveSegments: 10,
  });
  slabGeo.rotateX(-Math.PI / 2);
  slabGeo.translate(0, 0.002, 0);
  const rimShape = roundedRect(caseW, caseD, 0.014);
  const hole = roundedRect(keysW + 0.006, keysD + 0.006, 0.004);
  rimShape.holes.push(hole);
  const rimGeo = new ExtrudeGeometry(rimShape, {
    depth: rimH - 0.002,
    bevelEnabled: true,
    bevelThickness: 0.001,
    bevelSize: 0.0012,
    bevelSegments: 3,
    curveSegments: 10,
  });
  rimGeo.rotateX(-Math.PI / 2);
  rimGeo.translate(0, slabH, 0);
  disposables.push(slabGeo, rimGeo);
  root.add(mesh(slabGeo, caseMat), mesh(rimGeo, caseMat));
  root.add(box(keysW + 0.006, 0.002, keysD + 0.006, mats.plasticDark, 0, plateY - 0.001, 0, { cast: false }));
  // rubber feet at the back give the typing angle
  for (const x of [-caseW / 2 + 0.05, caseW / 2 - 0.05]) {
    root.add(box(0.05, 0.012, 0.02, mats.black, x, -0.004, -caseD / 2 + 0.03, { cast: false }));
    root.add(box(0.03, 0.004, 0.02, mats.black, x, 0.0, caseD / 2 - 0.03, { cast: false }));
  }

  // ---- key layout ---------------------------------------------------------
  const keys: Array<KeyDef & { x: number; z: number; row: number }> = [];
  ROWS.forEach((row, r) => {
    let x = 0;
    const z = -keysD / 2 + U / 2 + r * U + (r >= 1 ? 0.25 * U : 0);
    for (const key of row) {
      x += key.gap ?? 0;
      keys.push({ ...key, x: -keysW / 2 + (x + key.w / 2) * U, z, row: r });
      x += key.w;
    }
  });

  // ---- keycaps: one instanced draw call -----------------------------------
  const { texture: atlas, cells } = legendAtlas(keys, opts.font);
  disposables.push(atlas);
  const capGeo = keycapGeometry();
  disposables.push(capGeo);
  const n = keys.length;
  const extra = new Float32Array(n);
  const legend = new Float32Array(n * 4);
  const cellData = new Float32Array(n * 4);
  const press = new Float32Array(n);
  keys.forEach((key, i) => {
    extra[i] = (key.w - 1) * U;
    const cell = cells.get(`${key.top ?? ""}|${key.label}`);
    const topW = key.w * U - GAP - 2 * TOP_INSET;
    const size = 0.0215;
    if (cell) {
      legend.set([0, 0, cell.wide ? Math.min(size * 2, topW - 0.004) : size, size], i * 4);
      cellData.set([cell.u, cell.v, cell.du, cell.dv], i * 4);
    } else {
      legend.set([0, 0, 0.0001, 0.0001], i * 4);
      cellData.set([0, 0, 0, 0], i * 4);
    }
  });
  capGeo.setAttribute("aExtra", new InstancedBufferAttribute(extra, 1));
  capGeo.setAttribute("aLegend", new InstancedBufferAttribute(legend, 4));
  capGeo.setAttribute("aCell", new InstancedBufferAttribute(cellData, 4));
  const pressAttr = new InstancedBufferAttribute(press, 1);
  capGeo.setAttribute("aPress", pressAttr);

  const capMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, metalness: 0 });
  const glow = new Color(palette.brandSoft);
  capMat.onBeforeCompile = (shader) => {
    shader.uniforms.uLegendAtlas = { value: atlas };
    shader.uniforms.uGlowColor = { value: glow };
    shader.uniforms.uTopY = { value: TOP_Y };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float aExtra;
        attribute vec4 aLegend;
        attribute vec4 aCell;
        attribute float aPress;
        varying vec3 vKeyLocal;
        varying vec4 vLegend;
        varying vec4 vCell;
        varying float vPress;`,
      )
      .replace(
        "#include <begin_vertex>",
        `vec3 transformed = vec3( position );
        transformed.x += sign( transformed.x ) * aExtra * 0.5;
        vKeyLocal = transformed;
        vLegend = aLegend;
        vCell = aCell;
        vPress = aPress;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uLegendAtlas;
        uniform vec3 uGlowColor;
        uniform float uTopY;
        varying vec3 vKeyLocal;
        varying vec4 vLegend;
        varying vec4 vCell;
        varying float vPress;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        vec2 luv = ( vKeyLocal.xz - vLegend.xy ) / vLegend.zw + 0.5;
        float inCell = step( 0.0, luv.x ) * step( luv.x, 1.0 ) * step( 0.0, luv.y ) * step( luv.y, 1.0 );
        float onTop = smoothstep( uTopY - 0.0028, uTopY - 0.0016, vKeyLocal.y );
        float inkRaw = texture2D( uLegendAtlas, vCell.xy + clamp( luv, 0.0, 1.0 ) * vCell.zw, -0.5 ).r;
        float ink = smoothstep( 0.06, 0.55, inkRaw ) * inCell * onTop;
        float capLum = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
        vec3 inkColor = capLum > 0.45 ? vec3( 0.03, 0.04, 0.07 ) : vec3( 0.86, 0.9, 0.97 );
        diffuseColor.rgb = mix( diffuseColor.rgb, inkColor, ink );`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += uGlowColor * vPress * ( 0.22 + 0.9 * ink );`,
      );
  };
  capMat.customProgramCacheKey = () => "keycap-legends-v2";
  disposables.push(capMat);

  const caps = new InstancedMesh(capGeo, capMat, n);
  caps.castShadow = false;
  caps.receiveShadow = true;
  const basePos: Vector3[] = [];
  const baseQuat: Quaternion[] = [];
  const baseScale: Vector3[] = [];
  const m4 = new Matrix4();
  const color = new Color();
  const keyIndex = new Map<string, number>();
  keys.forEach((key, i) => {
    const pos = new Vector3(key.x, plateY, key.z);
    const quat = new Quaternion().setFromEuler(new Euler(ROW_TILT[key.row], 0, 0));
    const scale = new Vector3(1, ROW_HEIGHT[key.row], 1);
    basePos.push(pos);
    baseQuat.push(quat);
    baseScale.push(scale);
    caps.setMatrixAt(i, m4.compose(pos, quat, scale));
    caps.setColorAt(i, color.set(CAP_COLORS[key.kind]));
    if (!keyIndex.has(key.code)) keyIndex.set(key.code, i);
  });
  caps.instanceMatrix.needsUpdate = true;
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
  caps.frustumCulled = false;
  root.add(caps);

  // ---- RGB backlight, visible in the gaps between caps ---------------------
  const lightTex = backlightTexture();
  disposables.push(lightTex);
  const backlightMat = new MeshBasicMaterial({
    map: lightTex,
    color: "#ffffff",
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  disposables.push(backlightMat);
  const backlight = mesh(new PlaneGeometry(keysW, keysD), backlightMat, { cast: false, receive: false });
  backlight.rotation.x = -Math.PI / 2;
  backlight.position.y = plateY + 0.0006;
  root.add(backlight);

  // ---- volume knob with a knurled edge -------------------------------------
  const knobGeo = new CylinderGeometry(0.0145, 0.0145, 0.017, 72, 1);
  const kp = knobGeo.getAttribute("position");
  for (let i = 0; i < kp.count; i++) {
    const x = kp.getX(i);
    const z = kp.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 0.014) {
      const a = Math.atan2(z, x);
      const rr = 0.0145 + (Math.round((a / (Math.PI * 2)) * 72) % 2 === 0 ? 0.0006 : 0);
      kp.setXYZ(i, Math.cos(a) * rr, kp.getY(i), Math.sin(a) * rr);
    }
  }
  knobGeo.computeVertexNormals();
  disposables.push(knobGeo);
  const knob = mesh(knobGeo, mats.metal);
  const knobX = -keysW / 2 + 15.5 * U;
  const knobZ = -keysD / 2 + U / 2;
  knob.position.set(knobX, plateY + 0.0085, knobZ);
  root.add(knob);
  root.add(box(0.002, 0.0008, 0.008, mats.plasticDark, knobX, plateY + 0.0174, knobZ - 0.007, { cast: false }));

  // caps-lock style status LED
  root.add(box(0.006, 0.0016, 0.002, mats.led, caseW / 2 - 0.03, slabH + rimH + 0.0008, -caseD / 2 + 0.006, { cast: false, receive: false }));

  // ---- placement + typing angle ---------------------------------------------
  root.position.copy(opts.position);
  root.rotation.set(0.065, opts.rotationY ?? 0, 0, "YXZ");
  root.updateMatrixWorld(true);

  // ---- coiled USB-C cable from the back of the keyboard to the monitor -------
  const cableMat = new MeshStandardMaterial({ color: palette.brand, roughness: 0.45 });
  disposables.push(cableMat);
  const toWorld = (x: number, y: number, z: number) => new Vector3(x, y, z).applyMatrix4(root.matrixWorld);
  const port = toWorld(-0.2, slabH * 0.6, -caseD / 2 - 0.004);
  const coilStart = port.clone().add(new Vector3(0, 0.002, -0.03));
  const coilEnd = coilStart.clone().add(new Vector3(0.02, -0.006, -0.12));
  const deskY = opts.position.y + 0.005;
  const coil = new CoilCurve(coilStart, coilEnd, 11, 0.0085);
  const lead = new CatmullRomCurve3([
    port,
    coilStart,
  ]);
  const tail = new CatmullRomCurve3([
    coilEnd,
    coilEnd.clone().add(new Vector3(0.03, -0.004, -0.05)),
    new Vector3(coilEnd.x + 0.1, deskY, coilEnd.z - 0.12),
    new Vector3(coilEnd.x + 0.26, deskY, coilEnd.z - 0.2),
  ]);
  const coilGeo = new TubeGeometry(coil, 420, 0.0027, 8, false);
  const leadGeo = new TubeGeometry(lead, 8, 0.0035, 10, false);
  const tailGeo = new TubeGeometry(tail, 48, 0.003, 8, false);
  disposables.push(coilGeo, leadGeo, tailGeo);
  const cable = group("cable", mesh(coilGeo, cableMat, { receive: false }), mesh(leadGeo, mats.metal, { receive: false }), mesh(tailGeo, cableMat, { receive: false }));

  const center = toWorld(0, plateY + 0.03, 0);

  // ---- behaviour -------------------------------------------------------------------
  function hit(code: string) {
    const i = keyIndex.get(code);
    if (i !== undefined) press[i] = 1;
  }

  function pressKey(key: string) {
    if (key === "Backspace" || key === "Enter" || key === " ") return hit(key);
    if (key.length !== 1) return;
    const lower = key.toLowerCase();
    if (keyIndex.has(lower)) {
      if (key !== lower) hit("Shift");
      return hit(lower);
    }
    const base = SHIFTED[key];
    if (base) {
      hit("Shift");
      return hit(base);
    }
    if (key === "’" || key === "‘") return hit("'");
    if (key === "\n") return hit("Enter");
    // anything else (emoji, accents): tap a home-row key so the keyboard still reacts
    hit("asdfjkl"[key.charCodeAt(0) % 7]);
  }

  const tmpPos = new Vector3();
  let mode: BacklightMode = "rainbow";
  function setBacklight(next: BacklightMode) {
    mode = next;
    backlight.visible = next !== "off";
    backlightMat.map = next === "rainbow" ? lightTex : null;
    backlightMat.color.set(next === "rainbow" ? "#ffffff" : palette.brandSoft);
    backlightMat.needsUpdate = true;
  }

  function update(dt: number, time: number, motion: number) {
    let dirty = false;
    for (let i = 0; i < n; i++) {
      const a = press[i];
      if (a <= 0) continue;
      const next = Math.max(0, a - dt / 0.24);
      press[i] = next;
      // fast press, slower release
      const p = next > 0.72 ? (1 - next) / 0.28 : next / 0.72;
      tmpPos.copy(basePos[i]);
      tmpPos.y -= 0.0075 * p;
      caps.setMatrixAt(i, m4.compose(tmpPos, baseQuat[i], baseScale[i]));
      dirty = true;
    }
    if (dirty) {
      caps.instanceMatrix.needsUpdate = true;
      pressAttr.needsUpdate = true;
    }
    if (mode === "rainbow") lightTex.offset.x = (time * 0.06 * motion) % 1;
    else if (mode === "brand") backlightMat.opacity = 0.6 + 0.25 * Math.sin(time * 1.4 * motion);
  }

  return {
    root: group("keyboard-setup", root, cable),
    center,
    pressKey,
    setBacklight,
    update,
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
