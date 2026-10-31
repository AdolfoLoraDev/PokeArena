import * as THREE from 'three';
import { scene } from './scene';

// Big explorable forest-ruins zone. Seeded so every run has a fresh layout.
export const HALF = 95; // world is 190 x 190 (arena was r=21)
export interface Camp { pos: THREE.Vector3; tier: number; cleared: boolean; found: boolean; active: boolean; }
export interface Col { x: number; z: number; r: number; }
export const world = { group: new THREE.Group(), camps: [] as Camp[], shrine: new THREE.Vector3(), start: new THREE.Vector3(0, 0, 82), cols: [] as Col[], beam: null as THREE.Mesh | null, seal: null as THREE.Mesh | null };
scene.add(world.group); world.group.visible = false;

let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const CELL = 8, grid = new Map<number, Col[]>();
const key = (cx: number, cz: number) => (cx + 64) * 256 + (cz + 64);
function addCol(c: Col) { world.cols.push(c); const x0 = Math.floor((c.x - c.r) / CELL), x1 = Math.floor((c.x + c.r) / CELL), z0 = Math.floor((c.z - c.r) / CELL), z1 = Math.floor((c.z + c.r) / CELL);
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = key(x, z); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(c); } }
/** push a point out of obstacles + clamp to world. returns true if it collided */
export function collide(p: THREE.Vector3, r: number) {
  let hit = false; const a = grid.get(key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)));
  if (a) for (const c of a) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m) { hit = true; if (d < 1e-4) { p.x += m; } else { p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; } } }
  const L = HALF - 2; if (p.x < -L) p.x = -L; if (p.x > L) p.x = L; if (p.z < -L) p.z = -L; if (p.z > L) p.z = L;
  return hit;
}
export function blocked(p: THREE.Vector3) { const a = grid.get(key(Math.floor(p.x / CELL), Math.floor(p.z / CELL))); if (a) for (const c of a) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r) return true; return Math.abs(p.x) > HALF || Math.abs(p.z) > HALF; }

function segDist(px: number, pz: number, a: THREE.Vector3, b: THREE.Vector3) { const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz; let t = ((px - a.x) * dx + (pz - a.z) * dz) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (a.x + t * dx), pz - (a.z + t * dz)); }

