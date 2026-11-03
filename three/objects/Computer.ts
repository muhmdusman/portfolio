import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  type Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  type Texture,
  TorusGeometry,
  Vector3,
  AdditiveBlending,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { box, getGlowTexture, glowCard, group, mesh, palette, rbox, type Materials } from "../core/kit";

/**
 * The computer setup: desk, monitor (with the live UsmanOS screen),
 * an instanced mechanical keyboard that reacts to typing, mouse, desk lamp,
 * coffee mug and an RGB PC tower.
 */

export const DESK_TOP = 0.78;
export const SCREEN_CENTER = new Vector3(0.35, 1.275, -2.165);
export const SCREEN_SIZE = { w: 1.1, h: 0.61875 };
export const MUG_TOP = new Vector3(1.25, DESK_TOP + 0.11, -1.95);
export const KEYBOARD_CENTER = new Vector3(0.28, DESK_TOP + 0.04, -1.72);

type KeyDef = [code: string, width: number];
const ROWS: KeyDef[][] = [
  [["Escape", 1], ...[..."1234567890-="].map((k): KeyDef => [k, 1]), ["Backspace", 2]],
  [["Tab", 1.5], ...[..."qwertyuiop[]"].map((k): KeyDef => [k, 1]), ["\\", 1.5]],
  [["CapsLock", 1.75], ...[..."asdfghjkl;'"].map((k): KeyDef => [k, 1]), ["Enter", 2.25]],
  [["Shift", 2.25], ...[..."zxcvbnm,./"].map((k): KeyDef => [k, 1]), ["ShiftRight", 2.75]],
  [
    ["Control", 1.25],
    ["Meta", 1.25],
    ["Alt", 1.25],
    [" ", 6.25],
    ["AltRight", 1.25],
    ["Fn", 1.25],
    ["ContextMenu", 1.25],
    ["ControlRight", 1.25],
  ],
];

const SHIFTED: Record<string, string> = {
  "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  _: "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/",
  "~": "Escape", "`": "Escape",
};

const MODIFIERS = new Set(["Tab", "CapsLock", "Shift", "ShiftRight", "Control", "Meta", "Alt", "AltRight", "Fn", "ContextMenu", "ControlRight", "Backspace"]);

export type RgbMode = "rainbow" | "brand" | "off";

export interface ComputerParts {
  root: Group;
  props: Object3D[];
  screen: Object3D;
  monitor: Group;
  lamp: Group;
  lampLight: PointLight;
  tower: Group;
  mug: Group;
  pressKey(key: string): void;
  setLamp(on: boolean): void;
  setRgb(mode: RgbMode): void;
  /** `motion` is 0 when the visitor prefers reduced motion (idle animations freeze). */
  update(dt: number, time: number, motion: number): void;
  dispose(): void;
}

