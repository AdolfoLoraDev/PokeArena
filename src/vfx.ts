// Per-type skill VFX: sized glow/smoke particles, shockwave rings, lightning bolts, light flashes, screen flash.
import * as THREE from 'three';
import { scene, renderer } from './scene';
import { heightAt } from './world';
import { G } from './state';
import { flash } from './ui';

interface Sys { pts: THREE.Points; n: number; next: number; pos: Float32Array; col: Float32Array; size: Float32Array; alpha: Float32Array; vel: Float32Array; life: Float32Array; max: Float32Array; s0: Float32Array; grow: Float32Array; grav: Float32Array; base: Float32Array; }
const U = { uScale: { value: 600 } };
function makeSys(n: number, additive: boolean): Sys {
  const pos = new Float32Array(n * 3).fill(-999), col = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const m = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false,
    vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale; void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord - .5; float r = length(d); if (r > .5) discard; float f = ${additive ? 'pow(1. - r * 2., 1.6)' : 'smoothstep(.5, .15, r)'}; gl_FragColor = vec4(vC, vA * f); }` });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 5; scene.add(pts);
  return { pts, n, next: 0, pos, col, size, alpha, vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n), s0: new Float32Array(n), grow: new Float32Array(n), grav: new Float32Array(n), base: new Float32Array(n * 3) };
}
const glow = makeSys(1400, true), smoke = makeSys(500, false);
const tc = new THREE.Color();
interface Emit { n: number; c: number[]; spd: number; up: number; life: number; size: number; grow?: number; grav?: number; spread?: number; y?: number; cone?: THREE.Vector3; }
function emit(s: Sys, p: THREE.Vector3, e: Emit) {
  for (let k = 0; k < e.n; k++) { const i = s.next; s.next = (s.next + 1) % s.n; const a = Math.random() * Math.PI * 2, sp = e.spd * (0.35 + Math.random() * 0.8), r = (e.spread ?? 0.2) * Math.random();
    s.pos[i * 3] = p.x + Math.cos(a) * r; s.pos[i * 3 + 1] = p.y + (e.y ?? 0) + Math.random() * 0.3; s.pos[i * 3 + 2] = p.z + Math.sin(a) * r;
    let vx = Math.cos(a) * sp, vz = Math.sin(a) * sp; if (e.cone) { vx = vx * 0.35 + e.cone.x * e.spd; vz = vz * 0.35 + e.cone.z * e.spd; }
    s.vel[i * 3] = vx; s.vel[i * 3 + 1] = e.up * (0.4 + Math.random()); s.vel[i * 3 + 2] = vz;
    s.life[i] = s.max[i] = e.life * (0.6 + Math.random() * 0.7); s.s0[i] = e.size * (0.6 + Math.random() * 0.8); s.grow[i] = e.grow ?? 0; s.grav[i] = e.grav ?? 3;
    tc.setHex(e.c[Math.floor(Math.random() * e.c.length)]); s.base.set([tc.r, tc.g, tc.b], i * 3); }
}
function step(s: Sys, dt: number, additive: boolean) {
  for (let i = 0; i < s.n; i++) { if (s.life[i] <= 0) { if (s.alpha[i]) { s.alpha[i] = 0; s.pos[i * 3 + 1] = -999; } continue; }
    s.life[i] -= dt; const f = Math.max(0, s.life[i] / s.max[i]);
    s.vel[i * 3 + 1] -= s.grav[i] * dt; s.vel[i * 3] *= 0.95; s.vel[i * 3 + 2] *= 0.95;
    s.pos[i * 3] += s.vel[i * 3] * dt; s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt; s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
    s.size[i] = s.s0[i] * (1 + s.grow[i] * (1 - f)); s.alpha[i] = additive ? f * 1.3 : Math.min(1, f * 1.6) * 0.75;
    const k = additive ? 1.6 : 1; s.col[i * 3] = s.base[i * 3] * k; s.col[i * 3 + 1] = s.base[i * 3 + 1] * k; s.col[i * 3 + 2] = s.base[i * 3 + 2] * k; }
  const g = s.pts.geometry; for (const a of ['position', 'color', 'size', 'alpha']) (g.attributes[a] as THREE.BufferAttribute).needsUpdate = true;
}
// ---- shockwave rings, bolts, light ----
interface Ring { m: THREE.Mesh; t: number; d: number; r0: number; r1: number; }
const rings: Ring[] = [], ringGeo = new THREE.RingGeometry(0.82, 1, 64), discGeo = new THREE.CircleGeometry(1, 48);
function ring(p: THREE.Vector3, r0: number, r1: number, color: number, d = 0.4, disc = false, y = 0.08) {
  const m = new THREE.Mesh(disc ? discGeo : ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(p.x, heightAt(p.x, p.z) + y, p.z); m.scale.setScalar(r0); scene.add(m); rings.push({ m, t: d, d, r0, r1 });
}
const bolts: { l: THREE.Line; t: number }[] = [];
function bolt(p: THREE.Vector3, color: number, h = 9) {
  const pts: THREE.Vector3[] = []; const gy = heightAt(p.x, p.z); let x = p.x + (Math.random() - 0.5) * 2, z = p.z + (Math.random() - 0.5) * 2;
  for (let k = 0; k <= 9; k++) { const y = gy + h * (1 - k / 9); pts.push(new THREE.Vector3(x, y, z)); x += (Math.random() - 0.5) * 1.1; z += (Math.random() - 0.5) * 1.1; if (k === 8) { x = p.x; z = p.z; } }
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, toneMapped: false, blending: THREE.AdditiveBlending, linewidth: 2 }));
  scene.add(l); bolts.push({ l, t: 0.18 });
}
const light = new THREE.PointLight(0xffffff, 0, 14, 1.6); scene.add(light); let lightT = 0;
function lightFlash(p: THREE.Vector3, color: number, k = 1) { light.color.setHex(color); light.position.set(p.x, heightAt(p.x, p.z) + 1.6, p.z); light.intensity = 40 * k; lightT = 0.25; }
// ---- type looks ----
type Look = { c: number[]; dark?: number[]; grav: number; up: number; bolt?: boolean; debris?: boolean; ring: number };
const T: Record<string, Look> = {
  normal: { c: [0xffffff, 0xf0e8d0], grav: 4, up: 2, ring: 0xffffff }, fire: { c: [0xffe070, 0xff8a1a, 0xff3a00], dark: [0x9a8070, 0x7a6a60], grav: -2.5, up: 2.5, ring: 0xff6a1a },
  water: { c: [0xbfeeff, 0x3fa8ff, 0xffffff], grav: 9, up: 5, ring: 0x6fd0ff }, grass: { c: [0x8aff6a, 0x3ad04a, 0xd8ff8a], grav: 1, up: 2, ring: 0x6aff7a },
  electric: { c: [0xffffa0, 0xffe03a, 0xffffff], grav: 0, up: 1, bolt: true, ring: 0xfff07a }, ice: { c: [0xe8ffff, 0x8fe8ff, 0xffffff], dark: [0xd8f4ff], grav: 5, up: 3, ring: 0xaff4ff },
  fighting: { c: [0xffd0a0, 0xff7a4a, 0xffffff], dark: [0x6a5a48], grav: 8, up: 4, debris: true, ring: 0xffa070 }, poison: { c: [0xd07aff, 0xa040d0], dark: [0x6a2a8a, 0x8a4aa0], grav: -1.5, up: 1.5, ring: 0xc060ff },
  ground: { c: [0xffd890, 0xd8a050], dark: [0x8a6a40, 0x6a5030], grav: 10, up: 6, debris: true, ring: 0xe0b060 }, flying: { c: [0xffffff, 0xc8d8ff], dark: [0xe8f0ff], grav: -1, up: 1, ring: 0xd0e0ff },
  psychic: { c: [0xff8ad8, 0xff4aa8, 0xffd0f0], grav: -1, up: 1, ring: 0xff6ac8 }, bug: { c: [0xd8ff4a, 0x9ac030], grav: 3, up: 2, ring: 0xc8f04a },
  rock: { c: [0xe8d8a0], dark: [0x8a7a5a, 0x6a6050, 0xa89870], grav: 12, up: 6, debris: true, ring: 0xd8c080 }, ghost: { c: [0xb08aff, 0x7a4aff], dark: [0x2a1a40, 0x3a2a5a], grav: -1.5, up: 1, ring: 0x9a6aff },
  dragon: { c: [0x8a7aff, 0x4a3aff, 0xff6ad8], dark: [0x2a2050], grav: -1, up: 2, ring: 0x7a6aff }, dark: { c: [0xff4a6a, 0xa02040], dark: [0x100810, 0x2a1a2a], grav: -1, up: 1, ring: 0xc03050 },
  steel: { c: [0xffffff, 0xd0d8e8, 0xa8b8d0], grav: 9, up: 4, ring: 0xd8e0f0 }, fairy: { c: [0xffb0e8, 0xffe0f8, 0xffffff], grav: -0.5, up: 1, ring: 0xffa0e0 },
};
const look = (t?: string) => T[t || 'normal'] || T.normal;
const at = (p: THREE.Vector3, y = 0.9) => new THREE.Vector3(p.x, heightAt(p.x, p.z) + y, p.z);
/** impact on a target: scaled by power (1 = normal hit, 2+ = crit/ult) */
export function hitFx(p: THREE.Vector3, type?: string, power = 1) {
  const L = look(type), q = at(p); const n = Math.round(10 * power);
  emit(glow, q, { n, c: L.c, spd: 5 * power, up: L.up, life: 0.45, size: 0.5, grav: L.grav });
  emit(glow, q, { n: 1, c: [0xffffff], spd: 0, up: 0, life: 0.12, size: 2.2 * power, grav: 0 });
  if (L.dark) emit(smoke, q, { n: Math.round(3 * power), c: L.dark, spd: 1.2, up: 1, life: 0.8, size: 0.9, grow: 1.5, grav: -0.5 });
  if (L.debris && power > 1.2) emit(smoke, q, { n: 8, c: L.dark || [0x6a5a48], spd: 5, up: 6, life: 0.7, size: 0.25, grav: 16 });
  if (L.bolt && (power > 1.2 || Math.random() < 0.35)) bolt(p, 0xfff6a0, 6);
  if (power > 1.3) { ring(p, 0.3, 2.6 * power, L.ring, 0.3); lightFlash(p, L.ring, power * 0.6); }
}
/** big ground-cast moves (AoE, ultimates, dash landings) */
export function castFx(p: THREE.Vector3, type: string | undefined, radius: number, ult = false) {
  const L = look(type), q = at(p, 0.3), k = ult ? 1.6 : 1;
  ring(p, 0.4, radius * 1.15, L.ring, 0.45); ring(p, 0.2, radius * 0.8, 0xffffff, 0.3); ring(p, 0.5, radius, L.ring, 0.25, true, 0.05);
  emit(glow, q, { n: Math.round(60 * k), c: L.c, spd: radius * 2.6, up: L.up * 1.3, life: 0.7, size: 0.6, grav: L.grav, spread: 0.6 });
  emit(smoke, q, { n: Math.round(16 * k), c: L.dark || [0xcfc8b8, 0xa89f90], spd: radius * 1.4, up: 1, life: 1.1, size: 1.4, grow: 1.8, grav: -0.4, spread: radius * 0.4 });
  if (L.debris) emit(smoke, q, { n: 24, c: L.dark || [0x6a5a48], spd: radius * 1.8, up: 7, life: 0.9, size: 0.3, grav: 18 });
  if (L.bolt) for (let i = 0; i < (ult ? 6 : 3); i++) { const a = Math.random() * 6.28, r = Math.random() * radius; bolt(new THREE.Vector3(p.x + Math.cos(a) * r, 0, p.z + Math.sin(a) * r), 0xfff6a0); }
  if (type === 'fire' || type === 'dragon') emit(glow, q, { n: 30, c: L.c, spd: 1.5, up: 5, life: 0.9, size: 0.8, grav: -3, spread: radius * 0.6 });
  if (type === 'ice') emit(glow, q, { n: 24, c: [0xffffff, 0xbff4ff], spd: radius * 1.2, up: 6, life: 0.8, size: 0.35, grav: 10 });
  lightFlash(p, L.ring, k * 1.4); G.shake = Math.max(G.shake, ult ? 0.6 : 0.3); if (ult) flash(`#${L.ring.toString(16).padStart(6, '0')}`, 0.28);
}
export function projTrail(p: THREE.Vector3, type?: string, big = false) {
  const L = look(type); emit(glow, p, { n: big ? 3 : 1, c: L.c, spd: 0.6, up: 0.4, life: 0.35, size: big ? 0.9 : 0.5, grav: L.grav * 0.3, spread: 0.15 });
  if (L.dark && Math.random() < 0.3) emit(smoke, p, { n: 1, c: L.dark, spd: 0.3, up: 0.4, life: 0.6, size: 0.6, grow: 1.5, grav: -0.3 });
}
export function levelFx(p: THREE.Vector3) {
  ring(p, 0.3, 4, 0xffd76a, 0.7); ring(p, 0.3, 2.6, 0xffffff, 0.5);
  emit(glow, at(p, 0.1), { n: 70, c: [0xffe890, 0xffd040, 0xffffff], spd: 1.6, up: 6, life: 1.2, size: 0.45, grav: -1, spread: 1.2 }); lightFlash(p, 0xffd76a, 1.5);
}
export function updateVfx(dt: number) {
  U.uScale.value = renderer.domElement.height * 0.6;
  step(glow, dt, true); step(smoke, dt, false);
  for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t -= dt; const f = 1 - r.t / r.d, e = 1 - (1 - f) ** 3;
    r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e); (r.m.material as THREE.MeshBasicMaterial).opacity = (1 - f) * 0.9;
    if (r.t <= 0) { scene.remove(r.m); (r.m.material as THREE.Material).dispose(); rings.splice(i, 1); } }
  for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.t -= dt; (b.l.material as THREE.LineBasicMaterial).opacity = Math.random() < 0.3 ? 0.2 : b.t / 0.18;
    if (b.t <= 0) { scene.remove(b.l); b.l.geometry.dispose(); (b.l.material as THREE.Material).dispose(); bolts.splice(i, 1); } }
  if (lightT > 0) { lightT -= dt; light.intensity = Math.max(0, lightT / 0.25) * light.intensity; if (lightT <= 0) light.intensity = 0; }
}
