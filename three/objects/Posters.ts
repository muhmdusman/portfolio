import { type Group, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from "three";
import { box, glowCard, group, mesh, palette, rbox } from "../core/kit";
import { mulberry32 } from "../core/math";
import { createScaledCanvas, roundRect, toTexture } from "../core/textures";

/**
 * Two framed typographic posters with Usman's mottos, drawn into canvases
 * (1024 x 1396 px on desktop) and lit by small picture lights.
 */

const PW = 512; // logical poster size (px), 0.62 x 0.845 m in the room
const PH = 698;

type Ctx = CanvasRenderingContext2D;

/** Largest font size (up to `max`) at which `text` fits in `width`. */
function fitSize(ctx: Ctx, text: string, font: (size: number) => string, width: number, max: number) {
  ctx.font = font(100);
  const w = ctx.measureText(text).width;
  return Math.min(max, (100 * width) / w);
}

function drawMark(ctx: Ctx, x: number, y: number, size: number, fill: string, stroke: string) {
  const k = size / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  roundRect(ctx, 0, 0, 64, 64, 15);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineCap = "round";
  ctx.lineWidth = 7.5;
  ctx.beginPath();
  ctx.moveTo(20, 15);
  ctx.lineTo(20, 33.5);
  ctx.arc(32, 33.5, 12, Math.PI, 0, true);
  ctx.lineTo(44, 15);
  ctx.stroke();
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(32, 31);
  ctx.lineTo(32, 40);
  ctx.stroke();
  ctx.restore();
}

/** "BE WHAT YOU WANT TO BE": a night sky with a retro sunrise over mountains. */
function aspirePoster(sans: string, mono: string) {
  const { canvas, ctx } = createScaledCanvas(PW, PH);
  const sky = ctx.createLinearGradient(0, 0, 0, PH);
  sky.addColorStop(0, "#081634");
  sky.addColorStop(0.5, "#16286a");
  sky.addColorStop(0.78, "#3b2470");
  sky.addColorStop(1, "#1a1036");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, PW, PH);

  const rand = mulberry32(21);
  for (let i = 0; i < 90; i++) {
    const r = rand() > 0.92 ? 1.6 : 0.8;
    ctx.fillStyle = `rgba(255,255,255,${0.35 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(rand() * PW, rand() * PH * 0.62, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // sun with a glow and retro stripes
  const sx = PW / 2;
  const sy = PH * 0.74;
  const sr = PW * 0.3;
  const halo = ctx.createRadialGradient(sx, sy, sr * 0.6, sx, sy, sr * 2.1);
  halo.addColorStop(0, "rgba(255,140,120,0.45)");
  halo.addColorStop(1, "rgba(255,140,120,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, sy - sr * 2.1, PW, sr * 4.2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.clip();
  const sun = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
  sun.addColorStop(0, "#ffd36b");
  sun.addColorStop(0.55, "#ff8a5c");
  sun.addColorStop(1, "#ff4f8b");
  ctx.fillStyle = sun;
  ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 6; i++) {
    const y = sy + i * sr * 0.16;
    ctx.fillRect(sx - sr, y, sr * 2, 3 + i * 1.6);
  }
  ctx.restore();

  // mountains
  const ridge = (base: number, peaks: Array<[number, number]>, color: string) => {
    ctx.beginPath();
    ctx.moveTo(0, PH);
    ctx.lineTo(0, base);
    for (const [x, y] of peaks) ctx.lineTo(x * PW, y * PH);
    ctx.lineTo(PW, base);
    ctx.lineTo(PW, PH);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  ridge(PH * 0.8, [[0.12, 0.74], [0.27, 0.8], [0.44, 0.7], [0.6, 0.79], [0.78, 0.72], [0.92, 0.78]], "#2a1a55");
  ridge(PH * 0.86, [[0.18, 0.82], [0.35, 0.88], [0.52, 0.8], [0.7, 0.87], [0.86, 0.82]], "#140d33");
  ctx.fillStyle = "#0b0822";
  ctx.fillRect(0, PH * 0.93, PW, PH * 0.07);

  // headline
  const pad = 40;
  const bold = (s: number) => `700 ${s}px ${sans}`;
  const lines = ["BE WHAT", "YOU WANT", "TO BE."];
  const size = Math.min(...lines.map((l) => fitSize(ctx, l, bold, PW - pad * 2, 96)));
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 12;
  lines.forEach((line, i) => {
    ctx.font = bold(size);
    ctx.fillText(line, pad - 2, 150 + i * size * 0.98);
  });
  ctx.shadowBlur = 0;

  ctx.font = `500 15px ${mono}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("NO. 01", pad, 54);
  ctx.textAlign = "right";
  ctx.fillText("MOTTO", PW - pad, 54);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(pad, 70, PW - pad * 2, 1.5);
  drawMark(ctx, PW - pad - 30, PH - 58, 30, "#0788ff", "#ffffff");
  return canvas;
}

/** "HARDWORK · FAITH · DISCIPLINE": a Swiss-style type poster on warm paper. */
function principlesPoster(sans: string, mono: string) {
  const { canvas, ctx } = createScaledCanvas(PW, PH);
  ctx.fillStyle = "#efe8da";
  ctx.fillRect(0, 0, PW, PH);
  const rand = mulberry32(8);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.25)";
    ctx.fillRect(rand() * PW, rand() * PH, 1, 1);
  }

  const pad = 36;
  const inner = PW - pad * 2;
  ctx.font = `500 15px ${mono}`;
  ctx.fillStyle = "#1b2233";
  ctx.fillText("NO. 02", pad, 54);
  ctx.textAlign = "right";
  ctx.fillText("MOTTO", PW - pad, 54);
  ctx.textAlign = "left";
  ctx.fillRect(pad, 70, inner, 2);

  const bold = (s: number) => `700 ${s}px ${sans}`;
  const words: Array<[string, string]> = [
    ["HARDWORK", "#0f1626"],
    ["FAITH", "#0788ff"],
    ["DISCIPLINE", "#0f1626"],
  ];
  const sizes = words.map(([w]) => fitSize(ctx, w, bold, inner, 150));
  const gap = 34;
  const total = sizes.reduce((a, s) => a + s * 0.78, 0) + gap * (words.length - 1);
  let y = 70 + (PH - 70 - 80 - total) / 2;
  words.forEach(([word, color], i) => {
    const s = sizes[i];
    y += s * 0.78;
    ctx.font = bold(s);
    ctx.fillStyle = color;
    ctx.fillText(word, pad - s * 0.04, y);
    if (i < words.length - 1) {
      ctx.fillStyle = "#1b2233";
      ctx.font = `500 13px ${mono}`;
      ctx.fillText(`0${i + 1}`, pad, y + gap * 0.62);
      ctx.fillRect(pad + 30, y + gap * 0.5, inner - 30, 1.5);
    }
    y += gap;
  });

  ctx.fillStyle = "#1b2233";
  ctx.fillRect(pad, PH - 80, inner, 2);
  ctx.font = `500 13px ${mono}`;
  ctx.fillText("03", pad, PH - 52);
  drawMark(ctx, PW - pad - 30, PH - 66, 30, "#0f1626", "#efe8da");
  return canvas;
}

