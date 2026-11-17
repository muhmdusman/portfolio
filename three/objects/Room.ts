import {
  BoxGeometry,
  type BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  type Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { box, glowCard, group, mesh, rbox, type Materials } from "../core/kit";
import { mulberry32 } from "../core/math";
import { createScaledCanvas, leafTexture, rugTexture, textureQuality, toTexture, windowSkyTexture } from "../core/textures";

/**
 * The closed room: floor, four walls and a ceiling, a window, wall decor, a
 * corner plant, a rug, the office chair, and on the walls behind the default
 * view a door, a clock, a sofa and a bookcase. Everything is built from primitives.
 */

/**
 * Interior of the room in metres. The inner wall faces sit at x, z = ±half,
 * the floor at y = 0 and the ceiling at y = height.
 */
export const ROOM = { half: 2.4, height: 3.2, wall: 0.18 };

/** Where the office chair stands: at the desk, or rolled aside for the desk close-ups. */
export const CHAIR_POSES = {
  desk: { x: 0.62, z: -0.78, rot: -0.55 },
  aside: { x: -0.25, z: -0.32, rot: 0.35 },
};

export interface RoomParts {
  root: Group;
  /** Groups that pop in during the intro, in order. */
  props: Object3D[];
  duck: Group;
  chair: Group;
  plant: Group;
  /** Moves the clock hands; cheap enough to call every frame. */
  update(): void;
  dispose(): void;
}

function stickyNotesTexture() {
  const { canvas, ctx } = createScaledCanvas(768, 256);
  const notes: Array<[string, string[], number]> = [
    ["#f4e39a", ["ship friday", "no heroics"], -0.04],
    ["#efe0a2", ["lcp  <  2.5s", "cls  <  0.1"], 0.035],
    ["#f7e7b0", ["water", "the plant"], -0.02],
  ];
  const rand = mulberry32(15);
  notes.forEach(([color, lines, rot], i) => {
    ctx.save();
    ctx.translate(128 + i * 256, 128);
    ctx.rotate(rot);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(-100, -96, 216, 216);
    ctx.fillStyle = color;
    ctx.fillRect(-108, -108, 216, 216);
    ctx.fillStyle = "rgba(180,150,60,0.35)";
    ctx.fillRect(-108, -108, 216, 18);
    for (let n = 0; n < 40; n++) {
      ctx.fillStyle = "rgba(80,60,20,0.05)";
      ctx.fillRect(-100 + rand() * 200, -90 + rand() * 190, 2, 1);
    }
    ctx.fillStyle = "#3a3428";
    ctx.font = "500 34px ui-sans-serif, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    lines.forEach((line, j) => ctx.fillText(line, 0, -6 + j * 48));
    ctx.restore();
  });
  return toTexture(canvas);
}

/** Merges boxes into one mesh, each tinted through a vertex color (one draw call). */
function tintedBoxes(items: Array<{ size: [number, number, number]; pos: [number, number, number]; rotZ?: number; color: string }>) {
  const color = new Color();
  const parts = items.map(({ size, pos, rotZ = 0, color: hex }) => {
    const g = new BoxGeometry(...size);
    if (rotZ) g.rotateZ(rotZ);
    g.translate(...pos);
    color.set(hex);
    const count = g.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}

const BOOK_COLORS = ["#3d5a80", "#c45c4a", "#e6dcc8", "#2f6f62", "#c6a15b", "#5c4d7a", "#3a4e72", "#b56a52", "#2a3550"];

/** A painted panel door with a cream frame, on the right wall. */
function buildDoor(mats: Materials, z: number) {
  const door = group("door");
  const x = ROOM.half;
  const w = 0.9;
  const h = 2.1;
  const paint = new MeshStandardMaterial({ color: "#2a3f69", roughness: 0.6 });
  const inset = new MeshStandardMaterial({ color: "#243860", roughness: 0.65 });
  const open = { cast: false };
  door.add(
    box(0.04, h, w, paint, x - 0.02, h / 2, z, open),
    // two recessed panels
    box(0.012, 0.86, w - 0.26, inset, x - 0.045, 1.5, z, open),
    box(0.012, 0.74, w - 0.26, inset, x - 0.045, 0.52, z, open),
    // frame
    box(0.05, h + 0.07, 0.07, mats.frame, x - 0.025, (h + 0.07) / 2, z - w / 2 - 0.035, open),
    box(0.05, h + 0.07, 0.07, mats.frame, x - 0.025, (h + 0.07) / 2, z + w / 2 + 0.035, open),
    box(0.05, 0.07, w + 0.14, mats.frame, x - 0.025, h + 0.035, z, open),
  );
  // lever handle on a round rose
  const rose = mesh(new CylinderGeometry(0.028, 0.028, 0.012, 16), mats.metal, open);
  rose.rotation.z = Math.PI / 2;
  rose.position.set(x - 0.046, 1.02, z - w / 2 + 0.09);
  const lever = rbox(0.022, 0.022, 0.12, 0.008, mats.metal, x - 0.062, 1.02, z - w / 2 + 0.14, open);
  door.add(rose, lever);
  // light switch beside the frame
  door.add(rbox(0.012, 0.11, 0.075, 0.006, mats.plasticLight, x - 0.006, 1.22, z - w / 2 - 0.22, open));
  return { door, materials: [paint, inset] };
}

/** A wall clock on the right wall that shows Usman's local time. */
function buildClock(mats: Materials, z: number, timeZone: string) {
  const clock = group("clock");
  const x = ROOM.half;
  const y = 2.2;
  const r = 0.24;
  const open = { cast: false };
  const rim = mesh(new CylinderGeometry(r + 0.02, r + 0.02, 0.05, 32), mats.plasticDark, open);
  rim.rotation.z = Math.PI / 2;
  rim.position.set(x - 0.025, y, z);
  const face = mesh(new CylinderGeometry(r, r, 0.01, 32), mats.paper, open);
  face.rotation.z = Math.PI / 2;
  face.position.set(x - 0.052, y, z);
  clock.add(rim, face);
  const ticks: BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const long = i % 3 === 0;
    const t = new BoxGeometry(0.006, long ? 0.05 : 0.025, long ? 0.016 : 0.01);
    t.translate(0, r - (long ? 0.04 : 0.028), 0);
    t.rotateX(a);
    ticks.push(t);
  }
  const tickGeo = mergeGeometries(ticks);
  ticks.forEach((g) => g.dispose());
  const tickMesh = mesh(tickGeo, mats.plasticDark, open);
  tickMesh.position.set(x - 0.06, y, z);
  clock.add(tickMesh);
  // Hands turn about the wall normal; seen from the room, +x rotation is clockwise.
  const hand = (length: number, width: number, material: MeshStandardMaterial, offset: number) => {
    const pivot = group("hand");
    const m = box(0.006, length, width, material, 0, length / 2 - 0.03, 0, open);
    pivot.add(m);
    pivot.position.set(x - 0.066 - offset, y, z);
    clock.add(pivot);
    return pivot;
  };
  const hourHand = hand(0.14, 0.018, mats.plasticDark, 0);
  const minuteHand = hand(0.2, 0.012, mats.plasticDark, 0.006);
  const secondHand = hand(0.21, 0.004, mats.orange, 0.012);
  const cap = mesh(new CylinderGeometry(0.014, 0.014, 0.02, 24), mats.orange, open);
  cap.rotation.z = Math.PI / 2;
  cap.position.set(x - 0.08, y, z);
  clock.add(cap);

  const format = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", minute: "numeric", second: "numeric", hour12: false });
  let lastSecond = -1;
  const update = () => {
    const now = new Date();
    const second = now.getSeconds();
    if (second === lastSecond) return;
    lastSecond = second;
    let h = 0;
    let m = 0;
    for (const part of format.formatToParts(now)) {
      if (part.type === "hour") h = Number(part.value);
      else if (part.type === "minute") m = Number(part.value);
    }
    const turn = Math.PI * 2;
    secondHand.rotation.x = (second / 60) * turn;
    minuteHand.rotation.x = ((m + second / 60) / 60) * turn;
    hourHand.rotation.x = (((h % 12) + m / 60) / 12) * turn;
  };
  update();
  return { clock, update };
}

/** A tall bookcase against the front wall, its books merged into one mesh. */
function buildBookcase(mats: Materials, cx: number) {
  const shelf = group("bookcase");
  const w = 1.3;
  const h = 2.02;
  const d = 0.32;
  const t = 0.028;
  const back = ROOM.half;
  const front = back - d;
  const zc = back - d / 2;
  const open = { cast: false };
  const boards = [0.07, 0.56, 1.05, 1.54, h - t / 2];
  const frameParts: BufferGeometry[] = [
    new BoxGeometry(t, h, d).translate(cx - w / 2 + t / 2, h / 2, zc),
    new BoxGeometry(t, h, d).translate(cx + w / 2 - t / 2, h / 2, zc),
    new BoxGeometry(w, h, 0.012).translate(cx, h / 2, back - 0.006),
    ...boards.map((y) => new BoxGeometry(w - 2 * t, t, d - 0.012).translate(cx, y, zc - 0.006)),
  ];
  const frame = mesh(mergeGeometries(frameParts), mats.wood, open);
  frameParts.forEach((g) => g.dispose());
  shelf.add(frame);

  const rand = mulberry32(64);
  const books: Parameters<typeof tintedBoxes>[0] = [];
  const left = cx - w / 2 + t;
  const right = cx + w / 2 - t;
  for (let s = 0; s < boards.length - 1; s++) {
    const floor = boards[s] + t / 2;
    const clear = boards[s + 1] - boards[s] - t;
    let bx = left + 0.02 + rand() * 0.05;
    // every shelf leaves a gap somewhere for a stack of books lying flat
    const gapAt = left + 0.25 + rand() * (w - 0.7);
    let stacked = false;
    while (bx < right - 0.06) {
      const color = BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)];
      if (!stacked && bx > gapAt) {
        stacked = true;
        let y = floor;
        const n = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) {
          const bh = 0.035 + rand() * 0.02;
          books.push({ size: [0.24 - i * 0.012, bh, 0.19], pos: [bx + 0.13, y + bh / 2, front + 0.03 + 0.095], color: BOOK_COLORS[(i * 3 + s) % BOOK_COLORS.length] });
          y += bh;
        }
        bx += 0.3;
        continue;
      }
      const bw = 0.028 + rand() * 0.032;
      const bh = Math.min(clear - 0.04, 0.24 + rand() * 0.16);
      const bd = 0.2 + rand() * 0.06;
      const lean = rand() > 0.9 && bx < right - 0.2;
      books.push({
        size: [bw, bh, bd],
        pos: [bx + bw / 2 + (lean ? 0.04 : 0), floor + bh / 2 - (lean ? 0.012 : 0), front + 0.025 + bd / 2],
        rotZ: lean ? -0.3 : 0,
        color,
      });
      bx += bw + 0.004 + (lean ? 0.1 : 0);
    }
  }
  const bookMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  shelf.add(mesh(tintedBoxes(books), bookMat, open));
  return { shelf, materials: [bookMat] };
}

