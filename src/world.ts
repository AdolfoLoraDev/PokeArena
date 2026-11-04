import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from './scene';
import { ZONES, ARENA, SEAL, Zone } from './zones';

// ================= Kanto-style open world: 6 connected handcrafted zones =================
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export interface Way { id: string; pos: THREE.Vector3; mesh: THREE.Object3D; crystal: THREE.Mesh; }
interface Gate { x: number; z: number; r: number; open: boolean; mesh: THREE.Object3D | null; }
export const world = { group: new THREE.Group(), shrine: V(ARENA[0], 0, ARENA[1]), start: V(0, 0, 8), beam: null as THREE.Mesh | null, seal: null as THREE.Mesh | null, gates: [] as Gate[], ways: [] as Way[], built: '' };
scene.add(world.group); world.group.visible = false;
export const BX0 = -160, BX1 = 172, BZ0 = -250, BZ1 = 76; // world bounds

// ---- walkable layout: union of all zone circles + capsules ----
type Circ = [number, number, number]; type Cap = [number, number, number, number, number];
const ALLC: Circ[] = ZONES.flatMap((z) => z.circles); const ALLP: Cap[] = ZONES.flatMap((z) => z.paths);
function segD(px: number, pz: number, ax: number, az: number, bx: number, bz: number) { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = ((px - ax) * dx + (pz - az) * dz) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax + t * dx), pz - (az + t * dz)); }
function sdfOf(cs: Circ[], ps: Cap[], x: number, z: number) { let d = 1e9; for (const [cx, cz, r] of cs) d = Math.min(d, Math.hypot(x - cx, z - cz) - r); for (const [ax, az, bx, bz, w] of ps) d = Math.min(d, segD(x, z, ax, az, bx, bz) - w); return d; }
export const sdf = (x: number, z: number) => sdfOf(ALLC, ALLP, x, z);
export const zoneSdf = (zi: number, x: number, z: number) => sdfOf(ZONES[zi].circles, ZONES[zi].paths, x, z);
function pathD(x: number, z: number) { let d = 1e9; for (const [ax, az, bx, bz] of ALLP) d = Math.min(d, segD(x, z, ax, az, bx, bz)); return d; }
export function zoneAt(x: number, z: number) { let b = 0, bd = 1e9; for (let i = 0; i < ZONES.length; i++) { const d = zoneSdf(i, x, z); if (d < bd) { bd = d; b = i; } } return b; }
const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** smooth plateaus: the mountain and the volcano sit higher than the lowlands */
export function heightAt(x: number, z: number) {
  return 3.2 * (1 - ss(40, 80, Math.hypot(x + 96, z + 140))) + 2.4 * (1 - ss(36, 72, Math.hypot(x - 64, z + 158)));
}
const seaF = (x: number, z: number) => ss(46, 64, x) * ss(-58, -42, z);
const LAVA: Circ[] = [[78, -128, 6], [46, -160, 8], [100, -168, 6], [18, -186, 6], [-22, -222, 7], [22, -240, 6]];

// solid obstacles on a hash grid
interface Col { x: number; z: number; r: number; }
const CELL = 6, grid = new Map<number, Col[]>(); const key = (cx: number, cz: number) => (cx + 400) * 1000 + (cz + 400);
export function addCol(x: number, z: number, r: number) { const c = { x, z, r }; for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) for (let gz = Math.floor((z - r) / CELL); gz <= Math.floor((z + r) / CELL); gz++) { const k = key(gx, gz); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(c); } }
function hitCol(x: number, z: number, r: number) { const a = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (a) for (const c of a) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return c; return null; }
const gateHit = (x: number, z: number, r: number) => world.gates.some((g) => !g.open && Math.hypot(x - g.x, z - g.z) < g.r + r);
export function walkable(x: number, z: number, r: number) { return sdf(x, z) < -r && !gateHit(x, z, r); }
export function collide(p: THREE.Vector3, r: number, prev?: THREE.Vector3) {
  const c = hitCol(p.x, p.z, r); if (c) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1e-3; p.x = c.x + (dx / d) * (c.r + r); p.z = c.z + (dz / d) * (c.r + r); }
  if (walkable(p.x, p.z, r) || !prev) return;
  if (!walkable(prev.x, prev.z, r)) return;
  if (walkable(p.x, prev.z, r)) { p.z = prev.z; return; } if (walkable(prev.x, p.z, r)) { p.x = prev.x; return; } p.x = prev.x; p.z = prev.z;
}
export function projBlocked(p: THREE.Vector3) { return sdf(p.x, p.z) > 0.2 || !!hitCol(p.x, p.z, 0) || gateHit(p.x, p.z, 0); }

