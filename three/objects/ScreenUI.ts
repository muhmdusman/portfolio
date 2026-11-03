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
import { clamp, easeOutCubic, shortHash } from "../core/math";
import { createCanvas, roundRect } from "../core/textures";

/**
 * Draws the "UsmanOS" desktop that lives on the 3D monitor. Everything is
 * painted into a single 2D canvas that is uploaded as a texture only when
 * something visible changed (typing, caret blink, transitions).
 */

type Mode = "off" | "boot" | SectionId;
type Seg = [text: string, color: string];

const W = 1280;
const H = 720;

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
  dim: "#8b95a8",
  faint: "#566179",
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

export class ScreenUI {
  readonly texture: CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scale: number;
  private readonly fonts: ScreenFonts;
  private wallpaper: HTMLCanvasElement | null = null;

  private state: PortfolioState;
  private mode: Mode = "off";
  private modeT = 1;
  private bootT = 0;
  private powerT = 0;

  private images = new Map<string, HTMLImageElement>();
  private projectPrev = -1;
  private projectT = 1;
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
    this.scale = small ? 0.8 : 1;
    const { canvas, ctx } = createCanvas(Math.round(W * this.scale), Math.round(H * this.scale));
    this.ctx = ctx;
    this.texture = new CanvasTexture(canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = Math.min(8, maxAnisotropy);
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

  /** Skip the boot animation (reduced motion). */
  wake() {
    this.mode = this.state.section;
    this.powerT = 1;
    this.modeT = 1;
    this.expT = 1;
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
    }
    if (state.skillCategory !== prev.skillCategory) this.skillT = 0;
    this.dirty = true;
  }

