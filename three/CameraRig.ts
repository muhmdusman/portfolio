import { type PerspectiveCamera, Vector3 } from "three";
import type { SectionId } from "@/content/portfolio";
import { clamp, damp, easeInOutCubic, lerp } from "./core/math";

/**
 * Scroll-driven camera choreography. Each section owns a shot; while the
 * next section enters the viewport the camera eases from one shot to the
 * next, then holds. Pointer parallax and damping are layered on top.
 */

interface Shot {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** Screen-space shift of the scene, as a fraction of the viewport (x: right, y: up). */
  offset: [number, number];
}

const WIDE: Record<SectionId, Shot> = {
  home: { pos: [7.4, 5.0, 8.4], target: [-0.15, 0.9, -0.7], fov: 34, offset: [0.2, 0.0] },
  skills: { pos: [9.8, 6.9, 11.8], target: [-0.1, 1.2, 0.0], fov: 34, offset: [0.19, 0.02] },
  projects: { pos: [1.0, 1.8, 0.3], target: [0.36, 1.275, -2.17], fov: 33, offset: [0.22, 0.0] },
  experience: { pos: [2.0, 1.85, -0.3], target: [0.55, 1.4, -2.1], fov: 40, offset: [0.21, 0.0] },
  contact: { pos: [0.85, 1.8, 0.05], target: [0.42, 1.06, -1.98], fov: 38, offset: [0.21, 0.0] },
};

const TALL: Record<SectionId, Shot> = {
  home: { pos: [8.4, 6.5, 10.2], target: [0.0, 1.0, -0.4], fov: 44, offset: [0, 0.2] },
  skills: { pos: [11.2, 8.6, 13.8], target: [0.0, 1.2, 0.0], fov: 46, offset: [0, 0.22] },
  projects: { pos: [0.55, 1.95, 1.35], target: [0.35, 1.25, -2.17], fov: 40, offset: [0, 0.27] },
  experience: { pos: [2.4, 2.5, 1.2], target: [0.3, 1.3, -2.05], fov: 44, offset: [0, 0.25] },
  contact: { pos: [0.6, 2.4, 1.3], target: [0.4, 1.1, -1.95], fov: 44, offset: [0, 0.27] },
};

const INTRO: Shot = { pos: [15, 12, 17], target: [0, 0.4, 0], fov: 40, offset: [0, 0] };

const ORDER: SectionId[] = ["home", "skills", "projects", "experience", "contact"];

interface Pose {
  pos: Vector3;
  target: Vector3;
  fov: number;
  ox: number;
  oy: number;
}

const makePose = (): Pose => ({ pos: new Vector3(), target: new Vector3(), fov: 40, ox: 0, oy: 0 });

function setPose(p: Pose, s: Shot) {
  p.pos.set(...s.pos);
  p.target.set(...s.target);
  p.fov = s.fov;
  p.ox = s.offset[0];
  p.oy = s.offset[1];
}

function mixPose(out: Pose, a: Pose, b: Pose, t: number) {
  out.pos.lerpVectors(a.pos, b.pos, t);
  out.target.lerpVectors(a.target, b.target, t);
  out.fov = lerp(a.fov, b.fov, t);
  out.ox = lerp(a.ox, b.ox, t);
  out.oy = lerp(a.oy, b.oy, t);
}

export class CameraRig {
  /** How much each section's shot contributes right now (0..1). */
  readonly weights: Record<SectionId, number> = { home: 1, skills: 0, projects: 0, experience: 0, contact: 0 };