// ---- occluder fade: trees/buildings between the camera and the player dither out ----
export const fadeU = { uFadeP: { value: V() }, uFadeC: { value: V() } };
const faded = new WeakSet<THREE.Material>();
export function addFade(m: THREE.Material) {
  if (faded.has(m)) return; faded.add(m);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, fadeU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFadeW;').replace('#include <project_vertex>', `#include <project_vertex>
      vec4 fwp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      fwp = instanceMatrix * fwp;
      #endif
      vFadeW = (modelMatrix * fwp).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFadeW; uniform vec3 uFadeP; uniform vec3 uFadeC;').replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { vec3 pa = vFadeW - uFadeP; vec3 ba = uFadeC - uFadeP; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); float dd = length(pa - ba * h);
        if (h > 0.03 && vFadeW.y > uFadeP.y - 0.2) { float k = smoothstep(3.2, 1.6, dd); vec2 q = mod(floor(gl_FragCoord.xy), 4.0); float th = (q.x * 4.0 + q.y + 0.5) / 16.0; if (th < k * 0.82) discard; } }`);
  };
  m.customProgramCacheKey = () => 'fade';
  m.needsUpdate = true;
}

// ---- assets ----
const NAT = ['MapleTree_1', 'PineTree_2', 'PineTree_4', 'NormalTree_5', 'DeadTree_2', 'DeadTree_6', 'PalmTree_1', 'PalmTree_3', 'Bush_Large', 'Bush_Large_Flowers', 'Bush', 'Flower_3_Clump', 'Flower_4_Clump', 'Grass_Large', 'Rock_1', 'Rock_2', 'Rock_3', 'Rock_4', 'Rock_5'];
const models: Record<string, THREE.Mesh[]> = {};
export async function loadWorldAssets() {
  const l = new GLTFLoader();
  await Promise.all(NAT.map(async (n) => { const g = await l.loadAsync(`/assets/nature/${n}.glb`); models[n] = []; g.scene.updateMatrixWorld(true); g.scene.traverse((o: any) => { if (o.isMesh) { o.geometry.applyMatrix4(o.matrixWorld); models[n].push(o); } }); }));
  for (const n of ['PineTree_2', 'PineTree_4']) for (const mm of models[n]) for (const m of [mm.material].flat() as THREE.MeshStandardMaterial[]) if (m.map) m.color.set(0x8fc070);
  for (const n of NAT) if (!/Grass|Flower|Rock|Bush$/.test(n)) for (const mm of models[n]) for (const m of [mm.material].flat()) addFade(m as THREE.Material);
}

let seed = 9; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const disposables: THREE.Object3D[] = [];
const animated: { blades?: THREE.Object3D; water: THREE.ShaderMaterial[]; parts: { pts: THREE.Points; kind: string }[]; crystals: THREE.Object3D[] } = { water: [], parts: [], crystals: [] };
function scatter(name: string, items: { x: number; z: number; s: number; ry: number }[], shadow: boolean) {
  const srcs = models[name]; if (!srcs || !items.length) return; const T = 32; const tiles = new Map<string, typeof items>();
  for (const it of items) { const k = Math.floor(it.x / T) + ',' + Math.floor(it.z / T); let a = tiles.get(k); if (!a) tiles.set(k, (a = [])); a.push(it); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0);
  for (const a of tiles.values()) for (const src of srcs) { const im = new THREE.InstancedMesh(src.geometry, src.material, a.length);
    a.forEach((it, i) => { q.setFromAxisAngle(up, it.ry); m4.compose(V(it.x, groundY(it.x, it.z) - 0.05, it.z), q, V(it.s, it.s, it.s)); im.setMatrixAt(i, m4); });
    im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = false; add(im); }
}
const add = (o: THREE.Object3D) => { world.group.add(o); disposables.push(o); };
const std = (c: number, o: any = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o }); addFade(m); return m; };
function mesh(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, shadow = true) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; return o; }

/** terrain height including hills/sea/lava outside the walkable area */
function groundY(x: number, z: number) {
  const d = sdf(x, z), base = heightAt(x, z), n = Math.sin(x * 0.31) * Math.cos(z * 0.27) + Math.sin(x * 0.07 + z * 0.05);
  if (d <= 0) return base;
  const mt = 1 - ss(40, 80, Math.hypot(x + 96, z + 140));
  let y = base + Math.min(4.5 + mt * 6, d * (0.32 + mt * 0.25)) * (0.8 + 0.25 * n);
  const sf = seaF(x, z); if (sf > 0) y = THREE.MathUtils.lerp(y, base - Math.min(2.2, d * 0.35) - 0.1, sf);
  for (const [lx, lz, lr] of LAVA) { const ld = Math.hypot(x - lx, z - lz); if (ld < lr + 2) y = Math.min(y, base - 0.9 + Math.max(0, ld - lr + 0.3) * 0.6); }
  return y;
}
function waterMat(deep: [number, number, number], lite: [number, number, number], foamC: [number, number, number], alpha: number) {
  const wm = new THREE.ShaderMaterial({ transparent: alpha < 1, uniforms: { t: { value: 0 } }, vertexShader: 'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float t; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec2 p=vW.xz*vec2(.35,.5); float a=n(p+vec2(t*.5,t*.2)), b=n(p*1.7-vec2(t*.7,t*.3));
        vec3 c=mix(vec3(${deep.join(',')}),vec3(${lite.join(',')}),a*.6+b*.3); float foam=smoothstep(.72,.9,a*b*1.6); c=mix(c,vec3(${foamC.join(',')}),clamp(foam,0.,1.)*.75);
        gl_FragColor=vec4(c,${alpha.toFixed(2)}); }` });
  animated.water.push(wm); return wm;
}