/** A two-seat sofa against the front wall, on the window side. */
function buildSofa(mats: Materials, cx: number) {
  const sofa = group("sofa");
  const fabric = new MeshStandardMaterial({ color: "#33456d", roughness: 0.95 });
  const w = 1.8;
  const d = 0.86;
  const back = ROOM.half;
  const zc = back - d / 2 - 0.02;
  const open = { cast: false };
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      sofa.add(box(0.05, 0.08, 0.05, mats.woodDark, cx + sx * (w / 2 - 0.08), 0.04, zc + sz * (d / 2 - 0.08), open));
    }
  }
  sofa.add(
    rbox(w, 0.24, d, 0.05, fabric, cx, 0.2, zc, open),
    rbox(w, 0.52, 0.2, 0.07, fabric, cx, 0.58, back - 0.12, open),
    rbox(0.18, 0.42, d, 0.07, fabric, cx - w / 2 + 0.09, 0.44, zc, open),
    rbox(0.18, 0.42, d, 0.07, fabric, cx + w / 2 - 0.09, 0.44, zc, open),
  );
  for (const sx of [-1, 1]) {
    sofa.add(rbox(0.7, 0.14, 0.66, 0.06, fabric, cx + sx * 0.36, 0.38, zc - 0.07, open));
    const cushion = rbox(0.66, 0.4, 0.14, 0.06, fabric, cx + sx * 0.36, 0.62, back - 0.27, open);
    cushion.rotation.x = 0.16;
    sofa.add(cushion);
  }
  const pillow = rbox(0.34, 0.32, 0.12, 0.06, mats.fabricAccent, cx - 0.52, 0.6, back - 0.4, open);
  pillow.rotation.set(0.25, 0.25, -0.12);
  sofa.add(pillow);
  return { sofa, materials: [fabric] };
}

