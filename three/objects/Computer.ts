import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  type Group,
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
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { box, getGlowTexture, glowCard, group, mesh, palette, rbox, type Materials } from "../core/kit";
import { createKeyboard } from "./Keyboard";

/**
 * The computer setup: desk, a large monitor (with the live UsmanOS screen),
 * a 75% mechanical keyboard that reacts to typing, mouse, desk lamp,
 * coffee mug and an RGB PC tower.
 */

export const DESK_TOP = 0.78;
export const SCREEN_SIZE = { w: 1.44, h: 0.81 };
export const SCREEN_CENTER = new Vector3(0.35, 0.975 + SCREEN_SIZE.h / 2, -2.165);
export const MUG_TOP = new Vector3(1.32, DESK_TOP + 0.11, -1.98);
export const KEYBOARD_POS = new Vector3(0.3, DESK_TOP + 0.012, -1.69);

export type RgbMode = "steady" | "rainbow" | "brand" | "off";

export interface ComputerParts {
  root: Group;
  props: Object3D[];
  screen: Object3D;
  monitor: Group;
  lamp: Group;
  lampLight: PointLight;
  tower: Group;
  mug: Group;
  /** World-space point just above the keyboard. */
  keyboardCenter: Vector3;
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
  opts: { lights: boolean; font: string; mobile: boolean },
): ComputerParts {
  const root = group("computer");
  const props: Object3D[] = [];
  const disposables: Array<{ dispose(): void }> = [];

  // ---- desk ----------------------------------------------------------------------
  const desk = group("desk");
  desk.add(rbox(2.6, 0.065, 0.88, 0.012, mats.wood, 0.35, DESK_TOP - 0.0325, -1.96, undefined, 3));
  for (const x of [-0.86, 1.56]) {
    desk.add(
      box(0.045, DESK_TOP - 0.065, 0.045, mats.metalDark, x, (DESK_TOP - 0.065) / 2, -2.3),
      box(0.045, DESK_TOP - 0.065, 0.045, mats.metalDark, x, (DESK_TOP - 0.065) / 2, -1.62),
      box(0.05, 0.03, 0.78, mats.metalDark, x, 0.015, -1.96),
      box(0.04, 0.04, 0.72, mats.metalDark, x, DESK_TOP - 0.085, -1.96),
    );
  }
  desk.add(box(2.4, 0.04, 0.03, mats.metalDark, 0.35, 0.58, -2.3));
  // dark desk pad, no coloured outline
  desk.add(rbox(1.48, 0.008, 0.48, 0.008, mats.deskMat, 0.52, DESK_TOP + 0.004, -1.7, { cast: false }, 2));
  root.add(desk);
  props.push(desk);

  // ---- monitor --------------------------------------------------------------------
  const monitor = group("monitor");
  const sc = SCREEN_CENTER;
  const bezelH = SCREEN_SIZE.h + 0.032;
  const bezelW = SCREEN_SIZE.w + 0.014;
  const bezelY = sc.y - 0.004;
  monitor.add(
    // flat base, slim neck, full-width shell, thin bezel. The old back blob read as a toy.
    rbox(0.44, 0.011, 0.2, 0.004, mats.metal, sc.x, DESK_TOP + 0.006, -2.15, undefined, 2),
    rbox(0.036, 0.34, 0.014, 0.004, mats.metal, sc.x, DESK_TOP + 0.18, -2.198, undefined, 2),
    rbox(bezelW - 0.008, bezelH - 0.01, 0.02, 0.005, mats.plasticDark, sc.x, bezelY, -2.192, undefined, 2),
    rbox(bezelW, bezelH, 0.008, 0.003, mats.plasticDark, sc.x, bezelY, -2.176, undefined, 2),
  );
  const bezelBottom = bezelY - bezelH / 2;
  // a slim chin strip
  monitor.add(box(0.1, 0.003, 0.002, mats.metal, sc.x, bezelBottom + 0.012, -2.171, { cast: false }));
  const screenMat = new MeshBasicMaterial({ map: screenTexture, toneMapped: false });
  disposables.push(screenMat);
  const screen = mesh(new PlaneGeometry(SCREEN_SIZE.w, SCREEN_SIZE.h), screenMat, { cast: false, receive: false });
  screen.position.copy(SCREEN_CENTER);
  screen.name = "screen";
  monitor.add(screen);
  // power LED
  monitor.add(box(0.01, 0.004, 0.002, mats.led, sc.x + SCREEN_SIZE.w / 2 - 0.03, bezelBottom + 0.012, -2.171, { cast: false, receive: false }));
  // soft spill on the wall, steady, not a colour cycle
  const bias = glowCard("#9eb4d4", 2.4, 1.5, 0.16);
  bias.position.set(sc.x, sc.y + 0.02, -2.395);
  monitor.add(bias);
  root.add(monitor);
  props.push(monitor);

  if (opts.lights) {
    const screenLight = new PointLight("#c5d7ee", 0.85, 2.6, 2);
    screenLight.position.set(sc.x, sc.y - 0.1, -1.6);
    root.add(screenLight);
  }

  // ---- keyboard -------------------------------------------------------------------
  const keyboard = createKeyboard(mats, { position: KEYBOARD_POS, font: opts.font });
  root.add(keyboard.root);
  props.push(keyboard.root);

  // ---- mouse -----------------------------------------------------------------------
  const mouse = group("mouse");
  const mouseBody = mesh(new SphereGeometry(0.05, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.plasticLight);
  mouseBody.scale.set(0.62, 0.42, 1);
  const wheel = mesh(new CylinderGeometry(0.008, 0.008, 0.01, 24), mats.black, { cast: false });
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0, 0.019, -0.022);
  const split = box(0.0015, 0.004, 0.045, mats.black, 0, 0.019, -0.03, { cast: false });
  mouse.add(mouseBody, wheel, split);
  mouse.position.set(1.02, DESK_TOP + 0.009, -1.66);
  mouse.rotation.y = -0.12;
  root.add(mouse);
  props.push(mouse);

  // ---- desk lamp -----------------------------------------------------------------------
  const lamp = group("lamp");
  const lampBase = new Vector3(-0.74, DESK_TOP, -2.12);
  const elbow = new Vector3(-0.72, 1.24, -2.3);
  const head = new Vector3(-0.56, 1.36, -1.98);
  lamp.add(mesh(new CylinderGeometry(0.08, 0.09, 0.022, 28), mats.plasticLight));
  lamp.children[0].position.copy(lampBase).setY(DESK_TOP + 0.013);
  const armGeo = (a: Vector3, b: Vector3) => {
    const dir = new Vector3().subVectors(b, a);
    const g = new CylinderGeometry(0.011, 0.011, dir.length(), 10);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()));
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
  };
  const jointGeo = new SphereGeometry(0.02, 12, 10);
  const armParts: BufferGeometry[] = [
    armGeo(lampBase.clone().setY(DESK_TOP + 0.02), elbow),
    armGeo(elbow, head),
    jointGeo.clone().translate(elbow.x, elbow.y, elbow.z),
  ];
  lamp.add(mesh(mergeGeometries(armParts), mats.plasticLight));
  armParts.forEach((g) => g.dispose());
  jointGeo.dispose();
  const shade = mesh(new CylinderGeometry(0.032, 0.1, 0.14, 24, 1, true), new MeshStandardMaterial({ color: palette.cream, roughness: 0.55, side: DoubleSide }));
  const shadeDir = new Vector3(0.38, -1, 0.42).normalize();
  shade.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), shadeDir);
  shade.position.copy(head);
  lamp.add(shade);
  const bulbPos = head.clone().addScaledVector(shadeDir, 0.05);
  const bulb = mesh(new SphereGeometry(0.03, 14, 12), mats.bulb, { cast: false, receive: false });
  bulb.position.copy(bulbPos);
  lamp.add(bulb);
  const bulbGlow = new Sprite(
    new SpriteMaterial({ map: getGlowTexture(), color: palette.warm, transparent: true, opacity: 0.85, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  bulbGlow.scale.setScalar(0.55);
  bulbGlow.position.copy(bulbPos);
  lamp.add(bulbGlow);
  const lampLight = new PointLight(palette.warm, 2.1, 3.6, 2);
  lampLight.position.copy(head).addScaledVector(shadeDir, 0.14);
  lamp.add(lampLight);
  const lampPool = glowCard(palette.warm, 1.15, 0.85, 0.1);
  lampPool.rotation.x = -Math.PI / 2;
  lampPool.position.set(-0.32, DESK_TOP + 0.012, -1.84);
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
  const mugMat = new MeshStandardMaterial({ color: "#e3dbd0", roughness: 0.42, metalness: 0.02, side: DoubleSide });
  const coffeeMat = new MeshStandardMaterial({ color: "#3a2416", roughness: 0.2, metalness: 0.06 });
  disposables.push(mugMat, coffeeMat);
  mug.add(mesh(new CylinderGeometry(0.044, 0.039, 0.1, 24, 1, true), mugMat));
  const mugBottom = mesh(new CylinderGeometry(0.039, 0.039, 0.005, 24), mugMat);
  mugBottom.position.y = -0.048;
  mug.add(mugBottom);
  const lip = mesh(new TorusGeometry(0.044, 0.004, 6, 24), mugMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 0.048;
  mug.add(lip);
  const coffee = mesh(new CylinderGeometry(0.04, 0.04, 0.005, 24), coffeeMat, { cast: false });
  coffee.position.y = 0.028;
  mug.add(coffee);
  const handle = mesh(new TorusGeometry(0.026, 0.007, 8, 18, Math.PI), mugMat);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.045, 0, 0);
  mug.add(handle);
  mug.position.set(MUG_TOP.x, DESK_TOP + 0.05, MUG_TOP.z);
  mug.rotation.y = 0.6;
  root.add(mug);
  props.push(mug);

  // ---- PC tower with RGB ------------------------------------------------------------------------
  const tower = group("tower");
  const TX = 1.96;
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
  const ringGeo = new TorusGeometry(0.085, 0.006, 8, 36);
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
  const power = mesh(new CylinderGeometry(0.014, 0.014, 0.006, 32), mats.led, { cast: false, receive: false });
  power.position.set(TX + 0.08, 0.643, TZ + 0.26);
  tower.add(power);
  root.add(tower);
  props.push(tower);

  let rgbLight: PointLight | null = null;
  if (opts.lights) {
    rgbLight = new PointLight(palette.brand, 0.55, 2.2, 2);
    rgbLight.position.set(TX + 0.35, 0.4, TZ + 0.2);
    root.add(rgbLight);
  }

  let rgbMode: RgbMode = "steady";
  const STEADY = "#d5dde6";
  function setRgb(mode: RgbMode) {
    rgbMode = mode;
    keyboard.setBacklight(mode);
    if (mode === "off") ringMats.forEach((m) => m.color.set("#1a2233"));
    else if (mode === "steady") ringMats.forEach((m) => m.color.set(STEADY));
    if (rgbLight) rgbLight.visible = mode === "rainbow" || mode === "brand";
  }

  const tmp = new Color();
  const violet = new Color(palette.violet);
  function update(dt: number, time: number, motion: number) {
    keyboard.update(dt, time, motion);
    const spin = rgbMode === "off" ? 0 : rgbMode === "steady" ? 3.2 : 8;
    if (spin > 0) for (const f of fans) f.rotation.z -= dt * motion * spin;
    if (rgbMode === "rainbow") {
      ringMats.forEach((m, i) => m.color.setHSL((time * 0.07 + i * 0.12) % 1, 0.85, 0.55));
      rgbLight?.color.copy(ringMats[0].color);
    } else if (rgbMode === "brand") {
      const k = 0.5 + 0.5 * Math.sin(time * 1.6);
      ringMats.forEach((m, i) => m.color.copy(tmp.set(palette.brand).lerp(violet, (k + i * 0.2) % 1)));
      rgbLight?.color.copy(ringMats[0].color);
    }
  }

  setRgb("steady");

  return {
    root,
    props,
    screen,
    monitor,
    lamp,
    lampLight,
    tower,
    mug,
    keyboardCenter: keyboard.center,
    pressKey: keyboard.pressKey,
    setLamp,
    setRgb,
    update,
    dispose() {
      keyboard.dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}