export function buildWorld(low: boolean) {
  const sig = low ? 'low' : 'high';
  if (world.built === sig) return;
  for (const o of disposables) world.group.remove(o); disposables.length = 0; grid.clear(); world.gates = []; world.ways = []; animated.crystals = []; animated.water = []; animated.parts = []; seed = 9; world.built = sig;
  const W = BX1 - BX0, D = BZ1 - BZ0, seg = low ? 0.45 : 0.62;
  // ---- ground ----
  const geo = new THREE.PlaneGeometry(W, D, Math.round(W * seg), Math.round(D * seg)); geo.rotateX(-Math.PI / 2); geo.translate((BX0 + BX1) / 2, 0, (BZ0 + BZ1) / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute, cols = new Float32Array(pos.count * 3), col = new THREE.Color(), tmp = new THREE.Color();
  const zc = ZONES.map((z) => ({ g: new THREE.Color(z.theme.grass), g2: new THREE.Color(z.theme.grass2), h: new THREE.Color(z.theme.hill), p: new THREE.Color(z.theme.path) }));
  const sand = new THREE.Color(0xe2d29a), stone = new THREE.Color(0xa89f90), arenaC = new THREE.Color(0x8a7f9a), snow = new THREE.Color(0xf2f4f8), ash = new THREE.Color(0x2a2220), lavaRim = new THREE.Color(0x5a2a1a);
  const ws = new Array(ZONES.length).fill(0);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const d = sdf(x, z), y = groundY(x, z); pos.setY(i, y);
    let wsum = 0; for (let k = 0; k < ZONES.length; k++) { const zd = Math.max(0, zoneSdf(k, x, z) - d); ws[k] = 1 / (1 + zd * zd * 0.02); ws[k] *= ws[k]; wsum += ws[k]; }
    const nz = 0.5 + 0.5 * Math.sin(x * 0.13 + z * 0.11) * Math.cos(z * 0.05); col.setRGB(0, 0, 0);
    const pd = pathD(x, z);
    for (let k = 0; k < ZONES.length; k++) { if (ws[k] < 0.01) continue; tmp.copy(zc[k].g).lerp(zc[k].g2, nz); if (d > 0) tmp.lerp(zc[k].h, Math.min(1, d / 6)); if (pd < 2.2 && d < 0) tmp.lerp(zc[k].p, Math.min(1, (2.2 - pd) / 1.2)); col.r += tmp.r * ws[k] / wsum; col.g += tmp.g * ws[k] / wsum; col.b += tmp.b * ws[k] / wsum; }
    if (Math.hypot(x, z - 3) < 9) col.lerp(stone, Math.min(1, (9 - Math.hypot(x, z - 3)) / 1.5) * 0.8);
    if (Math.hypot(x - ARENA[0], z - ARENA[1]) < 17) col.lerp(arenaC, 0.85);
    const sf = seaF(x, z); if (sf > 0 && d > -3) col.lerp(sand, Math.min(1, sf * 1.4) * (d > 6 ? 0.6 : 1));
    if (y > 6.5) col.lerp(snow, Math.min(1, (y - 6.5) / 2));
    for (const [lx, lz, lr] of LAVA) { const ld = Math.hypot(x - lx, z - lz); if (ld < lr + 3) col.lerp(ld < lr + 1 ? lavaRim : ash, 0.7); }
    tmp.setHSL(0, 0, 0.94 + 0.06 * Math.sin(i * 12.9898)); col.multiply(tmp); cols.set([col.r, col.g, col.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); ground.receiveShadow = true; add(ground);
  // ---- sea + lava ----
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), waterMat([0.12, 0.42, 0.62], [0.36, 0.74, 0.86], [0.95, 1, 1], 0.88)); sea.rotation.x = -Math.PI / 2; sea.position.set(BX1 - 60, -0.32, 22); add(sea);
  const lavaM = waterMat([0.7, 0.12, 0.02], [1.0, 0.45, 0.05], [1, 0.9, 0.4], 1); lavaM.toneMapped = false;
  for (const [lx, lz, lr] of LAVA) { const lv = new THREE.Mesh(new THREE.CircleGeometry(lr + 0.8, 28), lavaM); lv.rotation.x = -Math.PI / 2; lv.position.set(lx, heightAt(lx, lz) - 0.35, lz); add(lv); }

  // ---- town hub ----
  const wall = std(0xeadcc2), roofs = [0xb8553d, 0x3d6fb8, 0xc18f2e, 0x5a8a4a, 0x8a4ab8], woodD = std(0x6b4527), wood = std(0x9a6a3e);
  const houses: [number, number, number][] = [[-11, 13, 0.3], [10, 14, -0.25], [0, 17.5, 0], [15, -10, -0.7], [-14, -12, 0.6]];
  houses.forEach(([x, z, ry], i) => { const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = ry;
    h.add(mesh(new THREE.BoxGeometry(4.2, 2.6, 3.6), wall, 0, 1.3, 0)); const roof = mesh(new THREE.ConeGeometry(3.4, 1.9, 4), std(roofs[i % 5]), 0, 3.55, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.85); h.add(roof);
    h.add(mesh(new THREE.BoxGeometry(0.9, 1.5, 0.1), woodD, 0, 0.75, 1.82)); for (const wx of [-1.3, 1.3]) h.add(mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), std(0xd8b070, { emissive: 0xa07030, emissiveIntensity: 0.4 }), wx, 1.5, 1.82, false));
    add(h); addCol(x, z, 2.5); });
  const fnt = new THREE.Group(); fnt.position.set(0, 0, 3); fnt.add(mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.6, 20), std(0x9a9284), 0, 0.3, 0));
  fnt.add(mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0x4fa0c0, roughness: 0.2 }), 0, 0.58, 0, false));
  fnt.add(mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.8, 10), std(0x9a9284), 0, 1.2, 0)); add(fnt); addCol(0, 3, 2.6);
  const wmill = new THREE.Group(); wmill.position.set(-25, 0, 14);
  wmill.add(mesh(new THREE.CylinderGeometry(1.6, 2.6, 8, 8), wall, 0, 4, 0)); wmill.add(mesh(new THREE.ConeGeometry(2.3, 2.6, 8), std(0xb8553d), 0, 9.3, 0));
  const blades = new THREE.Group(); blades.position.set(0, 7.2, 2.1); for (let k = 0; k < 4; k++) { const bl = mesh(new THREE.BoxGeometry(0.5, 5.2, 0.08), std(0xe9dcc0), 0, 2.6, 0); const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2; arm.add(bl); blades.add(arm); }
  wmill.add(blades); animated.blades = blades; add(wmill);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2; const x = Math.cos(a) * 18.5, z = Math.sin(a) * 18.5; if (sdf(x, z) > -1 || pathD(x, z) < 5) continue;
    const lamp = new THREE.Group(); lamp.position.set(x, 0, z); lamp.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), woodD, 0, 1.3, 0)); lamp.add(mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a }), 0, 2.7, 0, false)); add(lamp); addCol(x, z, 0.2); }

  // ---- landmarks per zone ----
  const stoneM = std(0xb7b0a2, { flatShading: true }), mossy = std(0x8d9a78, { flatShading: true }), darkStone = std(0x4a403c, { flatShading: true });
  const arch = (x: number, z: number, ry: number, broken = false, m = stoneM) => { const g = new THREE.Group(); g.position.set(x, heightAt(x, z), z); g.rotation.y = ry;
    for (const sx of [-2.2, 2.2]) { const h = broken && sx > 0 ? 2.4 : 5; g.add(mesh(new THREE.BoxGeometry(1.2, h, 1.2), sx > 0 && m === stoneM ? mossy : m, sx, h / 2, 0)); }
    if (!broken) g.add(mesh(new THREE.BoxGeometry(6, 1, 1.4), m, 0, 5.4, 0)); add(g);
    const c = Math.cos(ry), s = Math.sin(ry); addCol(x - c * 2.2, z + s * 2.2, 0.9); addCol(x + c * 2.2, z - s * 2.2, 0.9); };
  const giant = (n: string, x: number, z: number, s: number, r: number) => { if (!models[n]) return; const gt = new THREE.Group(); for (const m of models[n]) { const mm = new THREE.Mesh(m.geometry, m.material); mm.castShadow = !low; gt.add(mm); } gt.position.set(x, heightAt(x, z), z); gt.scale.setScalar(s); add(gt); addCol(x, z, r); };
  // meadow: giant maple + ruined arches
  giant('MapleTree_1', 33, -84, 3.2, 2.4); arch(0, -116, 0); arch(-10, -110, 0.6, true);
  // forest: ancient pine + glowing mushrooms
  giant('PineTree_4', -126, 4, 3, 2.2); giant('NormalTree_5', -84, -36, 2.6, 2);
  const capM = new THREE.MeshStandardMaterial({ color: 0xff6a8a, emissive: 0xff3a6a, emissiveIntensity: 0.5 }), capB = new THREE.MeshStandardMaterial({ color: 0x6ac8ff, emissive: 0x3a8aff, emissiveIntensity: 0.6 }), stemM = std(0xf0e6d0);
  for (let i = 0; i < 40; i++) { const x = -150 + rnd() * 110, z = -55 + rnd() * 95, d = sdf(x, z); if (d > 0.5 || d < -4 || zoneAt(x, z) !== 2) continue; const s = 0.4 + rnd() * 0.5; const g = new THREE.Group(); g.position.set(x, 0, z);
    g.add(mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 0.6 * s, 6), stemM, 0, 0.3 * s, 0, false)); g.add(mesh(new THREE.SphereGeometry(0.35 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), rnd() < 0.5 ? capM : capB, 0, 0.6 * s, 0, false)); add(g); }
  // coast: lighthouse + parasols
  const lh = new THREE.Group(); lh.position.set(148, 0, -30); lh.add(mesh(new THREE.CylinderGeometry(1.4, 2, 10, 12), std(0xf4f0e8), 0, 5, 0)); for (let k = 0; k < 3; k++) lh.add(mesh(new THREE.CylinderGeometry(1.5 - k * 0.1, 1.6 - k * 0.1, 1, 12), std(0xc83a3a), 0, 2 + k * 3, 0));
  lh.add(mesh(new THREE.CylinderGeometry(1, 1, 1.2, 10), new THREE.MeshBasicMaterial({ color: 0xfff0a0 }), 0, 10.6, 0, false)); lh.add(mesh(new THREE.ConeGeometry(1.4, 1.4, 10), std(0x3a3a4a), 0, 11.9, 0)); add(lh); addCol(148, -30, 2.2);
  for (const [x, z, c] of [[96, -4, 0xff5a5a], [118, 22, 0x4fa3ff], [104, 52, 0xffd84a], [86, -18, 0x5ad04a]] as const) { const p = new THREE.Group(); p.position.set(x, 0, z); p.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), std(0xeeeeee), 0, 1.2, 0)); p.add(mesh(new THREE.ConeGeometry(1.6, 0.6, 10), std(c), 0, 2.4, 0)); add(p); addCol(x, z, 0.3); }
  // mountain: cave mouth + crystals
  const cave = new THREE.Group(); const cx = -100, cz = -182; cave.position.set(cx, heightAt(cx, cz), cz);
  for (let k = 0; k < 9; k++) { const a = (k / 8) * Math.PI; const r = mesh(new THREE.DodecahedronGeometry(2.2 + (k % 3) * 0.4, 0), darkStone, Math.cos(a) * 5.5, Math.sin(a) * 5, 0); r.rotation.set(k, k * 2, 0); cave.add(r); }
  cave.add(mesh(new THREE.CircleGeometry(4.2, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x050308 }), 0, 0.1, -0.5, false)); add(cave);
  const crysM = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x4fb8ff, emissiveIntensity: 0.6, flatShading: true, roughness: 0.2 });
  for (let i = 0; i < 18; i++) { const x = -150 + rnd() * 120, z = -190 + rnd() * 100, d = sdf(x, z); if (d > 1 || d < -3 || zoneAt(x, z) !== 4) continue; const c = mesh(new THREE.OctahedronGeometry(0.5 + rnd() * 0.6, 0), crysM, x, heightAt(x, z) + 0.5, z); c.scale.y = 2; c.rotation.z = (rnd() - 0.5) * 0.6; add(c); addCol(x, z, 0.5); }
  // volcano: ruins
  arch(52, -112, 0.2, false, darkStone); arch(92, -152, -0.5, true, darkStone); arch(62, -182, 0.9, false, darkStone); arch(42, -196, -0.3, true, darkStone);
  // ---- Mewtwo arena ----
  const A = world.shrine; const ay = heightAt(A.x, A.z); const arenaFloor = mesh(new THREE.CylinderGeometry(17.5, 18, 0.3, 48), std(0x8f87a8), A.x, ay + 0.02, A.z); arenaFloor.castShadow = false; add(arenaFloor);
  const sigil = new THREE.Mesh(new THREE.RingGeometry(6, 6.6, 6), new THREE.MeshBasicMaterial({ color: 0xc06bff, transparent: true, opacity: 0.85, toneMapped: false })); sigil.rotation.x = -Math.PI / 2; sigil.position.set(A.x, ay + 0.2, A.z); add(sigil); world.seal = sigil;
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2 + Math.PI / 14; const x = A.x + Math.cos(a) * 19.5, z = A.z + Math.sin(a) * 19.5; if (Math.hypot(x - SEAL[0], z - SEAL[1]) < 9) continue;
    add(mesh(new THREE.BoxGeometry(1.6, 6 + (k % 3), 1.6), stoneM, x, ay + (6 + (k % 3)) / 2, z)); const cr = mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshBasicMaterial({ color: 0xc06bff, toneMapped: false }), x, ay + 8 + (k % 3), z, false); add(cr); animated.crystals.push(cr); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 70, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xc06bff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.set(A.x, 35, A.z); add(beam); world.beam = beam;
  const sealM = new THREE.Mesh(new THREE.PlaneGeometry(10, 4.5), new THREE.MeshBasicMaterial({ color: 0xb06bff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  sealM.position.set(SEAL[0], heightAt(SEAL[0], SEAL[1]) + 2.2, SEAL[1]); sealM.rotation.y = Math.atan2(14, 8); add(sealM); world.gates.push({ x: SEAL[0], z: SEAL[1], r: SEAL[2], open: false, mesh: sealM });

  // ---- waystones ----
  for (const z of ZONES) { const [x, zz] = z.way, y = heightAt(x, zz); const g = new THREE.Group(); g.position.set(x, y, zz);
    g.add(mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.5, 8), stoneM, 0, 0.25, 0)); g.add(mesh(new THREE.CylinderGeometry(0.35, 0.5, 2, 6), stoneM, 0, 1.3, 0));
    const cr = mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshBasicMaterial({ color: 0x5a6a7a, toneMapped: false }), 0, 3, 0, false); g.add(cr); add(g); addCol(x, zz, 0.8);
    world.ways.push({ id: z.id, pos: V(x, y, zz), mesh: g, crystal: cr }); }

  // ---- vegetation ----
  const trees: Record<string, { x: number; z: number; s: number; ry: number }[]> = {}; const put = (n: string, x: number, z: number, s: number) => (trees[n] ??= []).push({ x, z, s, ry: rnd() * 6.28 });
  const step = low ? 4.4 : 3.3;
  for (let x = BX0; x < BX1; x += step) for (let z = BZ0; z < BZ1; z += step) {
    const jx = x + (rnd() - 0.5) * step * 0.9, jz = z + (rnd() - 0.5) * step * 0.9, d = sdf(jx, jz); if (d < 1.6) continue;
    const zi = zoneAt(jx, jz), th = ZONES[zi].theme, sf = seaF(jx, jz); if (sf > 0.4 && !(d < 6 && th.trees[0].startsWith('Palm'))) continue;
    if (LAVA.some(([lx, lz, lr]) => Math.hypot(jx - lx, jz - lz) < lr + 2.5)) continue;
    if (Math.hypot(jx - ARENA[0], jz - ARENA[1]) < 22) continue;
    const r = rnd();
    if (d < 14) { if (r < (d < 5 ? 0.8 : 0.45) * th.density) put(th.trees[Math.floor(rnd() * th.trees.length)], jx, jz, 0.7 + rnd() * 0.35 + Math.min(0.3, d * 0.03)); else if (r < 0.9 && zi !== 5) put(rnd() < 0.5 ? 'Bush_Large' : 'Bush', jx, jz, 1 + rnd()); }
    else if (r < (low ? 0.12 : 0.22) * th.density) put(th.trees[Math.floor(rnd() * th.trees.length)], jx, jz, 1.1 + rnd() * 0.6);
  }
  // details inside walkable areas
  const fl = low ? 500 : 1300;
  for (let i = 0, tries = 0; i < fl && tries < 30000; tries++) { const x = BX0 + rnd() * W, z = BZ0 + rnd() * D, d = sdf(x, z); if (d > -0.5 || pathD(x, z) < 2.2 || Math.hypot(x, z) < 21 || Math.hypot(x - ARENA[0], z - ARENA[1]) < 19) continue;
    if (ZONES.some((zz) => Math.hypot(x - zz.way[0], z - zz.way[1]) < 3)) continue;
    const th = ZONES[zoneAt(x, z)].theme, n = th.deco[Math.floor(rnd() * th.deco.length)]; const rock = n.startsWith('Rock');
    if (rock) { if (d > -2.5 || rnd() < 0.6) continue; const s = 0.8 + rnd(); put(n, x, z, s); addCol(x, z, 0.55 * s); } else put(n, x, z, /Bush_Large/.test(n) ? 0.9 : 1.4 + rnd()); i++; }
  for (const [n, items] of Object.entries(trees)) scatter(n, items, !low && !/Grass|Flower/.test(n));

  // ---- ambient particles (per-zone tint) ----
  const mk = (n: number, size: number, color: number, kind: string, blend: boolean) => { const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 60, rnd() * 8, (rnd() - 0.5) * 50], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false, blending: blend ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false })); pts.frustumCulled = false; add(pts); animated.parts.push({ pts, kind }); return pts; };
  mk(low ? 60 : 150, 0.22, 0xe8a040, 'leaf', false); if (!low) mk(200, 0.1, 0xfff0b0, 'dust', true);
  buildMinimapBase();
}
export function openGate() { const g = world.gates[0]; if (g && !g.open) { g.open = true; return true; } return false; }
export function setGateOpen(open: boolean) { const g = world.gates[0]; if (!g) return; g.open = open; if (g.mesh) { g.mesh.visible = !open; g.mesh.position.y = heightAt(g.x, g.z) + 2.2; } }
export function setWayActive(id: string, on: boolean) { const w = world.ways.find((x) => x.id === id); if (w) (w.crystal.material as THREE.MeshBasicMaterial).color.set(on ? 0x4fe3ff : 0x5a6a7a); }
let zoneTint = new THREE.Color(0xe8a040); const tmpC = new THREE.Color();
export function updateWorld(t: number, dt: number, focus: THREE.Vector3, zi: number) {
  if (animated.blades) animated.blades.rotation.z = t * 0.6; for (const w of animated.water) w.uniforms.t.value = t;
  for (const c of animated.crystals) c.rotation.y = t; for (const w of world.ways) { w.crystal.rotation.y = t * 1.5; w.crystal.position.y = 3 + Math.sin(t * 2) * 0.2; }
  for (const g of world.gates) if (g.open && g.mesh && g.mesh.visible) { g.mesh.position.y -= dt * 3; if (g.mesh.position.y < -6) g.mesh.visible = false; }
  zoneTint.lerp(tmpC.set(ZONES[zi].theme.particle), Math.min(1, dt * 2));
  for (const { pts, kind } of animated.parts) { pts.position.set(focus.x, heightAt(focus.x, focus.z), focus.z); const a = pts.geometry.attributes.position as THREE.BufferAttribute; const lf = kind === 'leaf';
    if (lf) (pts.material as THREE.PointsMaterial).color.copy(zoneTint);
    for (let i = 0; i < a.count; i++) { let x = a.getX(i), y = a.getY(i), z = a.getZ(i); if (lf) { x += Math.sin(t + i) * dt * 0.8 + dt * 0.6; y -= dt * (zi === 5 ? -0.8 : 0.7); z += Math.cos(t * 0.7 + i) * dt * 0.5; if (y < 0) y = 8; if (y > 8) y = 0; } else { y += Math.sin(t * 0.5 + i) * dt * 0.15; x += Math.cos(t * 0.3 + i) * dt * 0.1; }
      if (x > 30) x -= 60; if (x < -30) x += 60; a.setXYZ(i, x, y, z); } a.needsUpdate = true; }
}
export function setBeam(on: number, t: number) { if (world.beam) (world.beam.material as THREE.MeshBasicMaterial).opacity = on * (0.2 + Math.sin(t * 3) * 0.05); if (world.seal) world.seal.rotation.z = t * 0.3; }

