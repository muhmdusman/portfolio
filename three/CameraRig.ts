import { MathUtils, type PerspectiveCamera, Vector3 } from "three";
import type { SectionId } from "@/content/portfolio";
import { clamp, damp, easeInOutCubic, lerp, smoothstep } from "./core/math";
import { ROOM } from "./objects/Room";

/**
 * Scroll-driven camera choreography inside the room. Each section owns a
 * shot; while the next section enters the viewport the camera eases from one
 * shot to the next, then holds. Pointer parallax and damping are layered on top.
 *
 * Dragging orbits the camera around a pivot on its line of sight, so the
 * visitor can look around the whole room. The camera is kept inside the
 * walls, and scrolling eases the view back to the section's shot.
 */

interface Shot {
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  /**
   * Screen-space shift of the target, as a fraction of the viewport (x: right, y: up).
   * On wide screens x is relative to the centre of the free area right of the text column.
   */
  offset: [number, number];
}

/**
 * Wide shots are tuned for 1440x900, where the free area right of the text
 * column is 49% of the width. Other sizes keep the subject inside that area
 * by scaling the field of view (see `frame`).
 */
const WIDE_REF = 1.6 * 0.493;
const WIDE: Record<SectionId, Shot> = {
  // from the doorway corner, looking across the rug at the desk
  home: { pos: [1.95, 1.95, 1.85], target: [-0.3, 1.05, -1.2], fov: 56, offset: [-0.03, 0.0] },
  skills: { pos: [2.0, 2.55, 1.85], target: [-0.3, 1.0, -0.9], fov: 60, offset: [-0.04, 0.02] },
  // close-ups: the 1.44 m monitor fills the free area, the keyboard sits below it
  projects: { pos: [0.98, 1.78, 1.05], target: [0.37, 1.35, -2.165], fov: 33, offset: [0, 0.0] },
  experience: { pos: [1.45, 1.9, 0.78], target: [0.42, 1.37, -2.165], fov: 33, offset: [0, 0.0] },
  contact: { pos: [0.78, 2.3, 0.92], target: [0.36, 1.2, -2.0], fov: 35, offset: [0, 0.0] },
};

/** Tall shots are tuned for 390x844; the scene owns the top ~46% of the screen. */
const TALL_REF = 390 / 844;
const TALL: Record<SectionId, Shot> = {
  home: { pos: [1.9, 2.1, 1.85], target: [0.1, 1.05, -1.0], fov: 74, offset: [0, 0.2] },
  skills: { pos: [2.0, 2.7, 1.85], target: [0.0, 1.1, -0.8], fov: 78, offset: [0, 0.22] },
  projects: { pos: [0.62, 1.95, 1.85], target: [0.36, 1.32, -2.165], fov: 46, offset: [0, 0.26] },
  experience: { pos: [1.0, 2.1, 1.85], target: [0.38, 1.34, -2.165], fov: 46, offset: [0, 0.26] },
  contact: { pos: [0.6, 2.7, 1.85], target: [0.36, 1.15, -1.95], fov: 47, offset: [0, 0.2] },
};

/** Sections where the camera is at the desk. */
export const CLOSE_UPS: SectionId[] = ["projects", "experience", "contact"];

/** The intro starts high in the doorway corner, looking down at the floor. */
const INTRO: Shot = { pos: [2.0, 2.85, 1.85], target: [0.0, 0.2, -0.8], fov: 66, offset: [0, 0] };

const ORDER: SectionId[] = ["home", "skills", "projects", "experience", "contact"];

/**
 * Where the camera may go: inside the walls, above the sofa and desk, and in
 * front of the desk. Every shot sits inside this box.
 */
const BOUNDS = {
  min: new Vector3(-ROOM.half + 0.3, 0.9, -1.3),
  max: new Vector3(ROOM.half - 0.3, ROOM.height - 0.3, ROOM.half - 0.45),
};
/**
 * The orbit pivot is the point of the line of sight closest to this spot on
 * the open floor in front of the rug, so the office chair rarely ends up
 * between the camera and what it looks at.
 */
const LOOK_HUB = new Vector3(0.3, 1.35, 0.35);
/** Camera elevation around the pivot, in radians (negative looks up at the ceiling). */
const MIN_ELEVATION = -0.75;
const MAX_ELEVATION = 1.2;
/**
 * As the view turns away from the shot, the orbit tightens to this radius so
 * the camera looks around from the middle of the room, not from a wall.
 */
