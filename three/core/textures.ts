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

/** Warm wooden planks with a little grain. */
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
      const shade = 0.86 + rand() * 0.22;
      ctx.fillStyle = `rgb(${Math.round(92 * shade)}, ${Math.round(62 * shade)}, ${Math.round(46 * shade)})`;
      ctx.fillRect(x, r * rowH, w, rowH);
      // grain
      ctx.strokeStyle = "rgba(40, 22, 14, 0.18)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const gy = r * rowH + 6 + rand() * (rowH - 12);
        ctx.beginPath();
        ctx.moveTo(x + 4, gy);
        ctx.bezierCurveTo(x + w * 0.3, gy + 3, x + w * 0.6, gy - 3, x + w - 4, gy + 1);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(20, 10, 6, 0.55)";
      ctx.fillRect(x, r * rowH, 2, rowH);
      x += w;
    }
    ctx.fillStyle = "rgba(20, 10, 6, 0.6)";
    ctx.fillRect(0, r * rowH, size, 2);
  }
  const texture = toTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

export function rugTexture(accent: string): Texture {
  const size = 512;
  const { canvas, ctx } = createScaledCanvas(size, size);
  const c = size / 2;
  const rings = ["#15233f", "#1c2f52", "#15233f", accent, "#1c2f52", "#15233f", "#22385f", "#15233f"];
  rings.forEach((color, i) => {
    ctx.beginPath();
    ctx.arc(c, c, c * (1 - i / rings.length), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });
  // tufted noise
  const rand = mulberry32(3);
  for (let i = 0; i < 2600; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * c;
    ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.06)";
    ctx.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, 2, 2);
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
