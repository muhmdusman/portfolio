import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  Box3,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  type Material,
  Mesh,
  type Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  type Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { profile, projects, type SectionId } from "@/content/portfolio";
import type { PortfolioState, PortfolioStore } from "@/lib/store";
import { CameraRig } from "./CameraRig";
import { createMaterials, palette } from "./core/kit";
import { clamp, easeOutBack } from "./core/math";
import { loadImage } from "./core/textures";
import { createAtmosphere } from "./objects/Atmosphere";
import { createComputer, KEYBOARD_CENTER, MUG_TOP, type RgbMode } from "./objects/Computer";
import { createRoom } from "./objects/Room";
import { ScreenUI } from "./objects/ScreenUI";
import { createSkillsRing } from "./objects/SkillsRing";

export interface WorldOptions {
  container: HTMLElement;
  store: PortfolioStore;
  reducedMotion: boolean;
  /** Fonts as CSS font-family lists, used to paint the 3D screen. */
  fonts: { sans: string; mono: string };
  onHover?: (label: string | null) => void;
  onNavigate?: (section: SectionId) => void;
}

type HotspotId = "lamp" | "duck" | "tower" | "screen" | "plant" | "mug";

interface Hotspot {
  id: HotspotId;
  object: Object3D;
  box: Box3;
  label: () => string;
}

const UI_SELECTOR = "a, button, input, textarea, select, label, dialog, [data-ui], [role='tab']";

function detectTier() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = coarse || small;
  return {
    mobile,
    maxDpr: mobile ? 1.5 : cores <= 4 ? 1.5 : 2,
    shadowSize: mobile ? 1024 : 2048,
    stars: mobile ? 450 : 900,
    bugs: mobile ? 22 : 40,
    extraLights: !mobile,
  };
}

export class World {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(36, 1, 0.05, 160);
  private readonly rig: CameraRig;
  private readonly tier = detectTier();
  private readonly opts: WorldOptions;
  private readonly canvas: HTMLCanvasElement;
  private readonly cleanups: Array<() => void> = [];
  private readonly disposables: Array<{ dispose(): void }> = [];

  private screen!: ScreenUI;
  private computer!: ReturnType<typeof createComputer>;
  private room!: ReturnType<typeof createRoom>;
  private atmosphere!: ReturnType<typeof createAtmosphere>;
  private skills: Awaited<ReturnType<typeof createSkillsRing>> | null = null;
  private envTexture: Texture | null = null;

  private props: Object3D[] = [];
  private introClock = -1;
  private time = 0;
  private last = 0;
  private running = false;
  private disposed = false;
  private dpr = 1;
  private frameAcc = 0;
  private frameCount = 0;
  private goodStreak = 0;

  private readonly pointer = new Vector2(9, 9);
  private pointerDirty = false;
  private pointerOverUi = false;
  private readonly raycaster = new Raycaster();
  private hotspots: Hotspot[] = [];
  private hovered: Hotspot | null = null;
  private lampOn = true;
  private rgbModes: RgbMode[] = ["rainbow", "brand", "off"];
  private rgbIndex = 0;
  private duckT = 1;
  private plantT = 1;
  private flash: { label: string; until: number } | null = null;