// ---------- minimap + world map with fog of war ----------
const MW = BX1 - BX0, MH = BZ1 - BZ0;
export const mapBase = document.createElement('canvas'); mapBase.width = MW; mapBase.height = MH;
export const mapFog = document.createElement('canvas'); mapFog.width = MW; mapFog.height = MH; const fg = mapFog.getContext('2d')!;
function buildMinimapBase() { const g = mapBase.getContext('2d')!; const img = g.createImageData(MW, MH);
  const zc = ZONES.map((z) => [(z.theme.grass >> 16) & 255, (z.theme.grass >> 8) & 255, z.theme.grass & 255]);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) { const x = BX0 + i, z = BZ0 + j, d = sdf(x, z), k = (j * MW + i) * 4; let c = [26, 40, 30];
    if (d < 0) c = pathD(x, z) < 2 ? [201, 164, 106] : zc[zoneAt(x, z)]; else if (seaF(x, z) > 0.5) c = d < 3 ? [214, 196, 140] : [50, 120, 170];
    if (LAVA.some(([lx, lz, lr]) => Math.hypot(x - lx, z - lz) < lr)) c = [230, 90, 20]; if (Math.hypot(x - ARENA[0], z - ARENA[1]) < 18) c = [150, 140, 175];
    img.data.set([c[0], c[1], c[2], 255], k); } g.putImageData(img, 0, 0); }