export function createComputer(
  mats: Materials,
  screenTexture: Texture,
  opts: { lights: boolean },
): ComputerParts {
  const root = group("computer");
  const props: Object3D[] = [];
  const disposables: Array<{ dispose(): void }> = [];

  // ---- desk ----------------------------------------------------------------------
  const desk = group("desk");
  desk.add(rbox(2.3, 0.065, 0.88, 0.02, mats.wood, 0.35, DESK_TOP - 0.0325, -1.96));
  for (const x of [-0.72, 1.42]) {
    desk.add(
      box(0.045, DESK_TOP - 0.065, 0.045, mats.metalDark, x, (DESK_TOP - 0.065) / 2, -2.3),
      box(0.045, DESK_TOP - 0.065, 0.045, mats.metalDark, x, (DESK_TOP - 0.065) / 2, -1.62),
      box(0.05, 0.03, 0.78, mats.metalDark, x, 0.015, -1.96),
      box(0.04, 0.04, 0.72, mats.metalDark, x, DESK_TOP - 0.085, -1.96),
    );
  }
  desk.add(box(2.1, 0.04, 0.03, mats.metalDark, 0.35, 0.58, -2.3));
  // desk mat with an accent outline
  desk.add(
    rbox(1.34, 0.006, 0.47, 0.01, mats.accent, 0.52, DESK_TOP + 0.003, -1.72, { cast: false }),
    rbox(1.32, 0.008, 0.45, 0.01, mats.deskMat, 0.52, DESK_TOP + 0.005, -1.72, { cast: false }),
  );
  root.add(desk);
  props.push(desk);

  // ---- monitor --------------------------------------------------------------------
  const monitor = group("monitor");
  monitor.add(
    rbox(0.42, 0.022, 0.25, 0.008, mats.metal, 0.35, DESK_TOP + 0.011, -2.16),
    rbox(0.075, 0.43, 0.035, 0.012, mats.metal, 0.35, DESK_TOP + 0.23, -2.245),
    rbox(1.16, 0.68, 0.045, 0.02, mats.plasticDark, 0.35, 1.27, -2.19),
    rbox(0.62, 0.4, 0.07, 0.03, mats.plasticDark, 0.35, 1.25, -2.235),
  );
  const screen = mesh(
    new PlaneGeometry(SCREEN_SIZE.w, SCREEN_SIZE.h),
    new MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
    { cast: false, receive: false },
  );
  screen.position.copy(SCREEN_CENTER);
  screen.name = "screen";
  monitor.add(screen);
  // power LED
  monitor.add(box(0.012, 0.006, 0.004, mats.led, 0.86, 0.947, -2.166, { cast: false, receive: false }));
  // bias lighting washing the wall behind the monitor
  const bias = glowCard(palette.brand, 2.8, 1.7, 0.55);
  bias.position.set(0.35, 1.32, -2.395);
  monitor.add(bias);
  root.add(monitor);
  props.push(monitor);

  if (opts.lights) {
    const screenLight = new PointLight("#5aa8ff", 2.4, 3.6, 2);
    screenLight.position.set(0.35, 1.25, -1.72);
    root.add(screenLight);
  }

  // ---- keyboard (single instanced draw call for all keycaps) -------------------------
  const keyboard = group("keyboard");
  const KB_Y = DESK_TOP + 0.009;
  keyboard.add(rbox(0.64, 0.026, 0.225, 0.008, mats.plasticDark, KEYBOARD_CENTER.x, KB_Y + 0.013, KEYBOARD_CENTER.z));
  const U = 0.04;
  const capGeo = new RoundedBoxGeometry(0.034, 0.016, 0.034, 2, 0.006);
  disposables.push(capGeo);
  const keyCount = ROWS.reduce((n, row) => n + row.length, 0);
  const caps = new InstancedMesh(capGeo, mats.keycap, keyCount);
  caps.castShadow = true;
  caps.receiveShadow = true;
  const keyIndex = new Map<string, number>();
  const basePos: Vector3[] = [];
  const baseScale: Vector3[] = [];
  const baseColor: Color[] = [];
  const m4 = new Matrix4();
  const q = new Quaternion();
  let idx = 0;
  ROWS.forEach((row, r) => {
    let x = KEYBOARD_CENTER.x - 7.5 * U;
    const z = KEYBOARD_CENTER.z - 2 * U + r * U;
    for (const [code, width] of row) {
      const cx = x + (width * U) / 2;
      const pos = new Vector3(cx, KB_Y + 0.026 + 0.008, z);
      const scale = new Vector3((width * U - 0.006) / 0.034, 1, 1);
      basePos.push(pos);
      baseScale.push(scale);
      m4.compose(pos, q, scale);
      caps.setMatrixAt(idx, m4);
      const color = new Color(
        code === "Escape" ? "#ff8a3d" : code === "Enter" ? palette.brand : MODIFIERS.has(code) ? "#46516e" : palette.cream,
      );
      baseColor.push(color);
      caps.setColorAt(idx, color);
      if (!keyIndex.has(code)) keyIndex.set(code, idx);
      idx++;
      x += width * U;
    }
  });
  caps.instanceMatrix.needsUpdate = true;
  if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
  keyboard.add(caps);
  root.add(keyboard);
  props.push(keyboard);

  const pressAmount = new Float32Array(keyCount);
  const glowColor = new Color(palette.brandSoft);
  const tmpColor = new Color();
  const tmpPos = new Vector3();

  function press(code: string) {
    const i = keyIndex.get(code);
    if (i !== undefined) pressAmount[i] = 1;
  }

  function pressKey(key: string) {
    if (key === "Backspace" || key === "Enter" || key === " ") return press(key);
    if (key.length !== 1) return;
    const lower = key.toLowerCase();
    if (keyIndex.has(lower)) {
      if (key !== lower) press("Shift");
      return press(lower);
    }
    const base = SHIFTED[key];
    if (base) {
      press("Shift");
      press(base);
      return;
    }
    if (key === "’" || key === "‘") return press("'");
    // Anything else (emoji, accents): tap a letter so the keyboard still reacts.
    press("asdfjkl"[key.charCodeAt(0) % 7]);
  }

  function updateKeys(dt: number) {
    let dirty = false;
    for (let i = 0; i < keyCount; i++) {
      const a = pressAmount[i];
      if (a <= 0) continue;
      const next = Math.max(0, a - dt / 0.22);
      pressAmount[i] = next;
      // fast press, slower release
      const p = next > 0.7 ? (1 - next) / 0.3 : next / 0.7;
      tmpPos.copy(basePos[i]);
      tmpPos.y -= 0.007 * p;
      m4.compose(tmpPos, q, baseScale[i]);
      caps.setMatrixAt(i, m4);
      tmpColor.copy(baseColor[i]).lerp(glowColor, p * 0.85);
      caps.setColorAt(i, tmpColor);
      dirty = true;
    }
    if (dirty) {
      caps.instanceMatrix.needsUpdate = true;
      if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
    }
  }

  // ---- mouse -----------------------------------------------------------------------
  const mouse = group("mouse");
  const mouseBody = mesh(new SphereGeometry(0.05, 22, 14), mats.plasticLight);
  mouseBody.scale.set(0.62, 0.38, 1);
  const wheel = mesh(new CylinderGeometry(0.008, 0.008, 0.01, 12), mats.black, { cast: false });
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0, 0.018, -0.02);
  mouse.add(mouseBody, wheel);
  mouse.position.set(0.98, DESK_TOP + 0.009, -1.7);
  mouse.rotation.y = -0.12;
  root.add(mouse);
  props.push(mouse);

  // ---- desk lamp -----------------------------------------------------------------------
  const lamp = group("lamp");
  const lampBase = new Vector3(-0.55, DESK_TOP, -2.16);
  const elbow = new Vector3(-0.5, 1.28, -2.3);
  const head = new Vector3(-0.27, 1.4, -2.0);
  lamp.add(mesh(new CylinderGeometry(0.085, 0.1, 0.026, 26), mats.plasticLight));
  lamp.children[0].position.copy(lampBase).setY(DESK_TOP + 0.013);
  const armGeo = (a: Vector3, b: Vector3) => {
    const dir = new Vector3().subVectors(b, a);
    const g = new CylinderGeometry(0.012, 0.012, dir.length(), 10);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
  };
  const jointGeo = new SphereGeometry(0.022, 12, 10);
  const armParts: BufferGeometry[] = [
    armGeo(lampBase.clone().setY(DESK_TOP + 0.02), elbow),
    armGeo(elbow, head),
    jointGeo.clone().translate(elbow.x, elbow.y, elbow.z),
  ];
  lamp.add(mesh(mergeGeometries(armParts), mats.plasticLight));
  armParts.forEach((g) => g.dispose());
  jointGeo.dispose();
  const shade = mesh(new CylinderGeometry(0.035, 0.11, 0.15, 26, 1, true), new MeshStandardMaterial({ color: palette.cream, roughness: 0.55, side: DoubleSide }));
  const shadeDir = new Vector3(0.25, -1, 0.45).normalize();
  shade.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), shadeDir);
  shade.position.copy(head);
  lamp.add(shade);
  const bulbPos = head.clone().addScaledVector(shadeDir, 0.05);
  const bulb = mesh(new SphereGeometry(0.034, 14, 10), mats.bulb, { cast: false, receive: false });
  bulb.position.copy(bulbPos);
  lamp.add(bulb);
  const bulbGlow = new Sprite(
    new SpriteMaterial({ map: getGlowTexture(), color: palette.warm, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  bulbGlow.scale.setScalar(0.55);
  bulbGlow.position.copy(bulbPos);
  lamp.add(bulbGlow);
  const lampLight = new PointLight(palette.warm, 2.6, 4.2, 2);
  lampLight.position.copy(head).addScaledVector(shadeDir, 0.14);
  lamp.add(lampLight);
  const lampPool = glowCard(palette.warm, 1.5, 1.1, 0.16);
  lampPool.rotation.x = -Math.PI / 2;
  lampPool.position.set(-0.05, DESK_TOP + 0.012, -1.86);
  lamp.add(lampPool);
  root.add(lamp);
  props.push(lamp);

  function setLamp(on: boolean) {
    lampLight.visible = on;
    bulbGlow.visible = on;
    lampPool.visible = on;
    (bulb.material as MeshBasicMaterial).color.set(on ? "#ffe2b8" : "#5a5248");
  }

  // ---- coffee mug ---------------------------------------------------------------------------
  const mug = group("mug");
  const mugMat = new MeshStandardMaterial({ color: palette.brand, roughness: 0.4, side: DoubleSide });
  disposables.push(mugMat);
  mug.add(mesh(new CylinderGeometry(0.046, 0.04, 0.105, 22, 1, true), mugMat));
  mug.add(mesh(new CylinderGeometry(0.04, 0.04, 0.004, 22), mugMat));
  mug.children[1].position.y = -0.05;
  const coffee = mesh(new CylinderGeometry(0.043, 0.043, 0.004, 22), new MeshStandardMaterial({ color: "#3b2416", roughness: 0.25 }), { cast: false });
  coffee.position.y = 0.035;
  mug.add(coffee);
  const handle = mesh(new TorusGeometry(0.028, 0.008, 8, 18, Math.PI), mugMat);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.045, 0, 0);
  mug.add(handle);
  mug.position.set(MUG_TOP.x, DESK_TOP + 0.0525, MUG_TOP.z);
  mug.rotation.y = 0.6;
  root.add(mug);
  props.push(mug);

  // ---- PC tower with RGB ------------------------------------------------------------------------
  const tower = group("tower");
  const TX = 1.86;
  const TZ = -1.95;
  tower.add(rbox(0.36, 0.62, 0.68, 0.02, mats.plasticDark, TX, 0.33, TZ));
  for (const [dx, dz] of [
    [-0.13, -0.28],
    [0.13, -0.28],
    [-0.13, 0.28],
    [0.13, 0.28],
  ]) {
    tower.add(box(0.06, 0.02, 0.06, mats.black, TX + dx, 0.01, TZ + dz, { cast: false }));
  }
  // dark interior seen through the glass
  tower.add(box(0.012, 0.56, 0.62, new MeshStandardMaterial({ color: "#0a1426", roughness: 0.8 }), TX - 0.15, 0.33, TZ, { cast: false }));
  const gpu = rbox(0.2, 0.05, 0.42, 0.008, mats.black, TX - 0.04, 0.25, TZ - 0.02, { cast: false });
  tower.add(gpu);

  const ringMats = [0, 1, 2, 3].map(() => new MeshBasicMaterial({ color: palette.brand, toneMapped: false }));
  disposables.push(...ringMats);
  const bladeParts: BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const blade = new BoxGeometry(0.075, 0.022, 0.004);
    blade.translate(0.042, 0, 0);
    blade.rotateZ((i / 7) * Math.PI * 2);
    bladeParts.push(blade);
  }
  const bladeGeo = mergeGeometries(bladeParts);
  bladeParts.forEach((g) => g.dispose());
  disposables.push(bladeGeo);
  const ringGeo = new TorusGeometry(0.085, 0.007, 8, 40);
  disposables.push(ringGeo);
  const fans: Object3D[] = [];
  const makeFan = (mat: MeshBasicMaterial, x: number, y: number, z: number, rotY: number) => {
    const fan = group("fan");
    const ring = mesh(ringGeo, mat, { cast: false, receive: false });
    const blades = mesh(bladeGeo, mats.metalDark, { cast: false, receive: false });
    fan.add(ring, blades);
    fan.position.set(x, y, z);
    fan.rotation.y = rotY;
    tower.add(fan);
    fans.push(blades);
  };
  makeFan(ringMats[0], TX, 0.46, TZ + 0.31, 0);
  makeFan(ringMats[1], TX, 0.22, TZ + 0.31, 0);
  makeFan(ringMats[2], TX - 0.02, 0.47, TZ - 0.2, Math.PI / 2);
  // front light strip + GPU strip
  tower.add(box(0.012, 0.5, 0.012, ringMats[3], TX + 0.17, 0.33, TZ + 0.345, { cast: false, receive: false }));
  tower.add(box(0.004, 0.012, 0.36, ringMats[3], TX + 0.062, 0.27, TZ - 0.02, { cast: false, receive: false }));
  // glass side panel
  const glass = mesh(new PlaneGeometry(0.62, 0.56), mats.glass, { cast: false, receive: false });
  glass.rotation.y = Math.PI / 2;
  glass.position.set(TX + 0.182, 0.33, TZ);
  tower.add(glass);
  // power button
  const power = mesh(new CylinderGeometry(0.014, 0.014, 0.006, 16), mats.led, { cast: false, receive: false });
  power.position.set(TX + 0.08, 0.643, TZ + 0.26);
  tower.add(power);
  root.add(tower);
  props.push(tower);

  let rgbLight: PointLight | null = null;
  if (opts.lights) {
    rgbLight = new PointLight(palette.brand, 1.2, 2.6, 2);
    rgbLight.position.set(TX + 0.35, 0.4, TZ + 0.2);
    root.add(rgbLight);
  }

  let rgbMode: RgbMode = "rainbow";
  function setRgb(mode: RgbMode) {
    rgbMode = mode;
    if (mode === "off") {
      ringMats.forEach((m) => m.color.set("#1a2233"));
      if (rgbLight) rgbLight.visible = false;
    } else if (rgbLight) {
      rgbLight.visible = true;
    }
  }

  const tmp = new Color();
  const violet = new Color(palette.violet);
  function update(dt: number, time: number, motion: number) {
    // key presses are direct feedback to typing, so they animate even with reduced motion
    updateKeys(dt);
    for (const f of fans) f.rotation.z -= dt * motion * (rgbMode === "off" ? 2 : 9);
    if (rgbMode === "rainbow") {
      ringMats.forEach((m, i) => m.color.setHSL((time * 0.07 + i * 0.12) % 1, 0.95, 0.58));
      rgbLight?.color.copy(ringMats[0].color);
    } else if (rgbMode === "brand") {
      const k = 0.5 + 0.5 * Math.sin(time * 1.6);
      ringMats.forEach((m, i) => m.color.copy(tmp.set(palette.brand).lerp(violet, (k + i * 0.2) % 1)));
      rgbLight?.color.copy(ringMats[0].color);
    }
    // slow color drift on the bias light
    const biasMat = bias.material as MeshBasicMaterial;
    biasMat.color.setHSL(0.6 + Math.sin(time * 0.25) * 0.06, 0.95, 0.55);
  }

  return {
    root,
    props,
    screen,
    monitor,
    lamp,
    lampLight,
    tower,
    mug,
    pressKey,
    setLamp,
    setRgb,
    update,
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
