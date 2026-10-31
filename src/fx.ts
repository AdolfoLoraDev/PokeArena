import * as THREE from 'three';
import { scene, camera } from './scene';
const MAX = 900;
const pos = new Float32Array(MAX * 3), col = new Float32Array(MAX * 3);
const vel = new Float32Array(MAX * 3), life = new Float32Array(MAX), maxLife = new Float32Array(MAX), base = new Float32Array(MAX * 3);
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
function dot() { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!; const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, '#fff'); r.addColorStop(0.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); }
export const dotTex = dot();
const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.45, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
pts.frustumCulled = false; scene.add(pts);
let next = 0; const tmp = new THREE.Color();
for (let i = 0; i < MAX; i++) pos[i * 3 + 1] = -99;
export function burst(p: THREE.Vector3, color: number, n = 14, spd = 6, up = 2, lifeS = 0.5) {
  tmp.setHex(color);
  for (let k = 0; k < n; k++) {
    const i = next; next = (next + 1) % MAX;
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    const a = Math.random() * Math.PI * 2, s = spd * (0.3 + Math.random());
    vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = up * (Math.random() * 2 - 0.3); vel[i * 3 + 2] = Math.sin(a) * s;
    life[i] = maxLife[i] = lifeS * (0.6 + Math.random() * 0.6); base[i * 3] = tmp.r * 1.05; base[i * 3 + 1] = tmp.g * 1.05; base[i * 3 + 2] = tmp.b * 1.05;
  }
}
export function trail(p: THREE.Vector3, color: number) { burst(p, color, 1, 0.6, 0.5, 0.35); }
export function updateFx(dt: number) {
  for (let i = 0; i < MAX; i++) {
    if (life[i] <= 0) continue; life[i] -= dt;
    if (life[i] <= 0) { pos[i * 3 + 1] = -99; continue; }
    const f = life[i] / maxLife[i];
    pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
    vel[i * 3] *= 0.92; vel[i * 3 + 2] *= 0.92; vel[i * 3 + 1] -= 4 * dt;
    col[i * 3] = base[i * 3] * f; col[i * 3 + 1] = base[i * 3 + 1] * f; col[i * 3 + 2] = base[i * 3 + 2] * f;
  }
  geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
}
// ground rings (telegraphs / shockwaves / slashes)
export function groundRing(inner: number, outer: number, color: number, opacity = 0.8, seg = 48) {
  const m = new THREE.Mesh(new THREE.RingGeometry(inner, outer, seg), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.05; scene.add(m); return m;
}
interface Fade { m: THREE.Mesh; t: number; d: number; grow: number; }
const fades: Fade[] = [];
export function slash(p: THREE.Vector3, ang: number, r: number, color: number) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.55, r, 24, 1, -0.9, 1.8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  m.rotation.x = -Math.PI / 2; m.rotation.z = ang; m.position.set(p.x, 0.8, p.z); scene.add(m); fades.push({ m, t: 0.18, d: 0.18, grow: 0.6 });
}
export function flashRing(p: THREE.Vector3, r: number, color: number, d = 0.35) { const m = groundRing(r * 0.8, r, color, 0.9); m.position.x = p.x; m.position.z = p.z; fades.push({ m, t: d, d, grow: 1.5 }); }
export function updateFades(dt: number) {
  for (let i = fades.length - 1; i >= 0; i--) { const f = fades[i]; f.t -= dt; const k = f.t / f.d;
    (f.m.material as THREE.MeshBasicMaterial).opacity = k * 0.9; f.m.scale.multiplyScalar(1 + f.grow * dt);
    if (f.t <= 0) { scene.remove(f.m); f.m.geometry.dispose(); (f.m.material as THREE.Material).dispose(); fades.splice(i, 1); } }
}
// damage numbers (DOM)
const dmgEl = document.getElementById('dmg')!; const nums: { el: HTMLElement; p: THREE.Vector3; t: number }[] = [];
const v = new THREE.Vector3();
export function dmgNum(p: THREE.Vector3, text: string, cls = '') {
  const el = document.createElement('span'); el.textContent = text; if (cls) el.className = cls; dmgEl.appendChild(el);
  nums.push({ el, p: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 2.2, 0)), t: 0.8 });
}
export function updateNums(dt: number) {
  for (let i = nums.length - 1; i >= 0; i--) { const n = nums[i]; n.t -= dt; n.p.y += dt * 1.6;
    v.copy(n.p).project(camera); n.el.style.left = ((v.x + 1) / 2) * innerWidth + 'px'; n.el.style.top = ((1 - v.y) / 2) * innerHeight + 'px'; n.el.style.opacity = String(Math.min(1, n.t * 3));
    if (n.t <= 0) { n.el.remove(); nums.splice(i, 1); } }
}
export function clearFx() { nums.forEach((n) => n.el.remove()); nums.length = 0; }
