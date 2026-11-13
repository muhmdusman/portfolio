import {
  CanvasTexture,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";
import { skillCategories } from "@/content/portfolio";
import { icons } from "@/lib/icons";
import { clamp, mulberry32 } from "../core/math";
import { createCanvas, loadImage, roundRect, svgDataUrl } from "../core/textures";

/**
 * Every skill becomes a floating "app icon" circling inside the room. The icons of
 * the selected category leave the orbit and line up in front of the camera.
 * All icons share one atlas texture and render in a single instanced draw
 * call; orbit, formation and highlight run entirely in the vertex shader.
 */

const vertex = /* glsl */ `
  attribute vec4 aOrbit;      // angle, radius, height, seed
  attribute vec2 aCell;       // atlas cell origin (uv)
  attribute vec3 aSlot;       // category, index in category, category size
  uniform float uTime;
  uniform float uSpin;
  uniform float uActive;
  uniform float uPrev;
  uniform float uSwitch;
  uniform float uReveal;
  uniform vec2 uCellSize;
  uniform float uSize;
  uniform vec3 uFormCenter;
  uniform vec3 uFormRight;
  uniform float uFormSpacing;
  uniform float uFormSize;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float seed = aOrbit.w;
    float isActive = 1.0 - step(0.5, abs(aSlot.x - uActive));
    float wasActive = 1.0 - step(0.5, abs(aSlot.x - uPrev));
    float order = aSlot.y / max(aSlot.z, 1.0);
    float s = smoothstep(0.0, 1.0, clamp(uSwitch * 1.6 - order * 0.6, 0.0, 1.0));
    float form = isActive * s + wasActive * (1.0 - isActive) * (1.0 - s);
    float reveal = smoothstep(0.0, 1.0, clamp(uReveal * 1.7 - seed * 0.7, 0.0, 1.0));

    float angle = aOrbit.x + uSpin;
    vec3 orbit = vec3(cos(angle) * aOrbit.y, aOrbit.z + sin(uTime * 0.9 + seed * 6.283) * 0.07, sin(angle) * aOrbit.y);
    float k = aSlot.y - (aSlot.z - 1.0) * 0.5;
    vec3 slot = uFormCenter + uFormRight * (k * uFormSpacing);
    slot.y += sin(uTime * 1.3 + seed * 6.283) * uFormSpacing * 0.06 - k * k * uFormSpacing * 0.025;
    vec3 center = mix(orbit, slot, form);

    float scale = mix(uSize, uFormSize, form) * reveal;
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 world = (modelMatrix * vec4(center, 1.0)).xyz + (right * position.x + up * position.y) * scale;
    vUv = aCell + uv * uCellSize;
    vAlpha = mix(0.4, 1.0, form) * reveal;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vec4 c = texture2D(uAtlas, vUv);
    float a = c.a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(c.rgb, a);
    #include <colorspace_fragment>
  }
`;

const CELL = 128;
const COLS = 8;

export async function createSkillsRing(maxAnisotropy: number) {
  const skills = skillCategories.flatMap((cat, ci) =>
    cat.skills.map((skill, si) => ({ skill, ci, si, size: cat.skills.length, accent: cat.accent })),
  );
  const rows = Math.ceil(skills.length / COLS);
  const maxSlots = Math.max(...skillCategories.map((c) => c.skills.length));
  const { canvas, ctx } = createCanvas(COLS * CELL, rows * CELL);

  const images = await Promise.all(
    skills.map(({ skill }) => {
      const icon = icons[skill.icon];
      return loadImage(svgDataUrl(icon.body, icon.width, icon.height, skill.color ?? "#ffffff")).catch(() => null);
    }),
  );

  skills.forEach(({ accent }, i) => {
    const x = (i % COLS) * CELL;
    const y = Math.floor(i / COLS) * CELL;
    const pad = 10;
    const s = CELL - pad * 2;
    const g = ctx.createLinearGradient(0, y + pad, 0, y + pad + s);
    g.addColorStop(0, "#1f3157");
    g.addColorStop(1, "#0b1427");
    roundRect(ctx, x + pad, y + pad, s, s, 28);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;
    const hl = ctx.createLinearGradient(0, y + pad, 0, y + pad + s * 0.5);
    hl.addColorStop(0, "rgba(255,255,255,0.18)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    roundRect(ctx, x + pad + 3, y + pad + 3, s - 6, s * 0.5, 24);
    ctx.fillStyle = hl;
    ctx.fill();
    const img = images[i];
    if (img) {
      const is = 62;
      ctx.drawImage(img, x + (CELL - is) / 2, y + (CELL - is) / 2, is, is);
    }
  });

  const atlas = new CanvasTexture(canvas);
  atlas.colorSpace = SRGBColorSpace;
  atlas.minFilter = LinearMipmapLinearFilter;
  atlas.anisotropy = Math.min(4, maxAnisotropy);
  atlas.flipY = false;

  const base = new PlaneGeometry(1, 1);
  const geo = new InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  // the atlas is not flipped, so map plane uv.y = 1 (top) to the cell's top row
  const uv = base.getAttribute("uv").clone();
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  geo.setAttribute("uv", uv);
  geo.instanceCount = skills.length;

  const rand = mulberry32(31);
  const orbit = new Float32Array(skills.length * 4);
  const cells = new Float32Array(skills.length * 2);
  const slots = new Float32Array(skills.length * 3);
  skills.forEach(({ ci, si, size }, i) => {
    orbit[i * 4] = (i / skills.length) * Math.PI * 2;
    // a ring under the ceiling, inside the walls and above the furniture
    orbit[i * 4 + 1] = 1.55 + (i % 2) * 0.3;
    orbit[i * 4 + 2] = 2.25 + Math.sin(i * 1.7) * 0.28;
    orbit[i * 4 + 3] = rand();
    cells[i * 2] = ((i % COLS) * CELL) / canvas.width;
    cells[i * 2 + 1] = (Math.floor(i / COLS) * CELL) / canvas.height;
    slots[i * 3] = ci;
    slots[i * 3 + 1] = si;
    slots[i * 3 + 2] = size;
  });
  geo.setAttribute("aOrbit", new InstancedBufferAttribute(orbit, 4));
  geo.setAttribute("aCell", new InstancedBufferAttribute(cells, 2));
  geo.setAttribute("aSlot", new InstancedBufferAttribute(slots, 3));

  const uniforms = {
    uAtlas: { value: atlas },
    uTime: { value: 0 },
    uSpin: { value: 0 },
    uActive: { value: 0 },
    uPrev: { value: 0 },
    uSwitch: { value: 1 },
    uReveal: { value: 0 },
    uCellSize: { value: [CELL / canvas.width, CELL / canvas.height] },
    uSize: { value: 0.24 },
    uFormCenter: { value: new Vector3() },
    uFormRight: { value: new Vector3(1, 0, 0) },
    uFormSpacing: { value: 0.6 },
    uFormSize: { value: 0.55 },
  };
  const material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, uniforms });

  const ring = new Mesh(geo, material);
  ring.frustumCulled = false;
  ring.renderOrder = 3;
  ring.name = "skills-ring";

  let reveal = 0;
  let spin = 0;
  let active = 0;
  const toCam = new Vector3();
  const right = new Vector3();
  const worldUp = new Vector3(0, 1, 0);

  return {
    mesh: ring,
    /**
     * `target` is 0..1 depending on how close the visitor is to the skills section.
     * The formation is placed between the camera and what it looks at.
     */
    update(
      dt: number,
      time: number,
      target: number,
      categoryKey: string,
      speed: number,
      camPos: Vector3,
      camTarget: Vector3,
      view: { fov: number; aspect: number },
    ) {
      reveal += (target - reveal) * (1 - Math.exp(-4 * dt));
      spin += dt * 0.1 * speed;
      const next = Math.max(0, skillCategories.findIndex((c) => c.key === categoryKey));
      if (next !== active) {
        uniforms.uPrev.value = active;
        active = next;
        uniforms.uSwitch.value = 0;
      }
      uniforms.uSwitch.value = clamp(uniforms.uSwitch.value + dt * 1.6);
      uniforms.uActive.value = active;
      uniforms.uTime.value = time;
      uniforms.uSpin.value = spin;
      uniforms.uReveal.value = reveal;

      toCam.subVectors(camPos, camTarget);
      const dist = toCam.length();
      toCam.normalize();
      right.crossVectors(worldUp, toCam).normalize();
      // Fit the longest category into ~42% of the viewport width (90% on portrait screens).
      const tall = view.aspect < 0.85;
      const visible = 2 * 0.62 * Math.tan((view.fov * Math.PI) / 360) * view.aspect;
      const spacing = dist * Math.min(0.04, ((tall ? 0.9 : 0.42) * visible) / maxSlots);
      uniforms.uFormCenter.value
        .copy(camTarget)
        .addScaledVector(toCam, dist * 0.38)
        .addScaledVector(worldUp, dist * (tall ? 0.04 : 0.11));
      uniforms.uFormRight.value.copy(right);
      uniforms.uFormSpacing.value = spacing;
      uniforms.uFormSize.value = spacing * 0.86;
      ring.visible = reveal > 0.005;
    },
    dispose() {
      atlas.dispose();
      geo.dispose();
      base.dispose();
      material.dispose();
    },
  };
}

export type SkillsRing = Awaited<ReturnType<typeof createSkillsRing>>;
