import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type Group, Points, ShaderMaterial, type Vector3 } from "three";
import { group } from "../core/kit";
import { mulberry32 } from "../core/math";

/** Small particle effects inside the room: fireflies above the keyboard and steam from the mug. */

const riseVertex = /* glsl */ `
  attribute vec3 aDir;
  attribute float aSeed;
  attribute float aSpeed;
  uniform float uTime;
  uniform vec3 uOrigin;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uSpread;
  uniform float uHeight;
  uniform float uWobble;
  varying float vAlpha;
  void main() {
    float p = fract(uTime * aSpeed + aSeed);
    vec3 pos = uOrigin + vec3(aDir.x * p * uSpread, p * uHeight * (0.55 + aDir.y), aDir.z * p * uSpread);
    pos.x += sin(uTime * 2.1 + aSeed * 31.0) * uWobble * (0.3 + p);
    pos.z += cos(uTime * 1.7 + aSeed * 17.0) * uWobble * (0.3 + p);
    pos.y += sin(uTime * 3.0 + aSeed * 11.0) * uWobble * 0.4;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = smoothstep(0.0, 0.12, p) * (1.0 - smoothstep(0.65, 1.0, p));
    float flicker = 0.65 + 0.35 * sin(uTime * 7.0 + aSeed * 50.0);
    gl_PointSize = min(uSize * uPixelRatio * flicker / -mv.z, 26.0 * uPixelRatio);
  }
`;

const riseFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor, a * a * vAlpha * uOpacity);
  }
`;

export interface RisingOptions {
  count: number;
  origin: Vector3;
  color: string;
  size: number;
  spread: number;
  height: number;
  speed: number;
  wobble: number;
  opacity: number;
  seed: number;
}

export function createRisingParticles(o: RisingOptions) {
  const rand = mulberry32(o.seed);
  const geo = new BufferGeometry();
  const positions = new Float32Array(o.count * 3);
  const dirs = new Float32Array(o.count * 3);
  const seeds = new Float32Array(o.count);
  const speeds = new Float32Array(o.count);
  for (let i = 0; i < o.count; i++) {
    const a = rand() * Math.PI * 2;
    dirs[i * 3] = Math.cos(a) * (0.3 + rand() * 0.7);
    dirs[i * 3 + 1] = rand() * 0.9;
    dirs[i * 3 + 2] = Math.sin(a) * (0.3 + rand() * 0.7);
    seeds[i] = rand();
    speeds[i] = o.speed * (0.6 + rand() * 0.8);
  }
  geo.setAttribute("position", new BufferAttribute(positions, 3));
  geo.setAttribute("aDir", new BufferAttribute(dirs, 3));
  geo.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  geo.setAttribute("aSpeed", new BufferAttribute(speeds, 1));
  const material = new ShaderMaterial({
    vertexShader: riseVertex,
    fragmentShader: riseFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOrigin: { value: o.origin.clone() },
      uPixelRatio: { value: 1 },
      uSize: { value: o.size },
      uSpread: { value: o.spread },
      uHeight: { value: o.height },
      uWobble: { value: o.wobble },
      uColor: { value: new Color(o.color) },
      uOpacity: { value: o.opacity },
    },
  });
  const points = new Points(geo, material);
  points.frustumCulled = false;
  return points;
}

export interface AtmosphereParts {
  root: Group;
  update(time: number): void;
  setPixelRatio(pr: number): void;
  dispose(): void;
}

export function createAtmosphere(opts: { bugsOrigin: Vector3; steamOrigin: Vector3; bugs: number }): AtmosphereParts {
  const root = group("atmosphere");

  // bugs taking flight (fireflies) + coffee steam
  const bugs = createRisingParticles({
    count: opts.bugs,
    origin: opts.bugsOrigin,
    color: "#ffe9a3",
    size: 46,
    spread: 2.6,
    height: 2.4,
    speed: 0.05,
    wobble: 0.07,
    opacity: 0.95,
    seed: 17,
  });
  const steam = createRisingParticles({
    count: 14,
    origin: opts.steamOrigin,
    color: "#cfe0ff",
    size: 34,
    spread: 0.07,
    height: 0.34,
    speed: 0.32,
    wobble: 0.02,
    opacity: 0.35,
    seed: 23,
  });
  root.add(bugs, steam);
  const materials = [bugs.material, steam.material] as ShaderMaterial[];

  return {
    root,
    update(time) {
      for (const m of materials) m.uniforms.uTime.value = time;
    },
    setPixelRatio(pr) {
      for (const m of materials) m.uniforms.uPixelRatio.value = pr;
    },
    dispose() {
      bugs.geometry.dispose();
      steam.geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
  };
}