const disposables: THREE.Object3D[] = [];
export function buildWorld(low: boolean) {
  for (const o of disposables) { world.group.remove(o); o.traverse((x: any) => { x.geometry?.dispose?.(); }); } disposables.length = 0;
  world.cols.length = 0; grid.clear(); world.camps = []; seed = (Date.now() % 100000) + 7;
  const add = (o: THREE.Object3D) => { world.group.add(o); disposables.push(o); };
  // --- layout: start south, camps scattered, shrine hidden in a random far corner behind ruin walls
  const corners = [[-1, -1], [1, -1], [-1, 0.1], [1, 0.1]]; const cn = corners[Math.floor(rnd() * corners.length)];
  world.shrine.set(cn[0] * (HALF - 18), 0, cn[1] < 0 ? -(HALF - 18) : -5 + rnd() * 10);
  const campSpots: THREE.Vector3[] = [];
  while (campSpots.length < 6) { const p = new THREE.Vector3((rnd() * 2 - 1) * (HALF - 15), 0, (rnd() * 2 - 1) * (HALF - 15));
    if (p.distanceTo(world.start) < 30 || p.distanceTo(world.shrine) < 30 || campSpots.some((c) => c.distanceTo(p) < 34)) continue; campSpots.push(p); }
  campSpots.sort((a, b) => a.distanceTo(world.start) - b.distanceTo(world.start));
  world.camps = campSpots.map((pos, i) => ({ pos, tier: Math.min(2, Math.floor(i / 2)), cleared: false, found: false, active: false }));
  // paths: start -> nearest camps chain (greedy); shrine is reached through a side trail, not the main road
  const pts = [world.start.clone(), ...campSpots]; const segs: [THREE.Vector3, THREE.Vector3][] = [];
  for (let i = 0; i < pts.length - 1; i++) segs.push([pts[i], pts[i + 1]]);
  const nearToShrine = campSpots.reduce((a, b) => (a.distanceTo(world.shrine) < b.distanceTo(world.shrine) ? a : b));
  const mid = nearToShrine.clone().lerp(world.shrine, 0.5).add(new THREE.Vector3((rnd() - 0.5) * 20, 0, (rnd() - 0.5) * 20));
  const trail: [THREE.Vector3, THREE.Vector3][] = [[nearToShrine, mid], [mid, world.shrine]];
  // --- ground texture with paths
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d')!;
  g.fillStyle = '#1d3a24'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `hsla(${110 + rnd() * 40},${35 + rnd() * 25}%,${12 + rnd() * 16}%,.5)`; const r = 2 + rnd() * 10; g.beginPath(); g.arc(rnd() * S, rnd() * S, r, 0, 7); g.fill(); }
  const toT = (v: THREE.Vector3) => [((v.x + HALF) / (HALF * 2)) * S, ((v.z + HALF) / (HALF * 2)) * S];
  g.lineCap = 'round'; g.lineJoin = 'round';
  const drawSegs = (ss: typeof segs, w: number, col: string) => { g.strokeStyle = col; g.lineWidth = w; for (const [a, b] of ss) { g.beginPath(); const [x0, y0] = toT(a), [x1, y1] = toT(b); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + (rnd() - .5) * 40, (y0 + y1) / 2 + (rnd() - .5) * 40, x1, y1); g.stroke(); } };
  drawSegs(segs, 26, '#4a3c26'); drawSegs(segs, 16, '#6b583a'); drawSegs(trail, 9, '#3d3324');
  for (const p of campSpots) { const [x, y] = toT(p); g.fillStyle = '#5a4a30'; g.beginPath(); g.arc(x, y, 44, 0, 7); g.fill(); }
  { const [x, y] = toT(world.shrine); g.fillStyle = '#3b3550'; g.beginPath(); g.arc(x, y, 60, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 60, HALF * 2 + 60), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  tex.repeat.set(1, 1); ground.geometry.scale((HALF * 2) / (HALF * 2 + 60), (HALF * 2) / (HALF * 2 + 60), 1);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: 0x0b1a10 })); outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; add(outer);
  // --- obstacles
  const clear = (x: number, z: number, pad: number) => { const p = new THREE.Vector3(x, 0, z); if (p.distanceTo(world.start) < 9 + pad) return false; if (campSpots.some((cp) => cp.distanceTo(p) < 11 + pad)) return false; if (p.distanceTo(world.shrine) < 16 + pad) return false;
    for (const [a, b] of segs) if (segDist(x, z, a, b) < 4.5 + pad) return false; for (const [a, b] of trail) if (segDist(x, z, a, b) < 2.6 + pad) return false; return true; };
  const trees: Col[] = [], rocks: Col[] = [];
  const nTree = low ? 520 : 820;
  for (let i = 0, tries = 0; i < nTree && tries < 20000; tries++) { const x = (rnd() * 2 - 1) * HALF, z = (rnd() * 2 - 1) * HALF; if (!clear(x, z, 0)) continue; const r = 0.7 + rnd() * 0.6; trees.push({ x, z, r }); i++; }
  for (let i = 0, tries = 0; i < 90 && tries < 5000; tries++) { const x = (rnd() * 2 - 1) * HALF, z = (rnd() * 2 - 1) * HALF; if (!clear(x, z, 0.5)) continue; rocks.push({ x, z, r: 1 + rnd() * 1.8 }); i++; }
  // border wall of trees
  for (let a = -HALF; a <= HALF; a += 3.2) for (const [x, z] of [[a, -HALF], [a, HALF], [-HALF, a], [HALF, a]]) trees.push({ x: x + (rnd() - .5), z: z + (rnd() - .5), r: 1.2 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), col = new THREE.Color();
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 6).translate(0, 0.6, 0), new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 1 }), trees.length);
  const leafG = new THREE.ConeGeometry(1.5, 2.4, 7).translate(0, 2.1, 0);
  const leaf = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), trees.length);
  const leaf2 = new THREE.InstancedMesh(new THREE.ConeGeometry(1.0, 1.7, 7).translate(0, 3.3, 0), leaf.material, trees.length);
  trees.forEach((t, i) => { const s = t.r * 0.95; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6); m4.compose(ps.set(t.x, 0, t.z), q, sc.set(s, s * (0.9 + rnd() * 0.4), s)); trunk.setMatrixAt(i, m4); leaf.setMatrixAt(i, m4); leaf2.setMatrixAt(i, m4);
    col.setHSL(0.27 + rnd() * 0.12, 0.45 + rnd() * 0.2, 0.18 + rnd() * 0.12); leaf.setColorAt(i, col); leaf2.setColorAt(i, col.offsetHSL(0, 0, 0.05)); addCol({ x: t.x, z: t.z, r: t.r * 0.55 }); });
  for (const im of [trunk, leaf, leaf2]) { im.castShadow = !low; im.receiveShadow = false; add(im); }
  const rockM = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x77808a, roughness: 0.9, flatShading: true }), rocks.length);
  rocks.forEach((r, i) => { q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())); m4.compose(ps.set(r.x, r.r * 0.35, r.z), q, sc.set(r.r, r.r * 0.75, r.r)); rockM.setMatrixAt(i, m4); addCol(r); });
  rockM.castShadow = !low; add(rockM);
  // --- ruins: broken pillars around each camp
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a86a0, roughness: 0.8, flatShading: true });
  const pil: { x: number; z: number; h: number }[] = [];
  for (const cp of campSpots) for (let k = 0; k < 5; k++) { const a = rnd() * 6.28, d = 8 + rnd() * 2; pil.push({ x: cp.x + Math.cos(a) * d, z: cp.z + Math.sin(a) * d, h: 1 + rnd() * 3 }); }
  // shrine: ring of walls with ONE gap facing the hidden trail
  const gapA = Math.atan2(mid.z - world.shrine.z, mid.x - world.shrine.x);
  for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2; let da = Math.abs(((a - gapA + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (da < 0.45) continue; pil.push({ x: world.shrine.x + Math.cos(a) * 13, z: world.shrine.z + Math.sin(a) * 13, h: 3 + rnd() * 2.5 }); }
  const pilM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 1, 1.6).translate(0, 0.5, 0), stone, pil.length);
  pil.forEach((p, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd()); m4.compose(ps.set(p.x, 0, p.z), q, sc.set(1, Math.min(p.h, 3.2), 1)); pilM.setMatrixAt(i, m4); addCol({ x: p.x, z: p.z, r: 1.15 }); });
  pilM.castShadow = !low; add(pilM);
  // shrine sigil + beam (beam lights up once the seal breaks -> visible hint)
  const sig = new THREE.Mesh(new THREE.RingGeometry(5, 5.6, 6), new THREE.MeshBasicMaterial({ color: 0xc06bff, transparent: true, opacity: 0.8, toneMapped: false })); sig.rotation.x = -Math.PI / 2; sig.position.set(world.shrine.x, 0.03, world.shrine.z); add(sig); world.seal = sig;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xc06bff, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.set(world.shrine.x, 30, world.shrine.z); add(beam); world.beam = beam;
  // camp markers (campfire glow)
  for (const cp of campSpots) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a, toneMapped: false })); f.position.set(cp.x, 0.5, cp.z); add(f); }
  // fireflies (high only)
  if (!low) { const n = 400, gpos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { gpos[i * 3] = (rnd() * 2 - 1) * HALF; gpos[i * 3 + 1] = 0.5 + rnd() * 4; gpos[i * 3 + 2] = (rnd() * 2 - 1) * HALF; }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(gpos, 3)); add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xd8ff7a, size: 0.18, toneMapped: false }))); }
}
export function setBeam(on: number, t: number) { if (world.beam) (world.beam.material as THREE.MeshBasicMaterial).opacity = on * (0.22 + Math.sin(t * 3) * 0.06); if (world.seal) world.seal.rotation.z = t * 0.3; }