const LOOK_RADIUS = 1.1;
/** Close-ups use long lenses; looking around widens the view to at least this (degrees). */
const LOOK_FOV = 52;
/** Radians turned per drag across the full viewport width / height. */
const YAW_PER_WIDTH = 3.4;
const PITCH_PER_HEIGHT = 2.2;
/** Fastest flick that keeps spinning after release, in radians per second. */
const MAX_THROW = 6;

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

const AXES = ["x", "y", "z"] as const;

/** Distance from `p` (inside the box) along the unit vector `u` to the box surface. */
function exitDistance(p: Vector3, u: Vector3, min: Vector3, max: Vector3) {
  let s = Infinity;
  for (const a of AXES) {
    if (u[a] > 1e-6) s = Math.min(s, (max[a] - p[a]) / u[a]);
    else if (u[a] < -1e-6) s = Math.min(s, (min[a] - p[a]) / u[a]);
  }
  return Math.max(0, s);
}

export class CameraRig {
  /** How much each section's shot contributes right now (0..1). */
  readonly weights: Record<SectionId, number> = { home: 1, skills: 0, projects: 0, experience: 0, contact: 0 };

  private tops: number[] = ORDER.map(() => 0);
  private tall = false;
  /** Horizontal shift that centres a shot in the free area, and the matching zoom. */
  private baseOx = 0;
  private fovScale = 1;
  private readonly cur = makePose();
  private readonly desired = makePose();
  private readonly a = makePose();
  private readonly b = makePose();
  private readonly intro = makePose();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly tmp = new Vector3();
  private readonly ray = new Vector3();
  private readonly pivot = new Vector3();
  private readonly orbit = new Vector3();
  private readonly eye = new Vector3();
  private readonly look = new Vector3();
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