  private switchMode(mode: SectionId) {
    this.mode = mode;
    this.modeT = 0;
    if (mode === "experience") this.expT = 0;
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
    this.drawLogo(W / 2 - 52, H / 2 - 120, 104);
    ctx.fillStyle = C.text;
    ctx.font = this.font(30, 600);
    ctx.textAlign = "center";
    ctx.fillText("UsmanOS", W / 2, H / 2 + 26);
    ctx.font = this.font(15, 400, true);
    ctx.fillStyle = C.dim;
    ctx.fillText("booting workspace · loading cloud drivers", W / 2, H / 2 + 58);
    roundRect(ctx, W / 2 - 150, H / 2 + 84, 300, 6, 3);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    roundRect(ctx, W / 2 - 150, H / 2 + 84, 300 * easeOutCubic(clamp(this.bootT)), 6, 3);
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

  private getWallpaper() {
    if (this.wallpaper) return this.wallpaper;
    const { canvas, ctx } = createCanvas(W, H);
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

  private drawDesktop(mode: SectionId) {
    const ctx = this.ctx;
    ctx.drawImage(this.getWallpaper(), 0, 0);
    this.drawMenuBar(mode);

    const t = easeOutCubic(this.modeT);
    const wx = 96;
    const wy = 56;
    const ww = 1088;
    const wh = 556;
    ctx.save();
    ctx.globalAlpha = t;
    const s = 0.94 + 0.06 * t;
    ctx.translate(wx + ww / 2, wy + wh / 2 + (1 - t) * 18);
    ctx.scale(s, s);
    ctx.translate(-(wx + ww / 2), -(wy + wh / 2));
    this.drawWindow(mode, wx, wy, ww, wh);
    ctx.restore();

    this.drawDock(mode);
  }

  private drawMenuBar(mode: SectionId) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(6, 12, 26, 0.62)";
    ctx.fillRect(0, 0, W, 32);
    ctx.fillStyle = "#ffffff";
    // tiny cloud mark
    ctx.beginPath();
    ctx.arc(22, 18, 5, 0, Math.PI * 2);
    ctx.arc(29, 14, 6.5, 0, Math.PI * 2);
    ctx.arc(36, 18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(22, 18, 14, 5);
    ctx.font = this.font(15, 700);
    ctx.fillText("UsmanOS", 50, 22);
    ctx.font = this.font(15, 600);
    ctx.fillText(APP_NAMES[mode], 132, 22);
    ctx.font = this.font(15, 400);
    ctx.fillStyle = "rgba(230,235,245,0.8)";
    let x = 132 + ctx.measureText(APP_NAMES[mode]).width + 26;
    for (const item of ["File", "Edit", "View", "Window", "Help"]) {
      ctx.fillText(item, x, 22);
      x += ctx.measureText(item).width + 22;
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(this.clock ? `${this.clock} PKT` : "", W - 20, 22);
    ctx.textAlign = "left";
    // wifi + battery
    const bx = W - 200;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.6;
    roundRect(ctx, bx, 11, 24, 12, 3);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bx + 3, 14, 15, 6);
    ctx.fillRect(bx + 25, 15, 2, 4);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(bx - 26, 24, 4 + i * 4.5, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
    }
  }

  private drawDock(active: SectionId) {
    const ctx = this.ctx;
    const size = 50;
    const gap = 14;
    const pad = 12;
    const n = sections.length;
    const dw = n * size + (n - 1) * gap + pad * 2;
    const dx = (W - dw) / 2;
    const dy = H - size - pad * 2 - 14;
    roundRect(ctx, dx, dy, dw, size + pad * 2, 22);
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
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
        ctx.arc(dx + pad + i * (size + gap) + size / 2, dy + size + pad * 2 - 6, 2.6, 0, Math.PI * 2);
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

  private drawWindow(mode: SectionId, x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fillStyle = "#0b1020";
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, x, y, w, h, 16);
    ctx.clip();
    // title bar
    ctx.fillStyle = "#161e30";
    ctx.fillRect(x, y, w, 42);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x, y + 42, w, 1);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((color, i) => {
      ctx.beginPath();
      ctx.arc(x + 24 + i * 22, y + 21, 7, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
    ctx.font = this.font(15, 500);
    ctx.fillStyle = "#aab4c8";
    ctx.textAlign = "center";
    ctx.fillText(this.windowTitle(mode), x + w / 2, y + 26);
    ctx.textAlign = "left";

    const bx = x;
    const by = y + 43;
    const bw = w;
    const bh = h - 43;
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

    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 16);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
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

  private segs(x: number, y: number, parts: Seg[]) {
    const ctx = this.ctx;
    for (const [text, color] of parts) {
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      x += ctx.measureText(text).width;
    }
    return x;
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
    const left = x + 30;
    let ly = y + 44;
    const lh = 32;
    ctx.font = this.font(19, 400, true);
    this.segs(left, ly, [[`Last login: ${this.lastLogin || "today"} on ttys001`, C.faint]]);
    ly += lh;
    this.segs(left, ly, [...this.prompt(), ["whoami", C.text]]);
    ly += lh;
    this.segs(left, ly, [[`${profile.name} — ${profile.role}`, C.text]]);
    ly += lh;
    this.segs(left, ly, [...this.prompt(), ["cat stack.txt", C.text]]);
    ly += lh;
    this.segs(left, ly, [["Next.js · React · Node.js · AWS · GCP · Cloudflare · Tailwind", C.cyan]]);
    ly += lh;
    this.segs(left, ly, [...this.prompt(), ["echo $MOOD", C.text]]);
    ly += lh + 34;

    ctx.font = this.font(50, 700, true);
    const typed = this.state.typed || "";
    const g = ctx.createLinearGradient(left, 0, left + 760, 0);
    g.addColorStop(0, "#5ab8ff");
    g.addColorStop(1, "#a78bfa");
    ctx.fillStyle = g;
    ctx.fillText(`> ${typed}`, left, ly);
    if (this.caretOn) {
      const cw = ctx.measureText(`> ${typed}`).width;
      ctx.fillStyle = "#5ab8ff";
      ctx.fillRect(left + cw + 6, ly - 40, 24, 46);
    }

    ctx.font = this.font(17, 400, true);
    this.segs(left, y + h - 34, [
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
    const side = 250;
    const active = skillCategories.find((c) => c.key === this.state.skillCategory) ?? skillCategories[0];

    ctx.fillStyle = "#0d1322";
    ctx.fillRect(x, y, side, h);
    ctx.font = this.font(13, 600);
    ctx.fillStyle = C.faint;
    ctx.fillText("EXPLORER", x + 22, y + 32);
    ctx.font = this.font(16, 500);
    ctx.fillStyle = C.dim;
    ctx.beginPath();
    ctx.moveTo(x + 20, y + 53);
    ctx.lineTo(x + 30, y + 53);
    ctx.lineTo(x + 25, y + 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillText("skills", x + 38, y + 64);
    skillCategories.forEach((cat, i) => {
      const iy = y + 82 + i * 38;
      if (cat.key === active.key) {
        ctx.fillStyle = "rgba(90,184,255,0.12)";
        ctx.fillRect(x, iy, side, 34);
        ctx.fillStyle = cat.accent;
        ctx.fillRect(x, iy, 3, 34);
      }
      ctx.beginPath();
      ctx.arc(x + 44, iy + 17, 5, 0, Math.PI * 2);
      ctx.fillStyle = cat.accent;
      ctx.fill();
      ctx.font = this.font(16, cat.key === active.key ? 600 : 400, true);
      ctx.fillStyle = cat.key === active.key ? "#ffffff" : C.dim;
      ctx.fillText(cat.file, x + 60, iy + 23);
    });

    const ex = x + side;
    const ew = w - side;
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(ex, y, ew, h);
    // tab
    ctx.fillStyle = "#121a2c";
    ctx.fillRect(ex, y, ew, 40);
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(ex, y, 200, 40);
    ctx.fillStyle = active.accent;
    ctx.fillRect(ex, y, 200, 2);
    ctx.font = this.font(15, 500, true);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(active.file, ex + 20, y + 26);
    ctx.fillStyle = C.faint;
    ctx.fillText("×", ex + 176, y + 26);

    const code: Seg[][] = [
      [[`// ${active.label}`, C.comment]],
      [
        ["import ", C.purple],
        ["type ", C.purple],
        ["{ ", C.text],
        ["Skill", C.teal],
        [" } ", C.text],
        ["from ", C.purple],
        ['"./usman"', C.orange],
        [";", C.text],
      ],
      [],
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
      [],
      [
        ["export default ", C.purple],
        [active.key, "#9cdcfe"],
        [";", C.text],
      ],
    ];

    const fade = easeOutCubic(this.skillT);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = this.font(18, 400, true);
    const lh = 30;
    code.forEach((line, i) => {
      const ly = y + 82 + i * lh + (1 - fade) * 10;
      ctx.fillStyle = C.faint;
      ctx.textAlign = "right";
      ctx.fillText(String(i + 1), ex + 46, ly);
      ctx.textAlign = "left";
      this.segs(ex + 70, ly, line);
    });
    ctx.restore();

    // status bar
    ctx.fillStyle = "#0788ff";
    ctx.fillRect(x, y + h - 30, w, 30);
    ctx.font = this.font(14, 500);
    ctx.fillStyle = "#ffffff";
    this.glyph("mdi:source-branch", x + 12, y + h - 25, 18, "#ffffff");
    ctx.fillText(`main    ✓ 0 problems    ${active.skills.length} skills`, x + 34, y + h - 10);
    ctx.textAlign = "right";
    ctx.fillText("TypeScript   UTF-8   LF", x + w - 16, y + h - 10);
    ctx.textAlign = "left";
  }

  private drawBrowser(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const index = clamp(this.state.projectIndex, 0, projects.length - 1);
    const project = projects[index];

    ctx.fillStyle = "#121a2c";
    ctx.fillRect(x, y, w, 92);
    // tab
    roundRect(ctx, x + 14, y + 8, 280, 38, 10);
    ctx.fillStyle = "#1e2840";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 36, y + 27, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.font = this.font(15, 500);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(project.title, x + 52, y + 32);
    this.glyph("mdi:plus", x + 300, y + 16, 22, C.faint);
    // toolbar
    this.glyph("mdi:arrow-left", x + 18, y + 59, 22, C.dim);
    this.glyph("mdi:arrow-right", x + 50, y + 59, 22, C.faint);
    this.glyph("mdi:refresh", x + 82, y + 59, 22, C.dim);
    roundRect(ctx, x + 120, y + 54, w - 200, 32, 16);
    ctx.fillStyle = "#0a0f1c";
    ctx.fill();
    this.glyph("mdi:lock", x + 134, y + 61, 18, C.green);
    ctx.fillStyle = C.text;
    ctx.font = this.font(15, 400, true);
    ctx.fillText(this.projectUrl(index), x + 162, y + 75);
    this.glyph("mdi:dots-horizontal", x + w - 62, y + 58, 24, C.dim);

    const vx = x;
    const vy = y + 92;
    const vw = w;
    const vh = h - 92;
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(vx, vy, vw, vh);

    const t = easeOutCubic(this.projectT);
    const prev = this.projectPrev;
    ctx.save();
    ctx.beginPath();
    ctx.rect(vx, vy, vw, vh);
    ctx.clip();
    if (prev >= 0 && prev !== index && t < 1) {
      ctx.globalAlpha = 1 - t;
      this.drawShot(prev, vx - t * vw * 0.25, vy, vw, vh);
    }
    ctx.globalAlpha = prev >= 0 && prev !== index ? t : 1;
    this.drawShot(index, vx + (1 - t) * vw * 0.35, vy, vw, vh);
    ctx.restore();
    ctx.globalAlpha = 1;

    // caption chip
    ctx.font = this.font(15, 600);
    const label = `${String(index + 1).padStart(2, "0")} / ${String(projects.length).padStart(2, "0")}   ${project.subtitle}`;
    const lw = ctx.measureText(label).width + 32;
    roundRect(ctx, vx + 20, vy + vh - 54, lw, 36, 18);
    ctx.fillStyle = "rgba(6,10,20,0.78)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, vx + 36, vy + vh - 30);
  }

  private projectUrl(index: number) {
    const p = projects[index];
    if (p.url) return p.url.replace(/^https?:\/\//, "");
    if (p.status === "archived") return `${p.slug}.archive — closed by client`;
    return `${p.slug}.app — private build`;
  }

  private drawShot(index: number, x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const img = this.images.get(projects[index].image);
    if (!img) {
      ctx.fillStyle = "#101828";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#1a2438";
      roundRect(ctx, x + 60, y + 60, w * 0.5, 34, 8);
      ctx.fill();
      roundRect(ctx, x + 60, y + 112, w * 0.7, 18, 6);
      ctx.fill();
      roundRect(ctx, x + 60, y + 144, w * 0.62, 18, 6);
      ctx.fill();
      ctx.font = this.font(16, 500, true);
      ctx.fillStyle = C.faint;
      ctx.fillText("loading preview…", x + 60, y + 210);
      return;
    }
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y, dw, dh);
  }

  private drawGitLog(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#0a0f1c";
    ctx.fillRect(x, y, w, h);
    const lines: Seg[][] = [[...this.prompt("~/career", "main"), ["git log --graph --decorate", C.text]], []];
    roles.forEach((role, i) => {
      const last = i === roles.length - 1;
      const head: Seg[] = [
        ["* ", C.yellow],
        [`${shortHash(role.company + role.period)} `, C.yellow],
      ];
      if (i === 0) head.push(["(", C.yellow], ["HEAD -> ", C.cyan], ["main", C.green], [", ", C.yellow]);
      else head.push(["(", C.yellow]);
      head.push([`tag: ${role.tag}`, C.yellow], [") ", C.yellow], [`${role.title} @ ${role.company}`, "#ffffff"]);
      lines.push(head);
      const bar: Seg = [last ? "  " : "│ ", C.purple];
      lines.push([bar, [`Date: ${role.period} · ${role.jobType} · ${role.workMode}`, C.dim]]);
      lines.push([bar, [i === 0 ? "feat(seo): " : i === roles.length - 1 ? "init: " : "feat: ", C.purple], [role.highlights.join(", "), "#d1d8e6"]]);
      if (!last) lines.push([bar]);
    });
    lines.push([]);
    lines.push([...this.prompt("~/career", "main")]);

    ctx.font = this.font(18, 400, true);
    const lh = 31;
    const visible = Math.min(lines.length, Math.floor(this.expT * lines.length) + 1);
    let lastX = x + 30;
    for (let i = 0; i < visible; i++) {
      lastX = this.segs(x + 30, y + 46 + i * lh, lines[i]);
    }
    if (this.caretOn) {
      ctx.fillStyle = C.text;
      ctx.fillRect(lastX + 2, y + 46 + (visible - 1) * lh - 18, 11, 22);
    }
  }

  private drawMail(x: number, y: number, w: number, h: number) {
    const ctx = this.ctx;
    const { contact, contactStatus } = this.state;
    const focus = this.state.contactField;
    ctx.fillStyle = "#0e1526";
    ctx.fillRect(x, y, w, h);
    const left = x + 34;
    const rowH = 58;
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
      ctx.font = this.font(18, 500);
      ctx.fillStyle = C.dim;
      ctx.fillText(row.label, left, ry + 37);
      const vx = left + 96;
      if (i === 0) {
        ctx.font = this.font(17, 500);
        const tw = ctx.measureText(row.value).width;
        roundRect(ctx, vx - 4, ry + 14, tw + 26, 32, 16);
        ctx.fillStyle = "rgba(7,136,255,0.22)";
        ctx.fill();
        ctx.fillStyle = "#9fd0ff";
        ctx.fillText(row.value, vx + 9, ry + 36);
      } else {
        ctx.font = this.font(19, 400);
        ctx.fillStyle = row.value ? C.text : C.faint;
        const text = row.value || row.placeholder;
        ctx.fillText(text, vx, ry + 37);
        const isFocus = focus !== null && (row.field === focus || (i === 1 && (focus === "name" || focus === "email")));
        if (isFocus && this.caretOn) {
          const cw = row.value ? ctx.measureText(row.value).width : 0;
          ctx.fillStyle = C.blue;
          ctx.fillRect(vx + cw + 2, ry + 18, 2, 26);
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fillRect(x, ry + rowH - 1, w, 1);
    });

    // message body
    const by = y + rows.length * rowH + 40;
    ctx.font = this.font(21, 400);
    const maxW = w - 68;
    const msg = contact.message;
    const lines = msg ? this.wrap(msg, maxW) : ["Write your message…"];
    const maxLines = 7;
    const shown = lines.slice(-maxLines);
    ctx.fillStyle = msg ? C.text : C.faint;
    shown.forEach((line, i) => ctx.fillText(line, left, by + i * 34));
    if (focus === "message" && this.caretOn) {
      const lastLine = msg ? shown[shown.length - 1] : "";
      const cw = ctx.measureText(lastLine).width;
      ctx.fillStyle = C.blue;
      ctx.fillRect(left + cw + 2, by + (shown.length - 1) * 34 - 22, 2, 28);
    }

    // send button
    const ready = Boolean(contact.name && contact.email && contact.subject && contact.message);
    const label = contactStatus === "sending" ? "Sending…" : "Send";
    ctx.font = this.font(18, 600);
    const bw = ctx.measureText(label).width + 76;
    const bx = x + w - bw - 30;
    const bY = y + h - 66;
    roundRect(ctx, bx, bY, bw, 44, 22);
    ctx.fillStyle = ready || contactStatus === "sending" ? "#0788ff" : "#24304a";
    ctx.fill();
    ctx.save();
    ctx.translate(bx + 22, bY + 11);
    ctx.scale(22 / 24, 22 / 24);
    ctx.fillStyle = "#ffffff";
    ctx.fill(iconPath("mdi:send"));
    ctx.restore();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, bx + 54, bY + 29);

    if (contactStatus === "sent" || contactStatus === "error") {
      ctx.fillStyle = "rgba(8, 12, 24, 0.82)";
      ctx.fillRect(x, y, w, h);
      const ok = contactStatus === "sent";
      ctx.save();
      ctx.translate(x + w / 2 - 48, y + h / 2 - 120);
      ctx.scale(96 / 24, 96 / 24);
      ctx.fillStyle = ok ? C.green : "#f87171";
      ctx.fill(iconPath(ok ? "mdi:check-circle-outline" : "mdi:alert-circle-outline"));
      ctx.restore();
      ctx.textAlign = "center";
      ctx.font = this.font(34, 700);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(ok ? "Message sent!" : "Couldn’t send that one", x + w / 2, y + h / 2 + 30);
      ctx.font = this.font(19, 400);
      ctx.fillStyle = C.dim;
      ctx.fillText(ok ? "Thanks for reaching out. I’ll get back to you soon." : `Email me directly at ${profile.email}`, x + w / 2, y + h / 2 + 70);
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