// ---------- minimap with fog of war ----------
const MM = 128; const fog = document.createElement('canvas'); fog.width = fog.height = MM; const fg = fog.getContext('2d')!;
export function resetFog() { fg.globalCompositeOperation = 'source-over'; fg.fillStyle = '#000'; fg.fillRect(0, 0, MM, MM); }
const toM = (x: number) => ((x + HALF) / (HALF * 2)) * MM;
export function reveal(p: THREE.Vector3, r = 16) { fg.globalCompositeOperation = 'destination-out'; const gr = fg.createRadialGradient(toM(p.x), toM(p.z), 0, toM(p.x), toM(p.z), (r / (HALF * 2)) * MM); gr.addColorStop(0, '#000'); gr.addColorStop(0.7, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)'); fg.fillStyle = gr; fg.beginPath(); fg.arc(toM(p.x), toM(p.z), (r / (HALF * 2)) * MM, 0, 7); fg.fill(); }
export function isRevealed(p: THREE.Vector3) { const d = fg.getImageData(Math.floor(toM(p.x)), Math.floor(toM(p.z)), 1, 1).data; return d[3] < 128; }
export function drawMinimap(cv: HTMLCanvasElement, player: THREE.Vector3, face: THREE.Vector3, shrineOpen: boolean, enemies: THREE.Vector3[]) {
  const g = cv.getContext('2d')!; g.clearRect(0, 0, MM, MM); g.fillStyle = '#1d3a24'; g.fillRect(0, 0, MM, MM);
  for (const cp of world.camps) if (cp.found) { g.fillStyle = cp.cleared ? '#6fe38a' : '#ff8a2a'; g.beginPath(); g.arc(toM(cp.pos.x), toM(cp.pos.z), 3.5, 0, 7); g.fill(); }
  g.fillStyle = '#ff3f5a'; for (const e of enemies) if (e.distanceTo(player) < 22) g.fillRect(toM(e.x) - 1, toM(e.z) - 1, 2, 2);
  g.drawImage(fog, 0, 0);
  if (shrineOpen) { g.fillStyle = '#c06bff'; g.beginPath(); g.arc(toM(world.shrine.x), toM(world.shrine.z), 4.5, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); }
  const px = toM(player.x), pz = toM(player.z), a = Math.atan2(face.z, face.x);
  g.save(); g.translate(px, pz); g.rotate(a); g.fillStyle = '#4fe3ff'; g.beginPath(); g.moveTo(5, 0); g.lineTo(-3, 3); g.lineTo(-3, -3); g.closePath(); g.fill(); g.restore();
}