  private tops: number[] = ORDER.map(() => 0);
  private tall = false;
  private narrow = false;
  private readonly cur = makePose();
  private readonly desired = makePose();
  private readonly a = makePose();
  private readonly b = makePose();
  private readonly intro = makePose();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly tmp = new Vector3();
  private pointerX = 0;
  private pointerY = 0;
  private px = 0;
  private py = 0;
  private introT = 1;
  private width = 1;
  private height = 1;
  private lastFov = 0;
  private lastOx = 99;
  private lastOy = 99;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly reducedMotion: boolean,
  ) {
    setPose(this.intro, INTRO);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tall = width / height < 0.85;
    this.narrow = !this.tall && width < 1180;
    this.camera.aspect = width / height;
    this.lastFov = 0;
  }

  measure() {
    ORDER.forEach((id, i) => {
      const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
      this.tops[i] = el ? el.getBoundingClientRect().top + window.scrollY : i * this.height;
    });
  }

  setPointer(x: number, y: number) {
    this.pointerX = x;
    this.pointerY = y;
  }

  startIntro() {
    this.introT = this.reducedMotion ? 1 : 0;
  }

  /** The point the camera currently looks at. */
  get target(): Vector3 {
    return this.cur.target;
  }

  get introDone() {
    return this.introT >= 1;
  }

  /** Jump straight to the current scroll pose (no damping). */
  snap(scrollY: number) {
    this.computeDesired(scrollY);
    this.copy(this.cur, this.desired);
    this.apply();
  }

  update(dt: number, scrollY: number, time: number) {
    this.computeDesired(scrollY);

    if (this.introT < 1) {
      this.introT = clamp(this.introT + dt / 2.8);
      const t = easeInOutCubic(this.introT);
      mixPose(this.cur, this.intro, this.desired, t);
    } else {
      const k = 3.2;
      this.cur.pos.x = damp(this.cur.pos.x, this.desired.pos.x, k, dt);
      this.cur.pos.y = damp(this.cur.pos.y, this.desired.pos.y, k, dt);
      this.cur.pos.z = damp(this.cur.pos.z, this.desired.pos.z, k, dt);
      this.cur.target.x = damp(this.cur.target.x, this.desired.target.x, k, dt);
      this.cur.target.y = damp(this.cur.target.y, this.desired.target.y, k, dt);
      this.cur.target.z = damp(this.cur.target.z, this.desired.target.z, k, dt);
      this.cur.fov = damp(this.cur.fov, this.desired.fov, k, dt);
      this.cur.ox = damp(this.cur.ox, this.desired.ox, k, dt);
      this.cur.oy = damp(this.cur.oy, this.desired.oy, k, dt);
    }

    // pointer parallax + a gentle idle sway
    if (!this.reducedMotion) {
      this.px = damp(this.px, this.pointerX, 2.5, dt);
      this.py = damp(this.py, this.pointerY, 2.5, dt);
    }
    this.apply(time);
  }

  private computeDesired(scrollY: number) {
    const shots = this.tall ? TALL : WIDE;
    const vh = this.height;
    // Transition into section i while its top travels from 85% to 15% of the viewport.
    let index = 0;
    let t = 0;
    for (let i = 1; i < ORDER.length; i++) {
      const start = this.tops[i] - vh * 0.85;
      if (scrollY >= start) {
        index = i;
        t = clamp((scrollY - start) / (vh * 0.7));
      }
    }
    for (const id of ORDER) this.weights[id] = 0;
    if (index === 0) {
      setPose(this.desired, shots.home);
      this.weights.home = 1;
    } else {
      const from = ORDER[index - 1];
      const to = ORDER[index];
      setPose(this.a, shots[from]);
      setPose(this.b, shots[to]);
      const e = easeInOutCubic(t);
      mixPose(this.desired, this.a, this.b, e);
      this.weights[from] = 1 - e;
      this.weights[to] = e;
    }
    if (this.narrow) this.desired.ox *= 1.18;
  }

  private copy(out: Pose, src: Pose) {
    out.pos.copy(src.pos);
    out.target.copy(src.target);
    out.fov = src.fov;
    out.ox = src.ox;
    out.oy = src.oy;
  }

  private apply(time = 0) {
    const cam = this.camera;
    cam.position.copy(this.cur.pos);
    // parallax is proportional to the distance to the target
    this.tmp.subVectors(this.cur.pos, this.cur.target);
    const dist = this.tmp.length();
    this.right.crossVectors(cam.up, this.tmp).normalize();
    this.up.crossVectors(this.tmp, this.right).normalize();
    const sway = this.reducedMotion ? 0 : Math.sin(time * 0.35) * 0.012;
    cam.position.addScaledVector(this.right, (this.px * 0.035 + sway) * dist);
    cam.position.addScaledVector(this.up, this.py * 0.022 * dist);
    cam.lookAt(this.cur.target);

    const fovChanged = Math.abs(this.cur.fov - this.lastFov) > 1e-4;
    const offChanged = Math.abs(this.cur.ox - this.lastOx) > 1e-5 || Math.abs(this.cur.oy - this.lastOy) > 1e-5;
    if (fovChanged || offChanged) {
      cam.fov = this.cur.fov;
      cam.setViewOffset(this.width, this.height, -this.cur.ox * this.width, this.cur.oy * this.height, this.width, this.height);
      this.lastFov = this.cur.fov;
      this.lastOx = this.cur.ox;
      this.lastOy = this.cur.oy;
    }
  }
}
