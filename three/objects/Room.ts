import {
  CapsuleGeometry,
  CylinderGeometry,
  type Group,
  IcosahedronGeometry,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Object3D,
  BoxGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { box, glowCard, group, mesh, palette, rbox, type Materials } from "../core/kit";
import { mulberry32 } from "../core/math";
import { createCanvas, rugTexture, toTexture, windowSkyTexture } from "../core/textures";

/**
 * The cut-away room: floor slab, two walls, window, wall decor, a corner
 * plant, a rug and the office chair. Everything is built from primitives.
 */

export const ROOM = { minX: -2.58, maxX: 2.5, minZ: -2.58, maxZ: 2.5, inner: -2.4, height: 3.2 };

export interface RoomParts {
  root: Group;
  /** Groups that pop in during the intro, in order. */
  props: Object3D[];
  duck: Group;
  plant: Group;
  neonLight: PointLight | null;
  neonMaterial: MeshBasicMaterial;
  dispose(): void;
}

function segmentTube(points: Vector3[], radius: number) {
  const parts: BufferGeometry[] = [];
  const up = new Vector3(0, 1, 0);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dir = new Vector3().subVectors(b, a);
    const len = dir.length();
    const cyl = new CylinderGeometry(radius, radius, len, 10, 1, true);
    cyl.applyQuaternion(new Quaternion().setFromUnitVectors(up, dir.normalize()));
    cyl.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(cyl);
  }
  for (const p of points) {
    const s = new SphereGeometry(radius, 10, 8);
    s.translate(p.x, p.y, p.z);
    parts.push(s);
  }
  const merged = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  parts.forEach((g) => g.dispose());
  return merged;
}

function stickyNotesTexture() {
  const { canvas, ctx } = createCanvas(768, 256);
  const notes: Array<[string, string[], number]> = [
    ["#ffe27a", ["ship it", "→ prod"], -0.05],
    ["#7ee0c3", ["LCP < 2.5s", "CLS < 0.1"], 0.04],
    ["#ffa6c9", ["drink", "water :)"], -0.02],
  ];
  notes.forEach(([color, lines, rot], i) => {
    ctx.save();
    ctx.translate(128 + i * 256, 128);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.fillRect(-108, -108, 216, 216);
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(-108, -108, 216, 26);
    ctx.fillStyle = "#26314a";
    ctx.font = "600 38px 'Comic Sans MS', 'Segoe Print', cursive, sans-serif";
    ctx.textAlign = "center";
    lines.forEach((line, j) => ctx.fillText(line, 0, 0 + j * 52));
    ctx.restore();
  });
  return toTexture(canvas);
}

