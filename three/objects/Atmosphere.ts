import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  type Group,
  SphereGeometry,
  InstancedMesh,
  Matrix4,
  Points,
  Quaternion,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  Euler,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { group, type Materials } from "../core/kit";
import { mulberry32 } from "../core/math";
import { moonTexture } from "../core/textures";

/** Sky dome stars, the moon, a sea of low-poly clouds and rising particles. */

const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vTwinkle;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vTwinkle = 0.55 + 0.45 * sin(uTime * (0.5 + aSeed * 1.8) + aSeed * 40.0);
    gl_PointSize = aSize * uPixelRatio * (0.7 + 0.3 * vTwinkle);
  }
`;

const starFragment = /* glsl */ `
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(0.82, 0.88, 1.0, a * vTwinkle);
  }
`;

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

/** A puffy cumulus: one big puff, a ring of smaller ones and a flat base. */
function cloudGeometry() {
  const rand = mulberry32(5);
  const puffs: Array<[number, number, number, number]> = [[0, 0.25, 0, 0.62]];
  const ring = 6;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2 + rand() * 0.3;
    const r = 0.38 + rand() * 0.18;
    puffs.push([Math.cos(a) * 0.62, 0.05 + rand() * 0.12, Math.sin(a) * 0.38, r]);
  }
  const parts = puffs.map(([x, y, z, r]) => {
    const g = new SphereGeometry(r, 28, 18);
    g.translate(x, y, z);
    return g;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  // flatten the underside
  const pos = merged.getAttribute("position");
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < -0.05) pos.setY(i, -0.05 + (pos.getY(i) + 0.05) * 0.25);
  }
  merged.computeVertexNormals();
  return merged;
}

export interface AtmosphereParts {
  root: Group;
  update(time: number): void;
  setPixelRatio(pr: number): void;
  dispose(): void;
}

export function createAtmosphere(
  mats: Materials,
  opts: { stars: number; clouds: boolean; bugsOrigin: Vector3; steamOrigin: Vector3; bugs: number },
): AtmosphereParts {
  const root = group("atmosphere");
  const rand = mulberry32(99);
  const disposables: Array<{ dispose(): void }> = [];

  // stars
  const starGeo = new BufferGeometry();
  const pos = new Float32Array(opts.stars * 3);
  const sizes = new Float32Array(opts.stars);
  const seeds = new Float32Array(opts.stars);
  for (let i = 0; i < opts.stars; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(rand() * 1.3 - 0.3);
    const r = 55 + rand() * 25;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi) - 6;
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    sizes[i] = rand() > 0.94 ? 3.2 + rand() * 1.5 : 1.2 + rand() * 1.4;
    seeds[i] = rand();
  }
  starGeo.setAttribute("position", new BufferAttribute(pos, 3));
  starGeo.setAttribute("aSize", new BufferAttribute(sizes, 1));
  starGeo.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  const starMat = new ShaderMaterial({
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
  });
  const stars = new Points(starGeo, starMat);
  stars.frustumCulled = false;
  root.add(stars);
  disposables.push(starGeo, starMat);

  // moon
  const moonTex = moonTexture();
  const moonMat = new SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, toneMapped: false });
  const moon = new Sprite(moonMat);
  moon.scale.setScalar(16);
  moon.position.set(-30, 21, -38);
  root.add(moon);
  disposables.push(moonTex, moonMat);

  // clouds
  const cloudUpdates: Array<{ base: Vector3; scale: Vector3; rot: Quaternion; phase: number; amp: number }> = [];
  let clouds: InstancedMesh | null = null;
  if (opts.clouds) {
    const geo = cloudGeometry();
    disposables.push(geo);
    const layout: Array<[angle: number, radius: number, y: number, scale: number]> = [];
    // a loose sea of clouds under the floating room
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.35;
      layout.push([a, 3.4 + rand() * 3.2, -3.3 + rand() * 0.7, 0.8 + rand() * 0.55]);
    }
    // a far layer behind the room, away from the camera side
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.62 + (i / 4) * 0.85) + rand() * 0.2;
      layout.push([a, 13 + rand() * 5, -1.5 + rand() * 3.5, 2.0 + rand() * 1.4]);
    }
    clouds = new InstancedMesh(geo, mats.cloud, layout.length);
    clouds.frustumCulled = false;
    const m = new Matrix4();
    layout.forEach(([a, r, y, s], i) => {
      const base = new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      const scale = new Vector3(s, s * (0.85 + rand() * 0.3), s);
      const rot = new Quaternion().setFromEuler(new Euler(0, -a + Math.PI / 2 + (rand() - 0.5) * 0.6, 0));
      cloudUpdates.push({ base, scale, rot, phase: rand() * Math.PI * 2, amp: 0.15 + rand() * 0.25 });
      m.compose(base, rot, scale);
      clouds!.setMatrixAt(i, m);
    });
    root.add(clouds);
  }

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
  disposables.push(bugs.geometry, bugs.material, steam.geometry, steam.material);

  const m4 = new Matrix4();
  const tmp = new Vector3();

  return {
    root,
    update(time) {
      starMat.uniforms.uTime.value = time;
      (bugs.material as ShaderMaterial).uniforms.uTime.value = time;
      (steam.material as ShaderMaterial).uniforms.uTime.value = time;
      if (clouds) {
        cloudUpdates.forEach((c, i) => {
          tmp.copy(c.base);
          tmp.y += Math.sin(time * 0.35 + c.phase) * 0.08;
          tmp.x += Math.sin(time * 0.06 + c.phase) * c.amp;
          tmp.z += Math.cos(time * 0.05 + c.phase) * c.amp;
          m4.compose(tmp, c.rot, c.scale);
          clouds!.setMatrixAt(i, m4);
        });
        clouds.instanceMatrix.needsUpdate = true;
      }
    },
    setPixelRatio(pr) {
      starMat.uniforms.uPixelRatio.value = pr;
      (bugs.material as ShaderMaterial).uniforms.uPixelRatio.value = pr;
      (steam.material as ShaderMaterial).uniforms.uPixelRatio.value = pr;
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