export function resetFog() { fg.globalCompositeOperation = 'source-over'; fg.fillStyle = '#0a1210'; fg.fillRect(0, 0, MW, MH); }
export function reveal(p: THREE.Vector3, r = 20) { const x = p.x - BX0, y = p.z - BZ0; fg.globalCompositeOperation = 'destination-out'; const gr = fg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#000'); gr.addColorStop(0.7, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)'); fg.fillStyle = gr; fg.beginPath(); fg.arc(x, y, r, 0, 7); fg.fill(); }
export const fogData = () => mapFog.toDataURL('image/webp', 0.5);
export function loadFog(url: string) { return new Promise<void>((res) => { const im = new Image(); im.onload = () => { fg.globalCompositeOperation = 'source-over'; fg.clearRect(0, 0, MW, MH); fg.drawImage(im, 0, 0); res(); }; im.onerror = () => res(); im.src = url; }); }
export function drawMinimap(cv: HTMLCanvasElement, player: THREE.Vector3, face: THREE.Vector3, marks: { x: number; z: number; c: string; r: number }[]) {
  const g = cv.getContext('2d')!, S = cv.width, R = 55, k = S / (R * 2); g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.clip();
  g.fillStyle = '#0a1210'; g.fillRect(0, 0, S, S); g.translate(S / 2, S / 2); g.scale(k, k); g.translate(-(player.x - BX0), -(player.z - BZ0));
  g.imageSmoothingEnabled = false; g.drawImage(mapBase, 0, 0); g.drawImage(mapFog, 0, 0);
  for (const m of marks) if (Math.hypot(m.x - player.x, m.z - player.z) < R + 5) { g.fillStyle = m.c; g.beginPath(); g.arc(m.x - BX0, m.z - BZ0, m.r, 0, 7); g.fill(); }
  g.restore();
  g.save(); g.translate(S / 2, S / 2); g.rotate(Math.atan2(face.z, face.x)); g.fillStyle = '#4fe3ff'; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(7, 0); g.lineTo(-4, 4.5); g.lineTo(-4, -4.5); g.closePath(); g.fill(); g.stroke(); g.restore();
}
export type { Zone };
