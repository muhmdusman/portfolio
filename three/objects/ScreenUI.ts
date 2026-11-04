import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from "three";
import {
  profile,
  projects,
  roles,
  sections,
  skillCategories,
  type SectionId,
} from "@/content/portfolio";
import { icons, type IconName } from "@/lib/icons";
import type { PortfolioState } from "@/lib/store";
import { clamp, easeInOutCubic, easeOutCubic, shortHash } from "../core/math";
import { createCanvas, roundRect } from "../core/textures";

/**
 * Draws the "UsmanOS" desktop that lives on the 3D monitor. Everything is
 * painted into one 2D canvas (2048 x 1152 px on desktop) that is uploaded as
 * a texture only when something visible changed. Layout units are a
 * 1280 x 720 logical grid; the canvas transform scales them up.
 */

type Mode = "off" | "boot" | SectionId;
type Seg = [text: string, color: string];

const W = 1280;
const H = 720;
const MENU_H = 38;
const TITLE_H = 48;
/** Windowed apps; the browser runs full screen so screenshots get the most room. */
const WIN = { x: 40, y: MENU_H + 10, w: 1200, h: 576 };

const DOCK_GRADIENTS: Record<SectionId, [string, string]> = {
  home: ["#3b82f6", "#1d4ed8"],
  skills: ["#a855f7", "#6d28d9"],
  projects: ["#f59e0b", "#ea580c"],
  experience: ["#14b8a6", "#0f766e"],
  contact: ["#ec4899", "#be185d"],
};

const DOCK_GLYPHS: Record<SectionId, IconName> = {
  home: "mdi:home-variant",
  skills: "mdi:layers-triple",
  projects: "mdi:folder-open",
  experience: "mdi:briefcase-variant",
  contact: "mdi:email-fast",
};

const APP_NAMES: Record<SectionId, string> = {
  home: "Terminal",
  skills: "Code",
  projects: "Browser",
  experience: "Terminal",
  contact: "Mail",
};

const C = {
  text: "#e6ebf5",
  dim: "#93a0b8",
  faint: "#5f6b85",
  green: "#4ade80",
  blue: "#5ab8ff",
  cyan: "#38bdf8",
  yellow: "#f5c542",
  purple: "#c586c0",
  orange: "#f2a65a",
  teal: "#4ec9b0",
  comment: "#6a9955",
};

const pathCache = new Map<IconName, Path2D>();
function iconPath(name: IconName) {
  let p = pathCache.get(name);
  if (!p) {
    const d = /\sd="([^"]+)"/.exec(icons[name].body)?.[1] ?? "";
    p = new Path2D(d);
    pathCache.set(name, p);
  }
  return p;
}

export interface ScreenFonts {
  sans: string;
  mono: string;
}

/** Screenshot auto-scroll: hold at the top, scroll down, hold, scroll back up. */
const SCROLL = { hold: 1.6, down: 2.6, pause: 1.2, up: 1.8 };

export class ScreenUI {
  readonly texture: CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scale: number;
  private readonly fonts: ScreenFonts;
  private wallpaper: HTMLCanvasElement | null = null;
  private windowShadow: HTMLCanvasElement | null = null;

  private state: PortfolioState;
  private mode: Mode = "off";
  private modeT = 1;
  private bootT = 0;
  private powerT = 0;

  private images = new Map<string, HTMLImageElement>();
  private projectPrev = -1;
  private projectT = 1;
  private scrollClock = 0;
  private skillT = 1;
  private expT = 0;

  private dirty = true;
  private sinceDraw = 1;
  private blinkAcc = 0;
  private caretOn = true;
  private clockAcc = 99;
  private clock = "";
  private lastLogin = "";

  constructor(state: PortfolioState, fonts: ScreenFonts, small: boolean, maxAnisotropy: number) {
    this.state = state;
    this.fonts = fonts;
    this.scale = small ? 1.2 : 1.6;
    const { canvas, ctx } = createCanvas(Math.round(W * this.scale), Math.round(H * this.scale));
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = Math.min(16, maxAnisotropy);
    this.texture.minFilter = LinearMipmapLinearFilter;
    this.texture.magFilter = LinearFilter;
    this.draw();
  }

  /** Power on: short boot animation, then follow the active section. */
  boot() {
    this.mode = "boot";
    this.bootT = 0;
    this.powerT = 0;
    this.dirty = true;
  }

  /** Skip the boot animation and all auto-animations (reduced motion). */
  wake() {
    this.mode = this.state.section;
    this.powerT = 1;
    this.modeT = 1;
    this.expT = 1;
    this.scrollClock = 99;
    this.dirty = true;
  }

  setImage(src: string, img: HTMLImageElement) {
    this.images.set(src, img);
    this.dirty = true;
  }