export function createRoom(mats: Materials, opts: { lights: boolean; photo: string }): RoomParts {
  const disposables: Array<{ dispose(): void }> = [];
  const root = group("room");
  const props: Object3D[] = [];

  // ---- shell -------------------------------------------------------------
  const shell = group("shell");
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z
  const floorFaces: Material[] = [mats.wallEdge, mats.wallEdge, mats.floor, mats.wallEdge, mats.wallEdge, mats.wallEdge];
  const floor = box(W, 0.32, D, floorFaces, (ROOM.minX + ROOM.maxX) / 2, -0.16, (ROOM.minZ + ROOM.maxZ) / 2, {
    cast: false,
  });
  const backFaces: Material[] = [mats.wallEdge, mats.wall, mats.wallEdge, mats.wall, mats.wall, mats.wall];
  const back = box(W, ROOM.height, 0.18, backFaces, (ROOM.minX + ROOM.maxX) / 2, ROOM.height / 2, -2.49);
  const leftFaces: Material[] = [mats.wall, mats.wall, mats.wallEdge, mats.wall, mats.wallEdge, mats.wall];
  const left = box(0.18, ROOM.height, ROOM.maxZ - ROOM.inner, leftFaces, -2.49, ROOM.height / 2, (ROOM.inner + ROOM.maxZ) / 2);
  const baseBack = box(ROOM.maxX - ROOM.inner, 0.1, 0.03, mats.trim, (ROOM.inner + ROOM.maxX) / 2, 0.05, -2.385);
  const baseLeft = box(0.03, 0.1, ROOM.maxZ - ROOM.inner, mats.trim, -2.385, 0.05, (ROOM.inner + ROOM.maxZ) / 2);
  shell.add(floor, back, left, baseBack, baseLeft);
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
  const pool = glowCard("#5f86ff", 2.2, 1.5, 0.16);
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

  // ---- neon sign "</>" ----------------------------------------------------
  const neon = group("neon");
  const s = 0.22;
  const v = (x: number, y: number) => new Vector3(x * s, y * s, 0);
  const tubes = [
    segmentTube([v(-1.0, 0.85), v(-1.85, 0), v(-1.0, -0.85)], 0.02),
    segmentTube([v(0.45, 1.05), v(-0.45, -1.05)], 0.02),
    segmentTube([v(1.0, 0.85), v(1.85, 0), v(1.0, -0.85)], 0.02),
  ];
  const neonMaterial = mats.neon;
  for (const geo of tubes) neon.add(mesh(geo, neonMaterial, { cast: false, receive: false }));
  const backplate = rbox(1.0, 0.6, 0.015, 0.02, new MeshStandardMaterial({ color: "#0b1222", roughness: 0.3, transparent: true, opacity: 0.55 }), 0, 0, -0.03, { cast: false });
  neon.add(backplate);
  const neonGlow = glowCard(palette.brand, 2.4, 1.5, 0.5);
  neonGlow.position.z = -0.035;
  neon.add(neonGlow);
  neon.position.set(-1.25, 2.3, -2.33);
  root.add(neon);
  props.push(neon);
  let neonLight: PointLight | null = null;
  if (opts.lights) {
    neonLight = new PointLight(palette.brandSoft, 1.4, 3.2, 2);
    neonLight.position.set(-1.25, 2.2, -2.05);
    root.add(neonLight);
  }

  // ---- shelf with books and the rubber duck --------------------------------
  const shelf = group("shelf");
  shelf.add(
    rbox(1.2, 0.045, 0.26, 0.01, mats.wood, 1.68, 2.05, -2.27),
    box(0.03, 0.12, 0.2, mats.metalDark, 1.2, 1.97, -2.3),
    box(0.03, 0.12, 0.2, mats.metalDark, 2.16, 1.97, -2.3),
  );
  const bookColors = [palette.brand, "#ff6b6b", palette.cream, "#14b8a6", "#f5c542", "#8b5cf6"];
  const widths = [0.05, 0.045, 0.06, 0.04, 0.055, 0.045];
  const heights = [0.26, 0.22, 0.28, 0.2, 0.25, 0.23];
  let bx = 1.14;
  bookColors.forEach((color, i) => {
    const book = rbox(widths[i], heights[i], 0.18, 0.006, new MeshStandardMaterial({ color, roughness: 0.75 }), bx + widths[i] / 2, 2.0725 + heights[i] / 2, -2.28);
    if (i === bookColors.length - 1) {
      book.rotation.z = -0.32;
      book.position.x += 0.04;
      book.position.y -= 0.012;
    }
    shelf.add(book);
    bx += widths[i] + 0.006;
  });
  // rubber duck, the debugging companion
  const duck = group("duck");
  const body = mesh(new SphereGeometry(0.075, 20, 14), mats.duck);
  body.scale.set(1.25, 0.82, 1);
  const head = mesh(new SphereGeometry(0.052, 20, 14), mats.duck);
  head.position.set(0, 0.08, 0.035);
  const beak = mesh(new SphereGeometry(0.026, 12, 8), mats.orange);
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
    mesh(new CylinderGeometry(0.05, 0.04, 0.07, 14), mats.paper),
    mesh(new IcosahedronGeometry(0.05, 0), mats.leafA),
  );
  succulent.children[0].position.y = 0.035;
  succulent.children[1].position.y = 0.09;
  succulent.position.set(2.15, 2.073, -2.27);
  shelf.add(succulent);
  root.add(shelf);
  props.push(shelf);

  // ---- sticky notes ---------------------------------------------------------
  const notesTex = stickyNotesTexture();
  disposables.push(notesTex);
  const notes = group("notes");
  for (let i = 0; i < 3; i++) {
    const geo = new PlaneGeometry(0.15, 0.15);
    const uv = geo.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) + i) / 3);
    const note = mesh(geo, new MeshStandardMaterial({ map: notesTex, roughness: 0.9 }), { cast: false });
    note.position.set(1.12 + (i % 2) * 0.19, 1.6 - i * 0.12 + (i === 2 ? 0.05 : 0), -2.397);
    note.rotation.z = (i - 1) * 0.06;
    notes.add(note);
  }
  root.add(notes);
  props.push(notes);

  // ---- corner plant -----------------------------------------------------------
  const plant = group("plant");
  plant.add(
    mesh(new CylinderGeometry(0.25, 0.19, 0.46, 22), mats.pot),
    mesh(new CylinderGeometry(0.23, 0.23, 0.02, 22), new MeshStandardMaterial({ color: "#2a1a12", roughness: 1 })),
    mesh(new CylinderGeometry(0.018, 0.026, 0.7, 8), mats.woodDark),
  );
  plant.children[0].position.y = 0.23;
  plant.children[1].position.y = 0.468;
  plant.children[2].position.y = 0.8;
  const rand = mulberry32(42);
  const leafMats = [mats.leafA, mats.leafB, mats.leafC];
  const leaves = group("leaves");
  const leafGeo = new IcosahedronGeometry(1, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.4;
    const r = i < 3 ? 0.05 : 0.18 + rand() * 0.12;
    const leaf = mesh(leafGeo, leafMats[i % 3]);
    const size = 0.17 + rand() * 0.12;
    leaf.scale.set(size, size * (0.8 + rand() * 0.3), size);
    leaf.position.set(Math.cos(a) * r, 0.95 + rand() * 0.55 + (i < 3 ? 0.25 : 0), Math.sin(a) * r);
    leaf.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    leaves.add(leaf);
  }
  plant.add(leaves);
  plant.position.set(-1.92, 0, -1.92);
  root.add(plant);
  props.push(plant);

  // ---- rug ---------------------------------------------------------------------
  const rugTex = rugTexture(palette.brand);
  disposables.push(rugTex);
  const rugTop = new MeshStandardMaterial({ map: rugTex, roughness: 1 });
  const rug = mesh(new CylinderGeometry(1.2, 1.2, 0.014, 64), [mats.fabric, rugTop, rugTop], { cast: false });
  rug.position.set(0.45, 0.007, -0.7);
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
  const casterGeo = new SphereGeometry(0.034, 12, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const c = mesh(casterGeo, mats.black);
    c.position.set(Math.cos(a) * 0.29, 0.034, -Math.sin(a) * 0.29);
    chair.add(c);
  }
  const lift = mesh(new CylinderGeometry(0.026, 0.03, 0.34, 12), mats.metal);
  lift.position.y = 0.26;
  chair.add(lift);
  chair.add(rbox(0.54, 0.09, 0.52, 0.04, mats.fabric, 0, 0.47, 0));
  const backrest = group(
    "backrest",
    rbox(0.5, 0.64, 0.08, 0.04, mats.fabric, 0, 0, 0),
    box(0.08, 0.5, 0.012, mats.fabricAccent, 0, 0.02, 0.042, { cast: false }),
  );
  backrest.position.set(0, 0.92, 0.27);
  backrest.rotation.x = 0.12;
  chair.add(backrest);
  chair.add(box(0.06, 0.32, 0.04, mats.metalDark, 0, 0.64, 0.25));
  for (const side of [-1, 1]) {
    chair.add(box(0.035, 0.17, 0.035, mats.metalDark, side * 0.27, 0.6, 0.02));
    chair.add(rbox(0.07, 0.03, 0.26, 0.012, mats.plasticDark, side * 0.27, 0.69, 0.0));
  }
  chair.position.set(0.62, 0, -0.78);
  chair.rotation.y = -0.55;
  root.add(chair);
  props.push(chair);

  return {
    root,
    props,
    duck,
    plant: leaves,
    neonLight,
    neonMaterial,
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
