import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import { mulberry32 } from "./math";

/** Set once by the World from the renderer's capabilities and the device tier. */
export const textureQuality = { anisotropy: 1, scale: 2 };

export function configureTextures(opts: { anisotropy: number; scale: number }) {
  textureQuality.anisotropy = opts.anisotropy;
  textureQuality.scale = opts.scale;
}

/**
 * A canvas whose drawing code works in `width` x `height` logical units while
 * the pixel size is multiplied by the quality scale (2x on desktop).
 */
export function createScaledCanvas(width: number, height: number, scale = textureQuality.scale) {
  const { canvas, ctx } = createCanvas(Math.round(width * scale), Math.round(height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return { canvas, ctx };
}

export function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  return { canvas, ctx };
}

export function toTexture(canvas: HTMLCanvasElement, srgb = true): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  if (srgb) texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = textureQuality.anisotropy;
  return texture;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Soft radial falloff used by every additive glow card. */
export function glowTexture(): Texture {
  const size = 128;
  const { canvas, ctx } = createScaledCanvas(size, size, 2);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(0.6, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas);
}

/** Warm wooden planks. Gaps stay narrow so the floor doesn't read as a cartoon grid. */
export function floorTexture(): Texture {
  const size = 512;
  const { canvas, ctx } = createScaledCanvas(size, size);
  const rand = mulberry32(7);
  const rows = 8;
  const rowH = size / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 200;
    while (x < size) {
      const w = 160 + rand() * 180;
      const shade = 0.9 + rand() * 0.16;
      ctx.fillStyle = `rgb(${Math.round(118 * shade)}, ${Math.round(86 * shade)}, ${Math.round(62 * shade)})`;
      ctx.fillRect(x, r * rowH, w, rowH);
      ctx.strokeStyle = "rgba(60, 36, 20, 0.14)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const gy = r * rowH + 6 + rand() * (rowH - 12);
        ctx.beginPath();
        ctx.moveTo(x + 4, gy);
        ctx.bezierCurveTo(x + w * 0.3, gy + 2, x + w * 0.6, gy - 2, x + w - 4, gy);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(30, 18, 10, 0.28)";
      ctx.fillRect(x, r * rowH, 1, rowH);
      x += w;
    }
    ctx.fillStyle = "rgba(30, 18, 10, 0.28)";
    ctx.fillRect(0, r * rowH, size, 1);
  }
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** Plaster with a little tone variation, so the walls aren't a flat fill. */
export function plasterTexture(): Texture {
  const size = 256;
  const { canvas, ctx } = createScaledCanvas(size, size);
  ctx.fillStyle = "#1c2b46";
  ctx.fillRect(0, 0, size, size);
  const rand = mulberry32(5);
  for (let i = 0; i < 80; i++) {
    const tone = 14 + rand() * 22;
    ctx.fillStyle = `rgba(${tone + 6}, ${tone + 14}, ${tone + 28}, ${0.05 + rand() * 0.08})`;
    const w = 16 + rand() * 48;
    ctx.beginPath();
    ctx.ellipse(rand() * size, rand() * size, w, w * (0.45 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** Walnut tabletop grain. Tiled gently; the streaks run along U. */
export function woodGrainTexture(): Texture {
  const size = 512;
  const { canvas, ctx } = createScaledCanvas(size, size);
  const rand = mulberry32(9);
  const base = ctx.createLinearGradient(0, 0, 0, size);
  base.addColorStop(0, "#a56b42");
  base.addColorStop(0.5, "#8d5834");
  base.addColorStop(1, "#9a623c");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    const n = rand();
    ctx.fillStyle = `rgba(${Math.round(70 + n * 30)}, ${Math.round(36 + n * 16)}, ${Math.round(18 + n * 8)}, ${0.08 + n * 0.12})`;
    ctx.fillRect(0, y, size, 1);
  }
  ctx.strokeStyle = "rgba(62, 32, 16, 0.28)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    const y = rand() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.33, y + (rand() - 0.5) * 8, size * 0.66, y + (rand() - 0.5) * 8, size, y + (rand() - 0.5) * 4);
    ctx.stroke();
  }
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** Near-white weave. Tint it with the material color. */
export function fabricTexture(): Texture {
  const size = 128;
  const { canvas, ctx } = createScaledCanvas(size, size, 2);
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, size, size);
  const rand = mulberry32(4);
  for (let y = 0; y < size; y += 2) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.2)";
    ctx.fillRect(0, y, size, 1);
  }
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.fillRect(rand() * size, rand() * size, 1, 1);
  }
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** A single leaf card. The empty canvas stays transparent so alphaTest can cut it. */
export function leafTexture(): Texture {
  const size = 128;
  const { canvas, ctx } = createScaledCanvas(size, size, 2);
  ctx.translate(size / 2, size / 2);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.46);
  ctx.bezierCurveTo(size * 0.38, -size * 0.16, size * 0.34, size * 0.22, 0, size * 0.46);
  ctx.bezierCurveTo(-size * 0.34, size * 0.22, -size * 0.38, -size * 0.16, 0, -size * 0.46);
  ctx.fillStyle = "#f4fff6";
  ctx.fill();
  ctx.strokeStyle = "rgba(20, 60, 30, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.36);
  ctx.quadraticCurveTo(size * 0.02, 0, 0, size * 0.36);
  ctx.stroke();
  return toTexture(canvas);
}