export interface PosterParts {
  root: Group;
  items: Array<{ object: Group; quote: string }>;
  /** Starts the "swing on its nail" animation. */
  wobble(index: number): void;
  update(dt: number): void;
  dispose(): void;
}

export function createPosters(opts: { fonts: { sans: string; mono: string } }): PosterParts {
  const root = group("posters");
  const disposables: Array<{ dispose(): void }> = [];
  const width = 0.62;
  const height = (width * PH) / PW;
  const specs = [
    { canvas: aspirePoster(opts.fonts.sans, opts.fonts.mono), x: -1.86, quote: "“Be what you want to be”" },
    { canvas: principlesPoster(opts.fonts.sans, opts.fonts.mono), x: -1.08, quote: "Hardwork · Faith · Discipline" },
  ];
  const y = 1.98;
  const items: PosterParts["items"] = [];
  const swings: Array<{ object: Group; t: number }> = [];
  const frameMat = new MeshStandardMaterial({ color: "#14161c", roughness: 0.5, metalness: 0.2 });
  const brass = new MeshStandardMaterial({ color: "#c9a25b", roughness: 0.35, metalness: 0.85 });
  disposables.push(frameMat, brass);

  specs.forEach((spec) => {
    const texture = toTexture(spec.canvas);
    const material = new MeshStandardMaterial({
      map: texture,
      roughness: 0.75,
      emissive: "#ffffff",
      emissiveMap: texture,
      emissiveIntensity: 0.32,
    });
    disposables.push(texture, material);
    // pivot at the nail so the swing looks natural
    const pivot = group("poster");
    pivot.position.set(spec.x, y + height / 2 + 0.04, -2.385);
    const frame = rbox(width + 0.05, height + 0.05, 0.026, 0.006, frameMat, 0, -height / 2 - 0.04, 0.0, undefined, 3);
    const art = mesh(new PlaneGeometry(width, height), material, { cast: false });
    art.position.set(0, -height / 2 - 0.04, 0.0135);
    pivot.add(frame, art);
    root.add(pivot);
    items.push({ object: pivot, quote: spec.quote });
    swings.push({ object: pivot, t: 1 });

    // picture light: brass bar + warm wash on the poster
    const lamp = group("picture-light");
    lamp.add(box(0.36, 0.022, 0.03, brass, spec.x, y + height / 2 + 0.11, -2.35));
    lamp.add(box(0.02, 0.06, 0.02, brass, spec.x, y + height / 2 + 0.085, -2.375));
    const strip = box(0.32, 0.004, 0.012, new MeshBasicMaterial({ color: "#ffe6bf", toneMapped: false }), spec.x, y + height / 2 + 0.098, -2.346, { cast: false, receive: false });
    lamp.add(strip);
    const wash = glowCard(palette.warm, width * 1.5, height * 0.9, 0.22);
    wash.position.set(spec.x, y + height * 0.22, -2.355);
    lamp.add(wash);
    root.add(lamp);
  });

  return {
    root,
    items,
    wobble(index) {
      const s = swings[index];
      if (s) s.t = 0;
    },
    update(dt) {
      for (const s of swings) {
        if (s.t >= 1) continue;
        s.t = Math.min(1, s.t + dt / 1.6);
        s.object.rotation.z = Math.sin(s.t * Math.PI * 5) * 0.07 * (1 - s.t) ** 2;
      }
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}