  setState(state: PortfolioState, prev: PortfolioState) {
    this.state = state;
    if (this.mode !== "off" && this.mode !== "boot" && state.section !== this.mode) this.switchMode(state.section);
    if (state.projectIndex !== prev.projectIndex) {
      this.projectPrev = prev.projectIndex;
      this.projectT = 0;
      if (this.scrollClock < 99) this.scrollClock = 0;
    }
    if (state.skillCategory !== prev.skillCategory) this.skillT = 0;
    this.dirty = true;
  }

  private switchMode(mode: SectionId) {
    this.mode = mode;
    this.modeT = 0;
    if (mode === "experience") this.expT = 0;
    if (mode === "projects" && this.scrollClock < 99) this.scrollClock = 0;
    this.dirty = true;
  }

  update(dt: number) {
    this.sinceDraw += dt;

    if (this.mode === "boot") {
      this.powerT = clamp(this.powerT + dt * 2.5);
      this.bootT += dt / 1.5;
      this.dirty = true;
      if (this.bootT >= 1) this.switchMode(this.state.section);
    }
    if (this.modeT < 1) {
      this.modeT = clamp(this.modeT + dt * 3.2);
      this.dirty = true;
    }
    if (this.projectT < 1) {
      this.projectT = clamp(this.projectT + dt * 2.6);
      this.dirty = true;
    }
    if (this.mode === "projects" && this.scrollClock < 99) {
      const before = this.scrollOffset();
      // stays below the 99 "disabled" sentinel used for reduced motion
      this.scrollClock = Math.min(60, this.scrollClock + dt);
      if (this.scrollOffset() !== before) this.dirty = true;
    }
    if (this.skillT < 1) {
      this.skillT = clamp(this.skillT + dt * 4);
      this.dirty = true;
    }
    if (this.mode === "experience" && this.expT < 1) {
      this.expT = clamp(this.expT + dt / 1.6);
      this.dirty = true;
    }

    this.blinkAcc += dt;
    if (this.blinkAcc > 0.53) {
      this.blinkAcc = 0;
      this.caretOn = !this.caretOn;
      if (this.mode === "home" || this.mode === "contact" || this.mode === "experience") this.dirty = true;
    }

    this.clockAcc += dt;
    if (this.clockAcc > 15) {
      this.clockAcc = 0;
      const now = new Date();
      const fmt = (opts: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat("en-US", { timeZone: profile.timeZone, ...opts }).format(now);
      const next = `${fmt({ weekday: "short" })} ${fmt({ hour: "2-digit", minute: "2-digit", hour12: false })}`;
      if (!this.lastLogin) {
        this.lastLogin = `${fmt({ weekday: "short", month: "short", day: "numeric" })} ${fmt({ hour: "2-digit", minute: "2-digit", hour12: false })}`;
      }
      if (next !== this.clock) {
        this.clock = next;
        this.dirty = true;
      }
    }

    // Cap texture uploads at ~30 fps.
    if (this.dirty && this.sinceDraw >= 1 / 30) {
      this.draw();
      return true;
    }
    return false;
  }

  dispose() {
    this.texture.dispose();
    this.images.clear();
  }

  /** 0 = top of the screenshot, 1 = bottom. */
  private scrollOffset() {
    const t = this.scrollClock;
    const { hold, down, pause, up } = SCROLL;
    if (t < hold) return 0;
    if (t < hold + down) return easeInOutCubic((t - hold) / down);
    if (t < hold + down + pause) return 1;
    if (t < hold + down + pause + up) return 1 - easeInOutCubic((t - hold - down - pause) / up);
    return 0;
  }

  // ---------------------------------------------------------------- drawing

  private font(size: number, weight = 400, mono = false) {
    return `${weight} ${size}px ${mono ? this.fonts.mono : this.fonts.sans}`;
  }

  private draw() {
    const ctx = this.ctx;
    this.dirty = false;
    this.sinceDraw = 0;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;

    if (this.mode === "off") {
      ctx.fillStyle = "#020409";
      ctx.fillRect(0, 0, W, H);
    } else if (this.mode === "boot") {
      this.drawBoot();
    } else {
      this.drawDesktop(this.mode);
    }
    this.texture.needsUpdate = true;
  }

  private drawBoot() {
    const ctx = this.ctx;
    ctx.fillStyle = "#03060d";
    ctx.fillRect(0, 0, W, H);
    // CRT-style power-on line
    if (this.powerT < 1) {
      const t = easeOutCubic(this.powerT);
      ctx.fillStyle = `rgba(150, 200, 255, ${1 - t})`;
      const h = 4 + t * H;
      ctx.fillRect(0, H / 2 - h / 2, W, h);
    }
    const a = clamp(this.bootT * 3);
    ctx.globalAlpha = a;
    this.drawLogo(W / 2 - 60, H / 2 - 150, 120);
    ctx.fillStyle = C.text;
    ctx.font = this.font(40, 700);
    ctx.textAlign = "center";
    ctx.fillText("UsmanOS", W / 2, H / 2 + 26);
    ctx.font = this.font(20, 400, true);
    ctx.fillStyle = C.dim;
    ctx.fillText("booting workspace · loading cloud drivers", W / 2, H / 2 + 66);
    roundRect(ctx, W / 2 - 180, H / 2 + 96, 360, 8, 4);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    roundRect(ctx, W / 2 - 180, H / 2 + 96, 360 * easeOutCubic(clamp(this.bootT)), 8, 4);
    ctx.fillStyle = C.blue;
    ctx.fill();
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  /** Usman's "U" brand mark, same geometry as app/icon.svg (64×64 units). */
  private drawLogo(x: number, y: number, size: number) {
    const ctx = this.ctx;
    const k = size / 64;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.shadowColor = "rgba(7,136,255,0.6)";
    ctx.shadowBlur = 30;
    roundRect(ctx, 0, 0, 64, 64, 15);
    ctx.fillStyle = "#0788ff";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff";
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

  /** Wallpaper at full canvas resolution, drawn once. */
  private getWallpaper() {
    if (this.wallpaper) return this.wallpaper;
    const s = this.scale;
    const { canvas, ctx } = createCanvas(Math.round(W * s), Math.round(H * s));
    ctx.scale(s, s);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0a1b3d");
    g.addColorStop(0.55, "#081430");
    g.addColorStop(1, "#140a33");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const blob = (x: number, y: number, r: number, color: string) => {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    blob(260, 160, 520, "rgba(7,136,255,0.35)");
    blob(1080, 600, 560, "rgba(139,92,246,0.3)");
    blob(900, 120, 300, "rgba(56,189,248,0.18)");
    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
    this.wallpaper = canvas;
    return canvas;
  }

  /** The soft window shadow is blurred once and reused (canvas blur is costly at this size). */
  private getWindowShadow() {
    if (this.windowShadow) return this.windowShadow;
    const m = 60;
    const k = 0.5;
    const { canvas, ctx } = createCanvas(Math.round((WIN.w + m * 2) * k), Math.round((WIN.h + m * 2) * k));
    ctx.scale(k, k);
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 40 * k;
    ctx.shadowOffsetY = 18 * k;
    roundRect(ctx, m, m, WIN.w, WIN.h, 16);
    ctx.fillStyle = "#000";
    ctx.fill();
    this.windowShadow = canvas;
    return canvas;
  }

  private drawDesktop(mode: SectionId) {
    const ctx = this.ctx;
    ctx.drawImage(this.getWallpaper(), 0, 0, W, H);
    const fullscreen = mode === "projects";
    if (!fullscreen) this.drawMenuBar(mode);

    const t = easeOutCubic(this.modeT);
    const rect = fullscreen ? { x: 0, y: 0, w: W, h: H } : WIN;
    ctx.save();
    ctx.globalAlpha = t;
    const s = 0.94 + 0.06 * t;
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2 + (1 - t) * 18);
    ctx.scale(s, s);
    ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    if (!fullscreen) ctx.drawImage(this.getWindowShadow(), rect.x - 60, rect.y - 60, rect.w + 120, rect.h + 120);
    this.drawWindow(mode, rect.x, rect.y, rect.w, rect.h, fullscreen ? 0 : 16);
    ctx.restore();

    if (!fullscreen) this.drawDock(mode);
  }

  private drawMenuBar(mode: SectionId) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(6, 12, 26, 0.66)";
    ctx.fillRect(0, 0, W, MENU_H);
    ctx.fillStyle = "#ffffff";
    // tiny cloud mark
    ctx.beginPath();
    ctx.arc(24, 21, 6, 0, Math.PI * 2);
    ctx.arc(32, 16.5, 7.5, 0, Math.PI * 2);
    ctx.arc(40, 21, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(24, 21, 16, 6);
    const base = 26;
    ctx.font = this.font(18, 700);
    ctx.fillText("UsmanOS", 56, base);
    let x = 56 + ctx.measureText("UsmanOS").width + 22;
    ctx.font = this.font(18, 600);
    ctx.fillText(APP_NAMES[mode], x, base);
    x += ctx.measureText(APP_NAMES[mode]).width + 26;
    ctx.font = this.font(18, 400);
    ctx.fillStyle = "rgba(230,235,245,0.82)";
    for (const item of ["File", "Edit", "View", "Window", "Help"]) {
      ctx.fillText(item, x, base);
      x += ctx.measureText(item).width + 24;
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(this.clock ? `${this.clock} PKT` : "", W - 22, base);
    ctx.textAlign = "left";
    // wifi + battery
    const bx = W - 220;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    roundRect(ctx, bx, 12, 28, 14, 4);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bx + 4, 16, 17, 6);
    ctx.fillRect(bx + 30, 16.5, 2.5, 5);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(bx - 30, 28, 5 + i * 5.5, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
    }
  }

  private drawDock(active: SectionId) {
    const ctx = this.ctx;
    const size = 52;
    const gap = 14;
    const pad = 10;
    const n = sections.length;
    const dw = n * size + (n - 1) * gap + pad * 2;
    const dx = (W - dw) / 2;
    const dy = H - size - pad * 2 - 12;
    roundRect(ctx, dx, dy, dw, size + pad * 2, 22);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.stroke();
    sections.forEach((section, i) => {
      const isActive = section.id === active;
      const lift = isActive ? 6 : 0;
      const sz = isActive ? size * 1.08 : size;
      const x = dx + pad + i * (size + gap) - (sz - size) / 2;
      const y = dy + pad - lift - (sz - size);
      this.drawAppIcon(section.id, x, y, sz);
      if (isActive) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(dx + pad + i * (size + gap) + size / 2, dy + size + pad * 2 - 5, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private drawAppIcon(id: SectionId, x: number, y: number, size: number) {
    const ctx = this.ctx;
    const [a, b] = DOCK_GRADIENTS[id];
    const g = ctx.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    roundRect(ctx, x, y, size, size, size * 0.27);
    ctx.fillStyle = g;
    ctx.fill();
    const hl = ctx.createLinearGradient(x, y, x, y + size * 0.5);
    hl.addColorStop(0, "rgba(255,255,255,0.35)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    roundRect(ctx, x + 1, y + 1, size - 2, size * 0.5, size * 0.26);
    ctx.fillStyle = hl;
    ctx.fill();
    ctx.save();
    const glyph = size * 0.56;
    ctx.translate(x + (size - glyph) / 2, y + (size - glyph) / 2);
    ctx.scale(glyph / 24, glyph / 24);
    ctx.fillStyle = "#ffffff";
    ctx.fill(iconPath(DOCK_GLYPHS[id]));
    ctx.restore();
  }

  private drawWindow(mode: SectionId, x: number, y: number, w: number, h: number, radius: number) {
    const ctx = this.ctx;
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = "#0b1020";
    ctx.fill();
    ctx.clip();
    // title bar
    ctx.fillStyle = "#161e30";
    ctx.fillRect(x, y, w, TITLE_H);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(x, y + TITLE_H, w, 1);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((color, i) => {
      ctx.beginPath();
      ctx.arc(x + 28 + i * 26, y + TITLE_H / 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
    ctx.font = this.font(18, 500);
    ctx.fillStyle = "#b4bdd0";
    ctx.textAlign = "center";
    ctx.fillText(this.windowTitle(mode), x + w / 2, y + TITLE_H / 2 + 6);
    ctx.textAlign = "left";

    const bx = x;
    const by = y + TITLE_H + 1;
    const bw = w;
    const bh = h - TITLE_H - 1;
    switch (mode) {
      case "home":
        this.drawTerminal(bx, by, bw, bh);
        break;
      case "skills":
        this.drawEditor(bx, by, bw, bh);
        break;
      case "projects":
        this.drawBrowser(bx, by, bw, bh);
        break;
      case "experience":
        this.drawGitLog(bx, by, bw, bh);
        break;
      case "contact":
        this.drawMail(bx, by, bw, bh);
        break;
    }
    ctx.restore();

    if (radius > 0) {
      roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private windowTitle(mode: SectionId) {
    switch (mode) {
      case "home":
        return "usman — zsh — 120×32";
      case "skills": {
        const cat = skillCategories.find((c) => c.key === this.state.skillCategory) ?? skillCategories[0];
        return `${cat.file} — portfolio`;
      }
      case "projects":
        return projects[this.state.projectIndex]?.title ?? "Browser";
      case "experience":
        return "usman — ~/career — git log";
      case "contact":
        return "New Message";
    }
  }

  /** Draws a single-path 24×24 icon with its top-left corner at (x, y). */
  private glyph(name: IconName, x: number, y: number, size: number, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    ctx.fill(iconPath(name));
    ctx.restore();
  }

  /** Draws text runs left to right. A leading "✓" is drawn as a path. */
  private segs(x: number, y: number, parts: Seg[]) {
    const ctx = this.ctx;
    for (const [text, color] of parts) {
      ctx.fillStyle = color;
      let rest = text;
      if (rest.startsWith("✓")) {
        const size = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 16);
        this.check(x, y, size, color);
        x += size * 0.82;
        rest = rest.slice(1);
      }
      ctx.fillText(rest, x, y);
      x += ctx.measureText(rest).width;
    }
    return x;
  }

  /** Check mark on the text baseline; web-font subsets often lack U+2713. */
  private check(x: number, y: number, size: number, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.13;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.06, y - size * 0.34);
    ctx.lineTo(x + size * 0.27, y - size * 0.1);
    ctx.lineTo(x + size * 0.66, y - size * 0.64);
    ctx.stroke();
    ctx.restore();
  }

  /** Shortens the last segment with an ellipsis so the line fits `maxW`. */
  private fit(parts: Seg[], maxW: number): Seg[] {
    const ctx = this.ctx;
    const width = (p: Seg[]) => p.reduce((sum, [text]) => sum + ctx.measureText(text).width, 0);
    if (width(parts) <= maxW || parts.length === 0) return parts;
    const out = parts.map((p) => [...p] as Seg);
    const last = out[out.length - 1];
    let text = last[0];
    while (text.length > 1 && width(out) > maxW) {
      text = text.slice(0, -1);
      last[0] = `${text.trimEnd()}…`;
    }
    return out;
  }

  /**
   * Splits a line that is too wide at ", " boundaries of its last segment.
   * Continuation lines start with `prefix`.
   */
  private wrapSegs(parts: Seg[], maxW: number, prefix: Seg[]): Seg[][] {
    const ctx = this.ctx;
    const width = (p: Seg[]) => p.reduce((sum, [text]) => sum + ctx.measureText(text).width, 0);
    if (width(parts) <= maxW) return [parts];
    const head = parts.slice(0, -1);
    const [text, color] = parts[parts.length - 1];
    const words = text.split(", ");
    const lines: Seg[][] = [];
    let current: Seg[] = head;
    let buf = "";
    for (const word of words) {
      const next = buf ? `${buf}, ${word}` : word;
      if (buf && width([...current, [`${next}`, color]]) > maxW) {
        lines.push([...current, [`${buf},`, color]]);
        current = prefix;
        buf = word;
      } else {
        buf = next;
      }
    }
    lines.push([...current, [buf, color]]);
    return lines;
  }

  private prompt(cwd = "~", branch?: string): Seg[] {
    const p: Seg[] = [
      ["usman@cloud ", C.green],
      [`${cwd} `, C.blue],
    ];
    if (branch) p.push([`(${branch}) `, C.purple]);
    p.push(["% ", C.text]);
    return p;
  }

  private drawTerminal(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(x, y, w, h);
    const left = x + 34;
    let ly = y + 54;
    const lh = 40;
    ctx.font = this.font(24, 400, true);
    this.segs(left, ly, [[`Last login: ${this.lastLogin || "today"} on ttys001`, C.faint]]);
    ly += lh;
    this.segs(left, ly, [...this.prompt(), ["whoami", C.text]]);
    ly += lh;
    this.segs(left, ly, [[`${profile.name} — ${profile.role}`, C.text]]);
    ly += lh;
    this.segs(left, ly, [...this.prompt(), ["cat stack.txt", C.text]]);
    ly += lh;
    this.segs(left, ly, this.fit([["Next.js · React · Node.js · AWS · GCP · Cloudflare · Tailwind", C.cyan]], w - 68));
    ly += lh;
    this.segs(left, ly, [...this.prompt(), ["echo $MOOD", C.text]]);
    ly += lh + 46;

    ctx.font = this.font(60, 700, true);
    const typed = this.state.typed || "";
    const g = ctx.createLinearGradient(left, 0, left + 900, 0);
    g.addColorStop(0, "#5ab8ff");
    g.addColorStop(1, "#a78bfa");
    ctx.fillStyle = g;
    ctx.fillText(`> ${typed}`, left, ly);
    if (this.caretOn) {
      const cw = ctx.measureText(`> ${typed}`).width;
      ctx.fillStyle = "#5ab8ff";
      ctx.fillRect(left + cw + 8, ly - 48, 28, 56);
    }

    ctx.font = this.font(20, 400, true);
    this.segs(left, y + h - 30, [
      ["✓ ", C.green],
      ["build passing   ", C.dim],
      ["✓ ", C.green],
      ["0 bugs (they took flight)   ", C.dim],
      ["↑ ", C.cyan],
      ["deployed to the cloud", C.dim],
    ]);
  }

  private drawEditor(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const side = 270;
    const statusH = 36;
    const active = skillCategories.find((c) => c.key === this.state.skillCategory) ?? skillCategories[0];

    ctx.fillStyle = "#0d1322";
    ctx.fillRect(x, y, side, h);
    ctx.font = this.font(15, 600);
    ctx.fillStyle = C.faint;
    ctx.fillText("EXPLORER", x + 24, y + 36);
    ctx.font = this.font(19, 500);
    ctx.fillStyle = C.dim;
    ctx.beginPath();
    ctx.moveTo(x + 22, y + 62);
    ctx.lineTo(x + 34, y + 62);
    ctx.lineTo(x + 28, y + 70);
    ctx.closePath();
    ctx.fill();
    ctx.fillText("skills", x + 44, y + 72);
    skillCategories.forEach((cat, i) => {
      const iy = y + 90 + i * 46;
      const on = cat.key === active.key;
      if (on) {
        ctx.fillStyle = "rgba(90,184,255,0.13)";
        ctx.fillRect(x, iy, side, 42);
        ctx.fillStyle = cat.accent;
        ctx.fillRect(x, iy, 4, 42);
      }
      ctx.beginPath();
      ctx.arc(x + 48, iy + 21, 6, 0, Math.PI * 2);
      ctx.fillStyle = cat.accent;
      ctx.fill();
      ctx.font = this.font(19, on ? 600 : 400, true);
      ctx.fillStyle = on ? "#ffffff" : C.dim;
      ctx.fillText(cat.file, x + 66, iy + 28);
    });

    const ex = x + side;
    const ew = w - side;
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(ex, y, ew, h);
    // tab
    ctx.fillStyle = "#121a2c";
    ctx.fillRect(ex, y, ew, 46);
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(ex, y, 230, 46);
    ctx.fillStyle = active.accent;
    ctx.fillRect(ex, y, 230, 3);
    ctx.font = this.font(18, 500, true);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(active.file, ex + 22, y + 30);
    ctx.fillStyle = C.faint;
    ctx.fillText("×", ex + 202, y + 30);

    const code: Seg[][] = [
      [[`// ${active.label}`, C.comment]],
      [
        ["export const ", C.purple],
        [active.key, "#9cdcfe"],
        [": ", C.text],
        ["Skill", C.teal],
        ["[] = [", C.text],
      ],
      ...active.skills.map((skill): Seg[] => {
        const line: Seg[] = [
          ["  ", C.text],
          [`"${skill.name}"`, C.orange],
          [",", C.text],
        ];
        if (skill.note) line.push([`  // ${skill.note}`, C.comment]);
        return line;
      }),
      [["];", C.text]],
    ];

    const fade = easeOutCubic(this.skillT);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = this.font(22, 400, true);
    const lh = 36;
    const codeX = ex + 78;
    code.forEach((line, i) => {
      const ly = y + 92 + i * lh + (1 - fade) * 12;
      ctx.fillStyle = C.faint;
      ctx.textAlign = "right";
      ctx.fillText(String(i + 1), ex + 52, ly);
      ctx.textAlign = "left";
      this.segs(codeX, ly, this.fit(line, x + w - codeX - 24));
    });
    ctx.restore();

    // status bar
    ctx.fillStyle = "#0788ff";
    ctx.fillRect(x, y + h - statusH, w, statusH);
    ctx.font = this.font(17, 500);
    ctx.fillStyle = "#ffffff";
    this.glyph("mdi:source-branch", x + 14, y + h - statusH + 7, 22, "#ffffff");
    this.segs(x + 42, y + h - 12, [
      ["main    ", "#ffffff"],
      ["✓ ", "#ffffff"],
      [`0 problems    ${active.skills.length} skills`, "#ffffff"],
    ]);
    ctx.textAlign = "right";
    ctx.fillText("TypeScript   UTF-8   LF", x + w - 18, y + h - 12);
    ctx.textAlign = "left";
  }

  private drawBrowser(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const index = clamp(this.state.projectIndex, 0, projects.length - 1);
    const project = projects[index];
    const tabH = 52;
    const barH = 56;

    ctx.fillStyle = "#121a2c";
    ctx.fillRect(x, y, w, tabH + barH);
    // tab
    roundRect(ctx, x + 16, y + 9, 340, tabH - 14, 11);
    ctx.fillStyle = "#1e2840";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 40, y + 9 + (tabH - 14) / 2, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.font = this.font(19, 500);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(this.fit([[project.title, "#fff"]], 270)[0][0], x + 58, y + 34);
    this.glyph("mdi:plus", x + 368, y + 14, 26, C.faint);
    // toolbar
    const ty = y + tabH;
    this.glyph("mdi:arrow-left", x + 20, ty + 15, 26, C.dim);
    this.glyph("mdi:arrow-right", x + 58, ty + 15, 26, C.faint);
    this.glyph("mdi:refresh", x + 96, ty + 15, 26, C.dim);
    roundRect(ctx, x + 140, ty + 9, w - 230, barH - 18, 19);
    ctx.fillStyle = "#0a0f1c";
    ctx.fill();
    this.glyph("mdi:lock", x + 156, ty + 17, 22, C.green);
    ctx.fillStyle = C.text;
    ctx.font = this.font(19, 400, true);
    ctx.fillText(this.projectUrl(index), x + 188, ty + 35);
    this.glyph("mdi:dots-horizontal", x + w - 70, ty + 14, 28, C.dim);

    const vx = x;
    const vy = y + tabH + barH;
    const vw = w;
    const vh = h - tabH - barH;
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(vx, vy, vw, vh);

    const t = easeOutCubic(this.projectT);
    const prev = this.projectPrev;
    const scroll = this.scrollOffset();
    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, vy, vw, vh);
    ctx.clip();
    if (prev >= 0 && prev !== index && t < 1) {
      ctx.globalAlpha = 1 - t;
      this.drawShot(prev, vx - t * vw * 0.25, vy, vw, vh, 0);
    }
    ctx.globalAlpha = prev >= 0 && prev !== index ? t : 1;
    this.drawShot(index, vx + (1 - t) * vw * 0.35, vy, vw, vh, scroll);
    ctx.restore();
    ctx.globalAlpha = 1;

    // scrollbar
    const img = this.images.get(project.image);
    if (img) {
      const contentH = (img.height * vw) / img.width;
      if (contentH > vh) {
        const thumbH = Math.max(60, (vh / contentH) * (vh - 16));
        const thumbY = vy + 8 + scroll * (vh - 16 - thumbH);
        roundRect(ctx, vx + vw - 14, thumbY, 7, thumbH, 4);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();
      }
    }

    // caption chip
    ctx.font = this.font(19, 600);
    const label = `${String(index + 1).padStart(2, "0")} / ${String(projects.length).padStart(2, "0")}   ${project.subtitle}`;
    const lw = ctx.measureText(label).width + 36;
    roundRect(ctx, vx + 22, vy + vh - 60, lw, 42, 21);
    ctx.fillStyle = "rgba(6,10,20,0.82)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, vx + 40, vy + vh - 32);
  }

  private projectUrl(index: number) {
    const p = projects[index];
    if (p.url) return p.url.replace(/^https?:\/\//, "");
    if (p.status === "archived") return `${p.slug}.archive — closed by client`;
    return `${p.slug}.app — private build`;
  }

  /** Screenshot fitted to the viewport width; `scroll` pans from the top (0) to the bottom (1). */
  private drawShot(index: number, x: number, y: number, w: number, h: number, scroll: number) {
    const ctx = this.ctx;
    const img = this.images.get(projects[index].image);
    if (!img) {
      ctx.fillStyle = "#101828";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#1a2438";
      roundRect(ctx, x + 70, y + 70, w * 0.5, 40, 10);
      ctx.fill();
      roundRect(ctx, x + 70, y + 132, w * 0.7, 22, 8);
      ctx.fill();
      roundRect(ctx, x + 70, y + 170, w * 0.62, 22, 8);
      ctx.fill();
      ctx.font = this.font(20, 500, true);
      ctx.fillStyle = C.faint;
      ctx.fillText("loading preview…", x + 70, y + 250);
      return;
    }
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y - (dh - h) * scroll, dw, dh);
  }

  private drawGitLog(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(x, y, w, h);
    ctx.font = this.font(21, 400, true);
    const maxW = w - 64;
    const lines: Seg[][] = [[...this.prompt("~/career", "main"), ["git log --graph --decorate", C.text]]];
    roles.forEach((role, i) => {
      const last = i === roles.length - 1;
      const head: Seg[] = [
        ["* ", C.yellow],
        [`${shortHash(role.company + role.period)} `, C.yellow],
      ];
      if (i === 0) head.push(["(", C.yellow], ["HEAD -> ", C.cyan], ["main", C.green], [", ", C.yellow]);
      else head.push(["(", C.yellow]);
      head.push([`tag: ${role.tag}`, C.yellow], [") ", C.yellow], [`${role.title} @ ${role.company}`, "#ffffff"]);
      lines.push(this.fit(head, maxW));
      const bar: Seg = [last ? "  " : "│ ", C.purple];
      lines.push([bar, [`Date: ${role.period} · ${role.jobType} · ${role.workMode}`, C.dim]]);
      const kind = i === 0 ? "feat(seo): " : last ? "init: " : "feat: ";
      lines.push(...this.wrapSegs([bar, [kind, C.purple], [role.highlights.join(", "), "#d1d8e6"]], maxW, [bar, [" ".repeat(kind.length), C.purple]]));
    });
    lines.push([...this.prompt("~/career", "main")]);

    const lh = 35;
    const visible = Math.min(lines.length, Math.floor(this.expT * lines.length) + 1);
    let lastX = x + 32;
    for (let i = 0; i < visible; i++) {
      lastX = this.segs(x + 32, y + 50 + i * lh, lines[i]);
    }
    if (this.caretOn) {
      ctx.fillStyle = C.text;
      ctx.fillRect(lastX + 3, y + 50 + (visible - 1) * lh - 21, 13, 26);
    }
  }

  private drawMail(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const { contact, contactStatus } = this.state;
    const focus = this.state.contactField;
    ctx.fillStyle = "#0e1526";
    ctx.fillRect(x, y, w, h);
    const left = x + 36;
    const rowH = 64;
    const rows: Array<{ label: string; value: string; placeholder: string; field: string | null }> = [
      { label: "To:", value: profile.email, placeholder: "", field: null },
      {
        label: "From:",
        value: contact.name || contact.email ? `${contact.name || "Anonymous"}${contact.email ? ` <${contact.email}>` : ""}` : "",
        placeholder: "Your name <you@example.com>",
        field: focus === "email" ? "email" : "name",
      },
      { label: "Subject:", value: contact.subject, placeholder: "What are we building?", field: "subject" },
    ];
    rows.forEach((row, i) => {
      const ry = y + i * rowH;
      ctx.font = this.font(21, 500);
      ctx.fillStyle = C.dim;
      ctx.fillText(row.label, left, ry + 41);
      const vx = left + 112;
      if (i === 0) {
        ctx.font = this.font(20, 500);
        const tw = ctx.measureText(row.value).width;
        roundRect(ctx, vx - 4, ry + 14, tw + 30, 38, 19);
        ctx.fillStyle = "rgba(7,136,255,0.24)";
        ctx.fill();
        ctx.fillStyle = "#a9d6ff";
        ctx.fillText(row.value, vx + 11, ry + 40);
      } else {
        ctx.font = this.font(22, 400);
        ctx.fillStyle = row.value ? C.text : C.faint;
        const text = this.fit([[row.value || row.placeholder, "#fff"]], w - (vx - x) - 40)[0][0];
        ctx.fillText(text, vx, ry + 41);
        const isFocus = focus !== null && (row.field === focus || (i === 1 && (focus === "name" || focus === "email")));
        if (isFocus && this.caretOn) {
          const cw = row.value ? ctx.measureText(text).width : 0;
          ctx.fillStyle = C.blue;
          ctx.fillRect(vx + cw + 2, ry + 18, 2.5, 30);
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x, ry + rowH - 1, w, 1);
    });

    // message body
    const by = y + rows.length * rowH + 48;
    ctx.font = this.font(24, 400);
    const maxW = w - 72;
    const msg = contact.message;
    const lines = msg ? this.wrap(msg, maxW) : ["Write your message…"];
    const lineH = 38;
    const maxLines = 5;
    const shown = lines.slice(-maxLines);
    ctx.fillStyle = msg ? C.text : C.faint;
    shown.forEach((line, i) => ctx.fillText(line, left, by + i * lineH));
    if (focus === "message" && this.caretOn) {
      const lastLine = msg ? shown[shown.length - 1] : "";
      const cw = ctx.measureText(lastLine).width;
      ctx.fillStyle = C.blue;
      ctx.fillRect(left + cw + 2, by + (shown.length - 1) * lineH - 25, 2.5, 32);
    }

    // send button
    const ready = Boolean(contact.name && contact.email && contact.subject && contact.message);
    const label = contactStatus === "sending" ? "Sending…" : "Send";
    ctx.font = this.font(21, 600);
    const bw = ctx.measureText(label).width + 86;
    const bx = x + w - bw - 32;
    const bY = y + h - 72;
    roundRect(ctx, bx, bY, bw, 50, 25);
    ctx.fillStyle = ready || contactStatus === "sending" ? "#0788ff" : "#24304a";
    ctx.fill();
    this.glyph("mdi:send", bx + 24, bY + 13, 24, "#ffffff");
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, bx + 60, bY + 33);

    if (contactStatus === "sent" || contactStatus === "error") {
      ctx.fillStyle = "rgba(8, 12, 24, 0.84)";
      ctx.fillRect(x, y, w, h);
      const ok = contactStatus === "sent";
      this.glyph(ok ? "mdi:check-circle-outline" : "mdi:alert-circle-outline", x + w / 2 - 56, y + h / 2 - 140, 112, ok ? C.green : "#f87171");
      ctx.textAlign = "center";
      ctx.font = this.font(40, 700);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(ok ? "Message sent!" : "Couldn’t send that one", x + w / 2, y + h / 2 + 30);
      ctx.font = this.font(22, 400);
      ctx.fillStyle = C.dim;
      ctx.fillText(ok ? "Thanks for reaching out. I’ll get back to you soon." : `Email me directly at ${profile.email}`, x + w / 2, y + h / 2 + 74);
      ctx.textAlign = "left";
    }
  }

  private wrap(text: string, maxWidth: number) {
    const ctx = this.ctx;
    const out: string[] = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          out.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      out.push(line);
    }
    return out;
  }
}