/** Rectangular wool rug: dark field, linen border, no target rings. */
export function rugTexture(): Texture {
  const w = 512;
  const h = 344;
  const { canvas, ctx } = createScaledCanvas(w, h);
  ctx.fillStyle = "#1c2636";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#d9d0c0";
  ctx.lineWidth = 16;
  ctx.strokeRect(16, 16, w - 32, h - 32);
  ctx.strokeStyle = "#31425c";
  ctx.lineWidth = 3;
  ctx.strokeRect(34, 34, w - 68, h - 68);
  const rand = mulberry32(3);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(rand() * w, rand() * h, 2, 2);
  }
  return toTexture(canvas);
}

/** What you see through the window: night sky, moon and a drifting cloud. */
export function windowSkyTexture(): Texture {
  const w = 256;
  const h = 256;
  const { canvas, ctx } = createScaledCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#08142c");
  g.addColorStop(0.65, "#163768");
  g.addColorStop(1, "#2b5aa0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const rand = mulberry32(11);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + rand() * 0.6})`;
    const s = rand() > 0.85 ? 2 : 1;
    ctx.fillRect(rand() * w, rand() * h * 0.7, s, s);
  }
  const moon = ctx.createRadialGradient(176, 70, 0, 176, 70, 60);
  moon.addColorStop(0, "rgba(255,248,225,0.9)");
  moon.addColorStop(0.3, "rgba(255,240,200,0.25)");
  moon.addColorStop(1, "rgba(255,240,200,0)");
  ctx.fillStyle = moon;
  ctx.fillRect(100, 0, 156, 140);
  ctx.beginPath();
  ctx.arc(176, 70, 18, 0, Math.PI * 2);
  ctx.fillStyle = "#fff6dc";
  ctx.fill();
  // two soft clouds with flat bases
  const cloud = (cx: number, cy: number, s: number, alpha: number) => {
    ctx.fillStyle = `rgba(178, 196, 245, ${alpha})`;
    ctx.beginPath();
    ctx.arc(cx - 26 * s, cy, 16 * s, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(cx - 8 * s, cy - 14 * s, 20 * s, Math.PI, Math.PI * 1.85);
    ctx.arc(cx + 16 * s, cy - 8 * s, 16 * s, Math.PI * 1.2, Math.PI * 1.95);
    ctx.arc(cx + 30 * s, cy, 12 * s, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fill();
  };
  cloud(70, 196, 1.3, 0.5);
  cloud(190, 222, 1.0, 0.38);
  return toTexture(canvas);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export function svgDataUrl(body: string, width: number, height: number, color = "#ffffff") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width * 8}" height="${height * 8}" color="${color}">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