  constructor(opts: WorldOptions) {
    this.opts = opts;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "scene-canvas";
    this.canvas.setAttribute("aria-hidden", "true");
    opts.container.appendChild(this.canvas);

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: window.devicePixelRatio < 2,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
    });
    this.dpr = Math.min(window.devicePixelRatio || 1, this.tier.maxDpr);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.rig = new CameraRig(this.camera, opts.reducedMotion);
  }

  async init() {
    const { scene, renderer, tier } = this;
    scene.background = new Color(palette.night);
    scene.fog = new Fog(palette.night, 22, 62);

    const pmrem = new PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    this.envTexture = pmrem.fromScene(roomEnv, 0.04).texture;
    roomEnv.traverse((o) => {
      if (o instanceof Mesh) {
        o.geometry.dispose();
        (o.material as Material).dispose();
      }
    });
    pmrem.dispose();
    scene.environment = this.envTexture;
    scene.environmentIntensity = 0.22;

    const hemi = new HemisphereLight("#6c8fd6", "#0b1220", 0.75);
    const moon = new DirectionalLight("#c4d8ff", 2.1);
    moon.position.set(6.5, 10, 7.5);
    moon.target.position.set(-0.4, 0.4, -1.2);
    moon.castShadow = true;
    moon.shadow.mapSize.set(tier.shadowSize, tier.shadowSize);
    const sc = moon.shadow.camera;
    sc.left = -4.2;
    sc.right = 4.2;
    sc.top = 4.2;
    sc.bottom = -3.6;
    sc.near = 4;
    sc.far = 26;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.025;
    moon.shadow.radius = 3;
    scene.add(hemi, moon, moon.target);

    const mats = createMaterials();
    Object.values(mats).forEach((m) => this.disposables.push(m));

    const state = this.opts.store.getState();
    this.screen = new ScreenUI(state, this.opts.fonts, tier.mobile, renderer.capabilities.getMaxAnisotropy());
    this.computer = createComputer(mats, this.screen.texture, { lights: tier.extraLights });
    this.room = createRoom(mats, { lights: tier.extraLights, photo: profile.image });
    this.atmosphere = createAtmosphere(mats, {
      stars: tier.stars,
      clouds: true,
      bugs: tier.bugs,
      bugsOrigin: new Vector3(KEYBOARD_CENTER.x, KEYBOARD_CENTER.y + 0.05, KEYBOARD_CENTER.z),
      steamOrigin: MUG_TOP,
    });
    scene.add(this.room.root, this.computer.root, this.atmosphere.root);
    this.props = [...this.room.props.slice(0, 2), ...this.computer.props, ...this.room.props.slice(2)];

    try {
      this.skills = await createSkillsRing(renderer.capabilities.getMaxAnisotropy());
      scene.add(this.skills.mesh);
    } catch {
      this.skills = null;
    }
    if (this.disposed) return;

    this.setupHotspots();
    this.bindEvents();
    this.resize();
    this.rig.measure();
    this.rig.snap(window.scrollY);

    if (!this.opts.reducedMotion) {
      for (const p of this.props) p.scale.setScalar(0.0001);
    }

    // Compile every shader up front so the first animated frames do not hitch.
    try {
      if (renderer.extensions.has("KHR_parallel_shader_compile")) await renderer.compileAsync(scene, this.camera);
      else renderer.compile(scene, this.camera);
    } catch {
      /* precompiling is an optimization only */
    }
    if (this.disposed) return;

    this.start();
    this.preloadProjectImages();
  }

  private start() {
    this.last = performance.now();
    this.running = true;
    this.introClock = 0;
    this.rig.startIntro();
    if (this.opts.reducedMotion) this.screen.wake();
    else this.screen.boot();
    this.renderer.setAnimationLoop(this.tick);
  }

  private preloadProjectImages() {
    const load = () => {
      const run = async () => {
        for (const p of projects) {
          if (this.disposed) return;
          try {
            const img = await loadImage(p.image);
            this.screen.setImage(p.image, img);
          } catch {
            /* the screen keeps its skeleton state */
          }
        }
      };
      void run();
    };
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(load, { timeout: 4000 });
      this.cleanups.push(() => window.cancelIdleCallback(id));
    } else {
      const id = window.setTimeout(load, 1500);
      this.cleanups.push(() => window.clearTimeout(id));
    }
  }

  private setupHotspots() {
    const c = this.computer;
    const r = this.room;
    this.scene.updateMatrixWorld(true);
    // Bounds of the solid meshes only: lights, sprites and additive glow cards are ignored.
    const solidBounds = (object: Object3D) => {
      const box = new Box3();
      const part = new Box3();
      object.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        const mat = o.material as Material;
        if (mat.blending === AdditiveBlending) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        part.copy(o.geometry.boundingBox!).applyMatrix4(o.matrixWorld);
        box.union(part);
      });
      return box.expandByScalar(0.03);
    };
    const make = (id: HotspotId, object: Object3D, label: () => string): Hotspot => ({
      id,
      object,
      box: solidBounds(object),
      label,
    });
    this.hotspots = [
      make("screen", c.screen, () => "Open my projects"),
      make("lamp", c.lamp, () => (this.lampOn ? "Turn the lamp off" : "Turn the lamp on")),
      make("tower", c.tower, () => `RGB: ${this.rgbModes[(this.rgbIndex + 1) % 3]}`),
      make("duck", r.duck, () => "Ask the debugging duck"),
      make("plant", r.plant, () => "Water the plant"),
      make("mug", c.mug, () => "More coffee"),
    ];
  }

  private bindEvents() {
    const toNdc = (clientX: number, clientY: number) => {
      const r = this.rect;
      this.pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    };
    const onPointerMove = (e: PointerEvent) => {
      toNdc(e.clientX, e.clientY);
      this.rig.setPointer(this.pointer.x, this.pointer.y);
      this.pointerOverUi = e.target instanceof Element && e.target.closest(UI_SELECTOR) !== null;
      this.pointerDirty = e.pointerType === "mouse";
    };
    const onPointerLeave = () => {
      this.pointer.set(9, 9);
      this.rig.setPointer(0, 0);
      this.pointerDirty = true;
    };
    const onClick = (e: MouseEvent) => {
      if (!this.hovered) {
        // touch devices: raycast on tap
        if (e.target instanceof Element && e.target.closest(UI_SELECTOR)) return;
        toNdc(e.clientX, e.clientY);
        this.pointerOverUi = false;
        this.hovered = this.pick();
        if (!this.hovered) return;
      }
      if (e.target instanceof Element && e.target.closest(UI_SELECTOR)) return;
      this.activate(this.hovered);
    };
    const onResize = () => this.resize();
    const onVisibility = () => {
      if (document.hidden) {
        this.renderer.setAnimationLoop(null);
      } else if (this.running) {
        this.last = performance.now();
        this.renderer.setAnimationLoop(this.tick);
      }
    };
    const onContextLost = (e: Event) => {
      e.preventDefault();
      this.renderer.setAnimationLoop(null);
    };
    const onContextRestored = () => {
      if (this.running) {
        this.last = performance.now();
        this.renderer.shadowMap.needsUpdate = true;
        this.renderer.setAnimationLoop(this.tick);
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("click", onClick);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    this.canvas.addEventListener("webglcontextlost", onContextLost);
    this.canvas.addEventListener("webglcontextrestored", onContextRestored);

    // Section positions change when fonts load or content reflows.
    const ro = new ResizeObserver(() => this.rig.measure());
    ro.observe(document.body);

    const unsubscribe = this.opts.store.subscribe((s: PortfolioState, prev: PortfolioState) => this.screen.setState(s, prev));
    const unKey = this.opts.store.onKey((key) => this.computer.pressKey(key));

    this.cleanups.push(() => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      this.canvas.removeEventListener("webglcontextlost", onContextLost);
      this.canvas.removeEventListener("webglcontextrestored", onContextRestored);
      ro.disconnect();
      unsubscribe();
      unKey();
      document.documentElement.style.cursor = "";
    });
  }

  private rect = { left: 0, top: 0, width: 1, height: 1 };
  private size = { w: 0, h: 0 };

  private resize() {
    // The container is sized to the large viewport (100lvh), so mobile URL-bar
    // animations do not reallocate the drawing buffer on every scroll.
    const w = this.opts.container.clientWidth || window.innerWidth;
    const h = this.opts.container.clientHeight || window.innerHeight;
    const r = this.opts.container.getBoundingClientRect();
    this.rect = { left: r.left, top: r.top, width: r.width || w, height: r.height || h };
    if (w === this.size.w && h === this.size.h) {
      this.rig.measure();
      return;
    }
    this.size = { w, h };
    this.renderer.setSize(w, h, false);
    this.rig.resize(w, h);
    this.atmosphere.setPixelRatio(this.dpr);
    this.rig.measure();
  }

  private pick(): Hotspot | null {
    if (this.pointerOverUi || Math.abs(this.pointer.x) > 1) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    let best: Hotspot | null = null;
    let bestDist = Infinity;
    const hit = new Vector3();
    for (const h of this.hotspots) {
      if (this.raycaster.ray.intersectBox(h.box, hit)) {
        const d = hit.distanceToSquared(this.raycaster.ray.origin);
        if (d < bestDist) {
          bestDist = d;
          best = h;
        }
      }
    }
    return best;
  }

  private activate(h: Hotspot) {
    switch (h.id) {
      case "screen":
        this.opts.onNavigate?.("projects");
        break;
      case "lamp":
        this.lampOn = !this.lampOn;
        this.computer.setLamp(this.lampOn);
        this.say(this.lampOn ? "Let there be light" : "Dark mode: on");
        break;
      case "tower":
        this.rgbIndex = (this.rgbIndex + 1) % this.rgbModes.length;
        this.computer.setRgb(this.rgbModes[this.rgbIndex]);
        this.say(`RGB mode: ${this.rgbModes[this.rgbIndex]}`);
        break;
      case "duck":
        this.duckT = 0;
        this.say("Quack! Found the bug. It was a missing semicolon.");
        "quack".split("").forEach((k, i) => window.setTimeout(() => this.computer.pressKey(k), i * 90));
        break;
      case "plant":
        this.plantT = 0;
        this.say("Thanks! Growth takes consistency, just like SEO.");
        break;
      case "mug":
        this.say("Refilled. Shipping speed +10%");
        break;
    }
  }

  private say(label: string) {
    this.flash = { label, until: performance.now() + 2200 };
    this.opts.onHover?.(label);
  }

  private tick = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const motion = this.opts.reducedMotion ? 0 : 1;
    this.time += dt * motion;
    const t = this.time;

    this.rig.update(dt, window.scrollY, t);

    // intro: props pop in one after another, shadows follow until it ends
    if (this.introClock >= 0) {
      this.introClock += dt;
      let done = true;
      this.props.forEach((p, i) => {
        const local = clamp((this.introClock - 0.35 - i * 0.075) / 0.55);
        if (local < 1) done = false;
        if (!this.opts.reducedMotion) p.scale.setScalar(Math.max(0.0001, easeOutBack(local)));
      });
      if (done && this.rig.introDone) {
        this.introClock = -1;
        this.props.forEach((p) => p.scale.setScalar(1));
        this.renderer.shadowMap.autoUpdate = false;
        this.renderer.shadowMap.needsUpdate = true;
      }
    }

    this.computer.update(dt, t, motion);
    this.atmosphere.update(t);
    const state = this.opts.store.getState();
    this.skills?.update(dt, t, this.rig.weights.skills, state.skillCategory, motion, this.camera.position, this.rig.target, this.camera);
    this.screen.update(dt);

    // easter-egg animations
    if (this.duckT < 1) {
      this.duckT = Math.min(1, this.duckT + dt / 0.7);
      const k = this.duckT;
      this.room.duck.position.y = 2.135 + Math.sin(k * Math.PI) * 0.16;
      this.room.duck.rotation.y = 0.55 + k * Math.PI * 2;
    }
    if (this.plantT < 1) {
      this.plantT = Math.min(1, this.plantT + dt / 1.2);
      const k = this.plantT;
      this.room.plant.rotation.z = Math.sin(k * Math.PI * 6) * 0.06 * (1 - k);
      this.room.plant.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.08);
    }

    // hover detection, once per frame at most
    if (this.pointerDirty) {
      this.pointerDirty = false;
      const next = this.pick();
      if (next !== this.hovered) {
        this.hovered = next;
        document.documentElement.style.cursor = next ? "pointer" : "";
        if (!this.flash) this.opts.onHover?.(next ? next.label() : null);
      }
    }
    if (this.flash && now > this.flash.until) {
      this.flash = null;
      this.opts.onHover?.(this.hovered ? this.hovered.label() : null);
    }

    this.renderer.render(this.scene, this.camera);
    this.adaptQuality(dt);
  };

  /** Lower the pixel ratio when frames run long, raise it again with headroom. */
  private adaptQuality(dt: number) {
    this.frameAcc += dt;
    this.frameCount++;
    if (this.frameAcc < 1.5) return;
    const avg = this.frameAcc / this.frameCount;
    this.frameAcc = 0;
    this.frameCount = 0;
    const max = Math.min(window.devicePixelRatio || 1, this.tier.maxDpr);
    if (avg > 1 / 38 && this.dpr > 0.75) {
      this.dpr = Math.max(0.75, this.dpr - 0.25);
      this.goodStreak = 0;
      this.renderer.setPixelRatio(this.dpr);
      this.atmosphere.setPixelRatio(this.dpr);
    } else if (avg < 1 / 55 && this.dpr < max) {
      if (++this.goodStreak >= 3) {
        this.goodStreak = 0;
        this.dpr = Math.min(max, this.dpr + 0.25);
        this.renderer.setPixelRatio(this.dpr);
        this.atmosphere.setPixelRatio(this.dpr);
      }
    } else {
      this.goodStreak = 0;
    }
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.cleanups.forEach((fn) => fn());
    this.screen?.dispose();
    this.skills?.dispose();
    this.room?.dispose();
    this.computer?.dispose();
    this.atmosphere?.dispose();
    this.envTexture?.dispose();
    this.scene.traverse((o) => {
      const node = o as Object3D & { geometry?: { dispose(): void }; material?: Material | Material[] };
      node.geometry?.dispose();
      if (!node.material) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach((m) => {
        for (const value of Object.values(m)) {
          if (value && typeof value === "object" && "isTexture" in value) (value as Texture).dispose();
        }
        m.dispose();
      });
    });
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.canvas.remove();
  }
}

export async function createWorld(opts: WorldOptions) {
  const world = new World(opts);
  await world.init();
  return world;
}