/** A recessed ceiling can: metal trim, warm diffuser, a small pool of light. No coloured ring. */
function buildCeilingLight(mats: Materials, x: number, z: number) {
  const light = group("ceiling-light");
  const y = ROOM.height;
  const open = { cast: false, receive: false };
  const trim = mesh(new TorusGeometry(0.16, 0.012, 8, 28), mats.metal, open);
  trim.rotation.x = Math.PI / 2;
  trim.position.set(x, y - 0.01, z);
  const diffuser = mesh(new CircleGeometry(0.145, 24), new MeshBasicMaterial({ color: "#fff1d6", toneMapped: false }), open);
  diffuser.rotation.x = Math.PI / 2;
  diffuser.position.set(x, y - 0.018, z);
  const wash = glowCard("#ffe7c2", 1.5, 1.5, 0.1);
  wash.rotation.x = Math.PI / 2;
  wash.position.set(x, y - 0.03, z);
  light.add(trim, diffuser, wash);
  return light;
}

export function createRoom(mats: Materials, opts: { photo: string; timeZone: string }): RoomParts {
  const disposables: Array<{ dispose(): void }> = [];
  const root = group("room");
  const props: Object3D[] = [];

  // ---- shell -------------------------------------------------------------
  // The key light shines in from the front-right, so only the back and left
  // walls cast shadows; the front and right walls and the ceiling let it through.
  const shell = group("shell");
  const { half, height: H, wall: T } = ROOM;
  const outer = 2 * (half + T);
  const ceilingMat = new MeshStandardMaterial({ color: "#16233e", roughness: 0.95 });
  disposables.push(ceilingMat);
  const open = { cast: false };
  shell.add(
    box(outer, 0.32, outer, mats.floor, 0, -0.16, 0, open),
    box(outer, H, T, mats.wall, 0, H / 2, -(half + T / 2)),
    box(T, H, 2 * half, mats.wall, -(half + T / 2), H / 2, 0),
    box(T, H, 2 * half, mats.wall, half + T / 2, H / 2, 0, open),
    box(outer, H, T, mats.wall, 0, H / 2, half + T / 2, open),
    box(outer, 0.12, outer, ceilingMat, 0, H + 0.06, 0, open),
  );
  // skirting boards and a slim cornice where the walls meet the ceiling
  for (const [y, h] of [
    [0.05, 0.1],
    [H - 0.025, 0.05],
  ]) {
    const edge = half - 0.015;
    shell.add(
      box(2 * half, h, 0.03, mats.trim, 0, y, -edge, open),
      box(2 * half, h, 0.03, mats.trim, 0, y, edge, open),
      box(0.03, h, 2 * half, mats.trim, -edge, y, 0, open),
      box(0.03, h, 2 * half, mats.trim, edge, y, 0, open),
    );
  }
  root.add(shell);

  // ---- window --------------------------------------------------------------
  const win = group("window");
  const sky = windowSkyTexture();
  disposables.push(sky);
  const glass = mesh(new PlaneGeometry(1.3, 1.2), new MeshBasicMaterial({ map: sky, toneMapped: false }), {
    cast: false,
    receive: false,
  });
  glass.rotation.y = Math.PI / 2;
  glass.position.set(-2.396, 1.78, 0.9);
  const fx = -2.37;
  win.add(
    glass,
    box(0.06, 0.07, 1.44, mats.frame, fx, 2.415, 0.9),
    box(0.06, 0.07, 1.44, mats.frame, fx, 1.145, 0.9),
    box(0.06, 1.3, 0.07, mats.frame, fx, 1.78, 0.215),
    box(0.06, 1.3, 0.07, mats.frame, fx, 1.78, 1.585),
    box(0.04, 1.2, 0.035, mats.frame, fx, 1.78, 0.9),
    box(0.04, 0.035, 1.3, mats.frame, fx, 1.78, 0.9),
    box(0.2, 0.05, 1.56, mats.frame, -2.31, 1.095, 0.9),
  );
  // tiny cactus on the sill
  const cactus = group(
    "cactus",
    mesh(new CylinderGeometry(0.055, 0.045, 0.09, 14), mats.pot),
    mesh(new CapsuleGeometry(0.035, 0.08, 4, 10), mats.leafB),
    mesh(new CapsuleGeometry(0.018, 0.03, 4, 8), mats.leafB),
  );
  cactus.children[0].position.y = 0.045;
  cactus.children[1].position.y = 0.16;
  cactus.children[2].position.set(0.045, 0.17, 0);
  cactus.children[2].rotation.z = -0.9;
  cactus.position.set(-2.3, 1.12, 1.3);
  win.add(cactus);
  // moonlight pool on the floor
  const pool = glowCard("#9eb6e0", 1.6, 1.1, 0.07);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(-1.55, 0.004, 0.9);
  win.add(pool);
  root.add(win);
  props.push(win);

  // ---- framed photo -------------------------------------------------------
  const photo = group("photo");
  const loader = new TextureLoader();
  const photoMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 });
  loader.load(opts.photo, (tex: Texture) => {
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = textureQuality.anisotropy;
    photoMat.map = tex;
    photoMat.needsUpdate = true;
    disposables.push(tex);
  });
  const frameBox = rbox(0.05, 0.8, 0.8, 0.012, mats.frame, -2.375, 1.85, -0.85);
  const matBoard = mesh(new PlaneGeometry(0.7, 0.7), mats.paper, { cast: false });
  matBoard.rotation.y = Math.PI / 2;
  matBoard.position.set(-2.348, 1.85, -0.85);
  const picture = mesh(new PlaneGeometry(0.6, 0.6), photoMat, { cast: false });
  picture.rotation.y = Math.PI / 2;
  picture.position.set(-2.346, 1.85, -0.85);
  photo.add(frameBox, matBoard, picture);
  root.add(photo);
  props.push(photo);

  // ---- framed print above the desk (quiet; no neon, no extra light) --------
  const print = group("print");
  const { canvas: printCanvas, ctx: printCtx } = createScaledCanvas(640, 360);
  const printSky = printCtx.createLinearGradient(0, 0, 0, 360);
  printSky.addColorStop(0, "#243044");
  printSky.addColorStop(0.55, "#1a2434");
  printSky.addColorStop(1, "#121820");
  printCtx.fillStyle = printSky;
  printCtx.fillRect(0, 0, 640, 360);
  printCtx.fillStyle = "rgba(210, 220, 230, 0.16)";
  for (let i = 0; i < 5; i++) printCtx.fillRect(48 + i * 112, 48, 78, 210);
  printCtx.fillStyle = "rgba(255, 236, 200, 0.28)";
  printCtx.fillRect(272, 78, 78, 180);
  const printRand = mulberry32(19);
  for (let i = 0; i < 500; i++) {
    printCtx.fillStyle = `rgba(255,255,255,${printRand() * 0.04})`;
    printCtx.fillRect(printRand() * 640, printRand() * 360, 1, 1);
  }
  const printTex = toTexture(printCanvas);
  const printMat = new MeshStandardMaterial({ map: printTex, roughness: 0.82 });
  disposables.push(printTex, printMat);
  const printW = 0.7;
  const printH = 0.39;
  const printArt = mesh(new PlaneGeometry(printW, printH), printMat, { cast: false });
  printArt.position.z = 0.011;
  print.add(rbox(printW + 0.04, printH + 0.04, 0.018, 0.004, mats.frame, 0, 0, 0, { cast: false }, 2), printArt);
  print.position.set(0.42, 2.3, -2.388);
  root.add(print);
  props.push(print);

  // ---- shelf with books and the rubber duck --------------------------------
  const shelf = group("shelf");
  shelf.add(
    rbox(1.2, 0.045, 0.26, 0.01, mats.wood, 1.68, 2.05, -2.27),
    box(0.03, 0.12, 0.2, mats.metalDark, 1.2, 1.97, -2.3),
    box(0.03, 0.12, 0.2, mats.metalDark, 2.16, 1.97, -2.3),
  );
  const bookColors = ["#3d5a80", "#c45c4a", "#e6dcc8", "#2f6f62", "#c6a15b", "#5c4d7a"];
  const widths = [0.05, 0.045, 0.06, 0.04, 0.055, 0.045];
  const heights = [0.26, 0.22, 0.28, 0.2, 0.25, 0.23];
  const shelfBooks: Parameters<typeof tintedBoxes>[0] = [];
  let bx = 1.14;
  bookColors.forEach((color, i) => {
    const lean = i === bookColors.length - 1;
    const bw = widths[i];
    const bh = heights[i];
    shelfBooks.push({
      size: [bw, bh, 0.18],
      pos: [bx + bw / 2 + (lean ? 0.04 : 0), 2.0725 + bh / 2 - (lean ? 0.012 : 0), -2.28],
      rotZ: lean ? -0.32 : 0,
      color,
    });
    bx += bw + 0.006;
  });
  const shelfBookMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.78 });
  disposables.push(shelfBookMat);
  shelf.add(mesh(tintedBoxes(shelfBooks), shelfBookMat));
  // rubber duck, the debugging companion
  const duck = group("duck");
  const body = mesh(new SphereGeometry(0.075, 16, 12), mats.duck);
  body.scale.set(1.25, 0.82, 1);
  const head = mesh(new SphereGeometry(0.052, 16, 12), mats.duck);
  head.position.set(0, 0.08, 0.035);
  const beak = mesh(new SphereGeometry(0.026, 10, 8), mats.orange);
  beak.scale.set(1.2, 0.45, 1.3);
  beak.position.set(0, 0.07, 0.085);
  const eyeGeo = new SphereGeometry(0.008, 8, 6);
  const eyeL = mesh(eyeGeo, mats.black, { cast: false });
  eyeL.position.set(-0.022, 0.097, 0.077);
  const eyeR = mesh(eyeGeo, mats.black, { cast: false });
  eyeR.position.set(0.022, 0.097, 0.077);
  const tail = mesh(new SphereGeometry(0.03, 10, 8), mats.duck);
  tail.position.set(0, 0.03, -0.085);
  tail.scale.set(0.8, 0.6, 1);
  duck.add(body, head, beak, eyeL, eyeR, tail);
  duck.position.set(1.95, 2.135, -2.24);
  duck.rotation.y = 0.55;
  shelf.add(duck);
  // succulent
  const succulent = group(
    "succulent",
    mesh(new CylinderGeometry(0.05, 0.04, 0.07, 12), mats.paper),
    mesh(new SphereGeometry(0.05, 16, 12), mats.leafA),
  );
  succulent.children[0].position.y = 0.035;
  succulent.children[1].position.y = 0.09;
  succulent.position.set(2.15, 2.073, -2.27);
  shelf.add(succulent);
  root.add(shelf);
  props.push(shelf);

  // ---- sticky notes ---------------------------------------------------------
  const notesTex = stickyNotesTexture();
  const noteMat = new MeshStandardMaterial({ map: notesTex, roughness: 0.92 });
  disposables.push(notesTex, noteMat);
  const notes = group("notes");
  for (let i = 0; i < 3; i++) {
    const geo = new PlaneGeometry(0.15, 0.15);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 3);
    const note = mesh(geo, noteMat, { cast: false });
    note.position.set(1.32 + (i % 2) * 0.19, 1.6 - i * 0.12 + (i === 2 ? 0.05 : 0), -2.397);
    note.rotation.z = (i - 1) * 0.06;
    notes.add(note);
  }
  root.add(notes);
  props.push(notes);

  // ---- corner plant: instanced leaf cards instead of blob spheres -----------
  const plant = group("plant");
  const soil = new MeshStandardMaterial({ color: "#2a1a12", roughness: 1 });
  disposables.push(soil);
  plant.add(
    mesh(new CylinderGeometry(0.22, 0.17, 0.38, 20), mats.pot),
    mesh(new CylinderGeometry(0.2, 0.2, 0.018, 20), soil),
    mesh(new TorusGeometry(0.21, 0.012, 8, 24), mats.pot),
  );
  plant.children[0].position.y = 0.19;
  plant.children[1].position.y = 0.37;
  plant.children[2].position.y = 0.375;
  plant.children[2].rotation.x = Math.PI / 2;
  const rand = mulberry32(42);
  const leafMap = leafTexture();
  const leafMat = new MeshStandardMaterial({
    map: leafMap,
    alphaTest: 0.45,
    roughness: 0.78,
    side: DoubleSide,
    color: "#ffffff",
  });
  disposables.push(leafMap, leafMat);
  const leafCount = 14;
  const foliage = new InstancedMesh(new PlaneGeometry(0.2, 0.34), leafMat, leafCount);
  foliage.castShadow = false;
  foliage.receiveShadow = false;
  const leafMatrix = new Matrix4();
  const leafQuat = new Quaternion();
  const leafEuler = new Euler();
  const leafScale = new Vector3();
  const leafTint = [new Color("#2f8f52"), new Color("#3aaa64"), new Color("#1f6e40"), new Color("#267848")];
  const stems: BufferGeometry[] = [];
  for (let i = 0; i < leafCount; i++) {
    const a = (i / leafCount) * Math.PI * 2 + rand() * 0.35;
    const radius = i < 3 ? 0.025 : 0.1 + rand() * 0.1;
    const h = 0.58 + rand() * 0.36 + (i < 3 ? 0.12 : 0);
    const s = 0.72 + rand() * 0.45;
    leafEuler.set(-0.3 - rand() * 0.5, a, (rand() - 0.5) * 0.5);
    leafQuat.setFromEuler(leafEuler);
    leafScale.set(s * (0.7 + rand() * 0.25), s, 1);
    leafMatrix.compose(new Vector3(Math.cos(a) * radius, h, Math.sin(a) * radius), leafQuat, leafScale);
    foliage.setMatrixAt(i, leafMatrix);
    foliage.setColorAt(i, leafTint[i % leafTint.length]);
    const stemLen = Math.max(0.12, h - 0.36);
    const stem = new CylinderGeometry(0.005, 0.008, stemLen, 5);
    const tilt = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      new Vector3(Math.cos(a) * radius, stemLen, Math.sin(a) * radius).normalize(),
    );
    stem.applyQuaternion(tilt);
    stem.translate((Math.cos(a) * radius) / 2, 0.36 + stemLen / 2, (Math.sin(a) * radius) / 2);
    stems.push(stem);
  }
  foliage.instanceMatrix.needsUpdate = true;
  if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
  // Instance matrices sit well outside the plane's own bounds.
  foliage.frustumCulled = false;
  const stemGeo = mergeGeometries(stems);
  stems.forEach((g) => g.dispose());
  const leaves = group("leaves", mesh(stemGeo, mats.woodDark, { cast: false }), foliage);
  plant.add(leaves);
  plant.position.set(-1.9, 0, -1.9);
  root.add(plant);
  props.push(plant);

  // ---- rug ---------------------------------------------------------------------
  const rugTex = rugTexture();
  const rugMat = new MeshStandardMaterial({ map: rugTex, roughness: 0.96 });
  const rugSide = new MeshStandardMaterial({ color: "#1c2636", roughness: 0.96 });
  disposables.push(rugTex, rugMat, rugSide);
  const rug = mesh(new BoxGeometry(2.05, 0.012, 1.38), [rugSide, rugSide, rugMat, rugSide, rugSide, rugSide], { cast: false });
  rug.position.set(0.4, 0.006, -0.62);
  root.add(rug);
  props.push(rug);

  // ---- office chair --------------------------------------------------------------
  const chair = group("chair");
  const starParts: BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const arm = new BoxGeometry(0.3, 0.035, 0.05);
    arm.translate(0.15, 0, 0);
    arm.rotateY((i / 5) * Math.PI * 2);
    starParts.push(arm);
  }
  const star = mesh(mergeGeometries(starParts), mats.metalDark);
  starParts.forEach((g) => g.dispose());
  star.position.y = 0.075;
  chair.add(star);
  const casterGeo = new SphereGeometry(0.034, 10, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const c = mesh(casterGeo, mats.black, { cast: false });
    c.position.set(Math.cos(a) * 0.29, 0.034, -Math.sin(a) * 0.29);
    chair.add(c);
  }
  const lift = mesh(new CylinderGeometry(0.026, 0.03, 0.34, 10), mats.metal);
  lift.position.y = 0.26;
  chair.add(lift);
  chair.add(rbox(0.54, 0.09, 0.52, 0.04, mats.fabric, 0, 0.47, 0));
  const backrest = group("backrest", rbox(0.5, 0.64, 0.08, 0.04, mats.fabric, 0, 0, 0));
  backrest.position.set(0, 0.92, 0.27);
  backrest.rotation.x = 0.12;
  chair.add(backrest);
  chair.add(box(0.06, 0.32, 0.04, mats.metalDark, 0, 0.64, 0.25));
  for (const side of [-1, 1]) {
    chair.add(box(0.035, 0.17, 0.035, mats.metalDark, side * 0.27, 0.6, 0.02));
    chair.add(rbox(0.07, 0.03, 0.26, 0.012, mats.plasticDark, side * 0.27, 0.69, 0.0));
  }
  chair.position.set(CHAIR_POSES.desk.x, 0, CHAIR_POSES.desk.z);
  chair.rotation.y = CHAIR_POSES.desk.rot;
  root.add(chair);
  props.push(chair);

  // ---- the walls behind the default view (seen when dragging around) -------------
  const { door, materials: doorMats } = buildDoor(mats, 1.15);
  const { clock, update: updateClock } = buildClock(mats, -0.45, opts.timeZone);
  const { shelf: bookcase, materials: bookMats } = buildBookcase(mats, 0.95);
  const { sofa, materials: sofaMats } = buildSofa(mats, -1.25);
  const ceilingLight = buildCeilingLight(mats, 0.2, -0.1);
  disposables.push(...doorMats, ...bookMats, ...sofaMats);
  root.add(door, clock, bookcase, sofa, ceilingLight);
  props.push(sofa, bookcase, door, clock);

  return {
    root,
    props,
    duck,
    chair,
    plant: leaves,
    update: updateClock,
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