  // look-around: offsets from the shot, the values the drag asks for, and the throw speed
  private yaw = 0;
  private pitch = 0;
  private yawGoal = 0;
  private pitchGoal = 0;
  private yawVel = 0;
  private pitchVel = 0;
  /** Drag movement since the last speed sample, and when the pointer last moved. */
  private sample = { yaw: 0, pitch: 0, at: 0 };
  private lastMoveAt = 0;
  private dragging = false;
  private recentering = false;
  private lastScroll = Number.NaN;
  /** Elevation of the current shot around its pivot, used to clamp the pitch. */
  private baseElevation = 0;

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
    this.camera.aspect = width / height;
    this.lastFov = 0;
  }

  measure() {
    ORDER.forEach((id, i) => {
      const el = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
      this.tops[i] = el ? el.getBoundingClientRect().top + window.scrollY : i * this.height;
    });
    let panelRight = 0;
    for (const el of document.querySelectorAll<HTMLElement>(".hero, [data-ui]")) {
      panelRight = Math.max(panelRight, el.getBoundingClientRect().right);
    }
    this.frame(panelRight);
  }

  /**
   * Fits shots to the layout. Wide screens centre the subject in the area
   * right of the text column and zoom so it fills that area like it does at
   * 1440x900. Tall screens keep the subject's width across phone sizes.
   */
  private frame(panelRight: number) {
    const w = this.width;
    const aspect = w / this.height;
    let baseOx = 0;
    let fovScale = 1;
    if (this.tall) {
      fovScale = clamp(TALL_REF / aspect, 0.85, 1.3);
    } else if (w > 860) {
      const margin = w * 0.02;
      const left = Math.min((panelRight || w * 0.45) + margin, w * 0.72);
      const right = w - margin;
      baseOx = (left + right) / 2 / w - 0.5;
      fovScale = clamp(WIDE_REF / (aspect * ((right - left) / w)), 0.92, 1.5);
    }
    if (baseOx !== this.baseOx || fovScale !== this.fovScale) {
      this.baseOx = baseOx;
      this.fovScale = fovScale;
      this.lastFov = 0;
    }
  }

  setPointer(x: number, y: number) {
    this.pointerX = x;
    this.pointerY = y;
  }

  /** The visitor started dragging the room. */
  beginDrag() {
    this.dragging = true;
    this.recentering = false;
    this.yawVel = 0;
    this.pitchVel = 0;
    this.lastMoveAt = performance.now();
    this.sample = { yaw: 0, pitch: 0, at: this.lastMoveAt };
  }

  /** The pointer moved by (dx, dy) CSS pixels during a drag. Dragging right turns the room right. */
  drag(dx: number, dy: number) {
    if (!this.dragging) return;
    const yaw = -(dx / this.width) * YAW_PER_WIDTH;
    const before = this.pitchGoal;
    this.yawGoal += yaw;
    this.pitchGoal = this.clampPitch(this.pitchGoal + (dy / this.height) * PITCH_PER_HEIGHT);

    // Throw speed from real time between pointer events, not from frames
    // (frame time is capped, which would overstate the speed on slow devices).
    const now = performance.now();
    this.lastMoveAt = now;
    this.sample.yaw += yaw;
    this.sample.pitch += this.pitchGoal - before;
    const elapsed = (now - this.sample.at) / 1000;
    if (elapsed >= 0.012) {
      const k = elapsed < 0.1 ? 0.35 : 1;
      this.yawVel = lerp(this.yawVel, this.sample.yaw / elapsed, k);
      this.pitchVel = lerp(this.pitchVel, this.sample.pitch / elapsed, k);
      this.sample = { yaw: 0, pitch: 0, at: now };
    }
  }

  /** The drag ended; a quick flick keeps a little momentum. */
  endDrag() {
    this.dragging = false;
    const rested = performance.now() - this.lastMoveAt > 80;
    if (this.reducedMotion || rested) {
      this.yawVel = 0;
      this.pitchVel = 0;
    } else {
      this.yawVel = clamp(this.yawVel, -MAX_THROW, MAX_THROW);
      this.pitchVel = clamp(this.pitchVel, -MAX_THROW, MAX_THROW);
    }
  }

  private clampPitch(p: number) {
    return clamp(p, MIN_ELEVATION - this.baseElevation, MAX_ELEVATION - this.baseElevation);
  }

  startIntro() {
    this.introT = this.reducedMotion ? 1 : 0;
  }

  /** The point the camera currently looks at. */
  get target(): Vector3 {
    return this.look;
  }

  get introDone() {
    return this.introT >= 1;
  }

  /** Jump straight to the current scroll pose (no damping). */
  snap(scrollY: number) {
    this.computeDesired(scrollY);
    this.copy(this.cur, this.desired);
    this.lastScroll = scrollY;
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

    this.updateLook(dt, scrollY);

    // pointer parallax + a gentle idle sway (paused while dragging)
    if (!this.reducedMotion && !this.dragging) {
      this.px = damp(this.px, this.pointerX, 2.5, dt);
      this.py = damp(this.py, this.pointerY, 2.5, dt);
    }
    this.apply(time);
  }

  private updateLook(dt: number, scrollY: number) {
    // Scrolling hands the camera back to the section's shot.
    if (!this.dragging && Number.isFinite(this.lastScroll) && Math.abs(scrollY - this.lastScroll) > 0.5) {
      this.recentering = true;
      this.yawVel = 0;
      this.pitchVel = 0;
    }
    this.lastScroll = scrollY;

    // Whole turns change nothing on screen, so take the short way back.
    const turns = Math.round(this.yawGoal / (Math.PI * 2));
    if (turns !== 0) {
      this.yawGoal -= turns * Math.PI * 2;
      this.yaw -= turns * Math.PI * 2;
    }

    if (this.dragging) {
      // the pointer drives the goal directly
    } else if (this.recentering) {
      this.yawGoal = this.reducedMotion ? 0 : damp(this.yawGoal, 0, 2.4, dt);
      this.pitchGoal = this.reducedMotion ? 0 : damp(this.pitchGoal, 0, 2.4, dt);
      if (Math.abs(this.yawGoal) < 1e-3 && Math.abs(this.pitchGoal) < 1e-3) {
        this.yawGoal = 0;
        this.pitchGoal = 0;
        this.recentering = false;
      }
    } else if (this.yawVel !== 0 || this.pitchVel !== 0) {
      this.yawGoal += this.yawVel * dt;
      this.pitchGoal = this.clampPitch(this.pitchGoal + this.pitchVel * dt);
      const decay = Math.exp(-5 * dt);
      this.yawVel *= decay;
      this.pitchVel *= decay;
      if (Math.abs(this.yawVel) < 1e-3 && Math.abs(this.pitchVel) < 1e-3) {
        this.yawVel = 0;
        this.pitchVel = 0;
      }
    }
    if (this.reducedMotion) {
      this.yaw = this.yawGoal;
      this.pitch = this.pitchGoal;
    } else {
      this.yaw = damp(this.yaw, this.yawGoal, 14, dt);
      this.pitch = damp(this.pitch, this.pitchGoal, 14, dt);
    }
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
  }

  private copy(out: Pose, src: Pose) {
    out.pos.copy(src.pos);
    out.target.copy(src.target);
    out.fov = src.fov;
    out.ox = src.ox;
    out.oy = src.oy;
  }

  /**
   * Places the camera. With no drag offset this is exactly the shot: the
   * camera sits at `pos` and looks at `target`. Dragging rotates the camera
   * around a pivot on that line of sight; if the new spot would leave the
   * room, the camera moves in towards the pivot instead.
   */
  private apply(time = 0) {
    const cam = this.camera;
    const { pos, target } = this.cur;
    this.eye.copy(pos).clamp(BOUNDS.min, BOUNDS.max);
    this.ray.subVectors(target, this.eye);
    const dist = this.ray.length();
    this.ray.divideScalar(dist);

    // pivot: the point of the line of sight nearest the hub, kept inside the bounds
    const along = this.tmp.subVectors(LOOK_HUB, this.eye).dot(this.ray);
    const inside = exitDistance(this.eye, this.ray, BOUNDS.min, BOUNDS.max);
    const reach = Math.min(clamp(along, dist * 0.15, dist), inside * 0.98);
    this.pivot.copy(this.eye).addScaledVector(this.ray, reach);

    // orbit offset from the pivot to the camera, in spherical angles
    this.orbit.subVectors(this.eye, this.pivot);
    const radius = this.orbit.length();
    let looking = 0;
    if (radius > 1e-4) {
      const yaw0 = Math.atan2(this.orbit.x, this.orbit.z);
      const el0 = Math.asin(clamp(this.orbit.y / radius, -1, 1));
      this.baseElevation = el0;
      const yaw = yaw0 + this.yaw;
      const el = clamp(el0 + this.pitch, Math.min(el0, MIN_ELEVATION), Math.max(el0, MAX_ELEVATION));
      this.orbit.set(Math.cos(el) * Math.sin(yaw), Math.sin(el), Math.cos(el) * Math.cos(yaw));
      // 0 at the shot, 1 once the view has turned well away from it
      const turned = Math.abs(Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw))) + 0.6 * Math.abs(el - el0);
      looking = smoothstep(0.25, 1.6, turned);
      const wanted = lerp(radius, Math.min(radius, LOOK_RADIUS), looking);
      const r = Math.min(wanted, exitDistance(this.pivot, this.orbit, BOUNDS.min, BOUNDS.max));
      this.eye.copy(this.pivot).addScaledVector(this.orbit, r);
    } else {
      this.orbit.copy(this.ray).negate();
    }
    const fov = lerp(this.cur.fov, Math.max(this.cur.fov, LOOK_FOV), looking);
    // the camera looks through the pivot, at the shot's distance
    this.look.copy(this.eye).addScaledVector(this.orbit, -dist);

    // parallax is proportional to the viewing distance
    this.right.crossVectors(cam.up, this.orbit).normalize();
    this.up.crossVectors(this.orbit, this.right).normalize();
    const sway = this.reducedMotion ? 0 : Math.sin(time * 0.35) * 0.012;
    cam.position.copy(this.eye);
    cam.position.addScaledVector(this.right, (this.px * 0.035 + sway) * dist);
    cam.position.addScaledVector(this.up, this.py * 0.022 * dist);
    cam.position.clamp(BOUNDS.min, BOUNDS.max);
    cam.lookAt(this.look);

    const fovChanged = Math.abs(fov - this.lastFov) > 1e-4;
    const offChanged = Math.abs(this.cur.ox - this.lastOx) > 1e-5 || Math.abs(this.cur.oy - this.lastOy) > 1e-5;
    if (fovChanged || offChanged) {
      cam.fov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(fov) / 2) * this.fovScale));
      const ox = this.baseOx + this.cur.ox;
      cam.setViewOffset(this.width, this.height, -ox * this.width, this.cur.oy * this.height, this.width, this.height);
      this.lastFov = fov;
      this.lastOx = this.cur.ox;
      this.lastOy = this.cur.oy;
    }
  }
}
