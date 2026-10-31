import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { scene } from './scene';

// ================= Meadow Route: handcrafted zone =================
// x: west(-) / east(+), z: south(+) / north(-). Town in the south, Mewtwo's arena at the far north.
export const HALF = 999;
export interface Camp { pos: THREE.Vector3; tier: number; cleared: boolean; found: boolean; active: boolean; name: string; }
interface Gate { x: number; z: number; r: number; open: boolean; mesh: THREE.Object3D | null; kind: 'shortcut' | 'seal'; }
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const world = { group: new THREE.Group(), camps: [] as Camp[], shrine: V(0, 0, -150), start: V(0, 0, 18), beam: null as THREE.Mesh | null, seal: null as THREE.Mesh | null, gates: [] as Gate[], built: '' };
scene.add(world.group); world.group.visible = false;

// ---- walkable layout (circles + capsules) ----
type Circ = [number, number, number]; type Cap = [number, number, number, number, number];
const CIRCLES: Circ[] = [[0, 14, 15], [0, -38, 12], [-28, -56, 11], [28, -58, 12], [0, -78, 9], [-28, -112, 11], [24, -114, 11], [0, -150, 18]];
const PATHS: Cap[] = [
  [0, 2, 0, -28, 4.5], [-6, -44, -22, -51, 4], [6, -44, 22, -52, 4], [-24, -65, -6, -75, 4], [24, -67, 6, -75, 4], // town -> meadow -> loop
  [-5, -82, -20, -85, 3.5], [5, -82, 18, -85, 3.5], [-20, -84, -20, -100, 3.2], [18, -84, 18, -100, 3.2], // to the bridges
  [-28, -104, 24, -106, 4.5], [0, -106, 0, -133, 4], // northern ridge + arena approach
  [12, 10, 36, -8, 3.5], [36, -8, 36, -46, 3.5], // shortcut (east trail)
];
const RIVER_Z = -91, RIVER_W = 3.2; const BRIDGES = [-20, 18];
function segD(px: number, pz: number, ax: number, az: number, bx: number, bz: number) { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = ((px - ax) * dx + (pz - az) * dz) / l; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax + t * dx), pz - (az + t * dz)); }
export function sdf(x: number, z: number) { let d = 1e9; for (const [cx, cz, r] of CIRCLES) d = Math.min(d, Math.hypot(x - cx, z - cz) - r); for (const [ax, az, bx, bz, w] of PATHS) d = Math.min(d, segD(x, z, ax, az, bx, bz) - w); return d; }
function pathD(x: number, z: number) { let d = 1e9; for (const [ax, az, bx, bz] of PATHS) d = Math.min(d, segD(x, z, ax, az, bx, bz)); return d; }
const inRiver = (x: number, z: number) => Math.abs(z - RIVER_Z) < RIVER_W;
const onBridge = (x: number) => BRIDGES.some((b) => Math.abs(x - b) < 2.6);
const plateau = (z: number) => { const t = Math.min(1, Math.max(0, (-z - 96) / 10)); return 1.4 * t * t * (3 - 2 * t); };
export function heightAt(x: number, z: number) { if (inRiver(x, z)) return onBridge(x) ? 0.35 : 0; return plateau(z); }

// solid obstacles inside the walkable area (rocks, houses, trees...) on a hash grid
interface Col { x: number; z: number; r: number; }
const CELL = 6, grid = new Map<number, Col[]>(); const key = (cx: number, cz: number) => (cx + 200) * 1000 + (cz + 200);
function addCol(x: number, z: number, r: number) { const c = { x, z, r }; for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) for (let gz = Math.floor((z - r) / CELL); gz <= Math.floor((z + r) / CELL); gz++) { const k = key(gx, gz); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(c); } }
function hitCol(x: number, z: number, r: number) { const a = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (a) for (const c of a) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return c; return null; }
const gateHit = (x: number, z: number, r: number) => world.gates.some((g) => !g.open && Math.hypot(x - g.x, z - g.z) < g.r + r);
export function walkable(x: number, z: number, r: number) { return sdf(x, z) < -r && !(inRiver(x, z) && !onBridge(x)) && !gateHit(x, z, r); }
/** resolve movement: slide along walls, push out of round obstacles */
export function collide(p: THREE.Vector3, r: number, prev?: THREE.Vector3) {
  const c = hitCol(p.x, p.z, r); if (c) { const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1e-3; p.x = c.x + (dx / d) * (c.r + r); p.z = c.z + (dz / d) * (c.r + r); }
  if (walkable(p.x, p.z, r) || !prev) return;
  if (!walkable(prev.x, prev.z, r)) return; // never trap someone who is already out of bounds
  if (walkable(p.x, prev.z, r)) { p.z = prev.z; return; } if (walkable(prev.x, p.z, r)) { p.x = prev.x; return; } p.x = prev.x; p.z = prev.z;
}
/** projectiles stop on trees, rocks, walls and closed gates (they fly over water) */
export function projBlocked(p: THREE.Vector3) { return sdf(p.x, p.z) > 0.2 || !!hitCol(p.x, p.z, 0) || gateHit(p.x, p.z, 0); }

// ---- assets ----
const NAT = ['MapleTree_1', 'PineTree_2', 'PineTree_4', 'NormalTree_5', 'DeadTree_2', 'Bush_Large', 'Bush_Large_Flowers', 'Bush', 'Flower_3_Clump', 'Flower_4_Clump', 'Grass_Large', 'Rock_1', 'Rock_3', 'Rock_5'];
const models: Record<string, THREE.Mesh[]> = {};
export async function loadWorldAssets() {
  const l = new GLTFLoader();
  await Promise.all(NAT.map(async (n) => { const g = await l.loadAsync(`/assets/nature/${n}.glb`); models[n] = []; g.scene.updateMatrixWorld(true); g.scene.traverse((o: any) => { if (o.isMesh) { o.geometry.applyMatrix4(o.matrixWorld); models[n].push(o); } }); }));
  // HD-2D palette tweaks
  for (const n of ['PineTree_2', 'PineTree_4']) for (const mm of models[n]) for (const m of [mm.material].flat() as THREE.MeshStandardMaterial[]) if (m.map) m.color.set(0x8fc070);
}

let seed = 9; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const disposables: THREE.Object3D[] = []; const animated: { blades?: THREE.Object3D; water?: THREE.ShaderMaterial; leaves?: THREE.Points; dust?: THREE.Points; crystals: THREE.Object3D[] } = { crystals: [] };

// instanced scatter, chunked into tiles so frustum culling works on phones
function scatter(name: string, items: { x: number; z: number; s: number; ry: number }[], shadow: boolean) {
  const srcs = models[name]; if (!srcs || !items.length) return; const T = 32; const tiles = new Map<string, typeof items>();
  for (const it of items) { const k = Math.floor(it.x / T) + ',' + Math.floor(it.z / T); let a = tiles.get(k); if (!a) tiles.set(k, (a = [])); a.push(it); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = V(0, 1, 0);
  for (const a of tiles.values()) for (const src of srcs) { const im = new THREE.InstancedMesh(src.geometry, src.material, a.length);
    a.forEach((it, i) => { q.setFromAxisAngle(up, it.ry); m4.compose(V(it.x, heightAt(it.x, it.z) - 0.05, it.z), q, V(it.s, it.s, it.s)); im.setMatrixAt(i, m4); });
    im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = false; add(im); }
}
const add = (o: THREE.Object3D) => { world.group.add(o); disposables.push(o); };
const std = (c: number, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
function mesh(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, shadow = true) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; return o; }

export function buildWorld(low: boolean) {
  const sig = low ? 'low' : 'high';
  // per-run state reset
  world.camps = [
    { pos: V(0, 0, -38), tier: 0, name: 'meadow' }, { pos: V(-28, 0, -56), tier: 0, name: 'grove' }, { pos: V(28, 0, -58), tier: 1, name: 'bigtree' },
    { pos: V(0, 0, -78), tier: 1, name: 'crossing' }, { pos: V(-28, 0, -112), tier: 2, name: 'ruins' }, { pos: V(24, 0, -114), tier: 2, name: 'ridge' },
  ].map((c) => ({ ...c, cleared: false, found: false, active: false }));
  if (world.built === sig) { for (const g of world.gates) { g.open = false; if (g.mesh) { g.mesh.visible = true; g.mesh.position.y = 0; } } return; }
  for (const o of disposables) world.group.remove(o); disposables.length = 0; grid.clear(); world.gates = []; animated.crystals = []; seed = 9; world.built = sig;

  // ---- ground: displaced, vertex-coloured terrain ----
  const W = 150, D = 230, cz = -66, seg = low ? 1 : 1.5;
  const geo = new THREE.PlaneGeometry(W, D, Math.round(W * seg), Math.round(D * seg)); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, cz);
  const pos = geo.attributes.position as THREE.BufferAttribute, cols = new Float32Array(pos.count * 3), col = new THREE.Color(), tmp = new THREE.Color();
  const grass = new THREE.Color(0x6fae4a), grass2 = new THREE.Color(0x8cc45a), dirt = new THREE.Color(0xc9a46a), stone = new THREE.Color(0xc8bfae), sand = new THREE.Color(0xd9c98f), hill = new THREE.Color(0x4f8a3c), arenaC = new THREE.Color(0x9a92b0);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const d = sdf(x, z), n = Math.sin(x * 0.31) * Math.cos(z * 0.27) + Math.sin(x * 0.07 + z * 0.05);
    let y = plateau(z) + (d > 0 ? Math.min(4.5, d * 0.32) * (0.8 + 0.25 * n) : 0) + n * 0.06;
    const rd = Math.abs(z - RIVER_Z); if (rd < RIVER_W + 1.2) y = Math.min(y, -0.9 + Math.max(0, rd - RIVER_W + 0.4) * 0.9 + plateau(z) * 0);
    pos.setY(i, y);
    col.copy(grass).lerp(grass2, 0.5 + 0.5 * Math.sin(x * 0.13 + z * 0.11) * Math.cos(z * 0.05));
    if (d > 0) col.lerp(hill, Math.min(1, d / 6));
    const pd = pathD(x, z); if (pd < 2.2 && d < 0) col.lerp(dirt, Math.min(1, (2.2 - pd) / 1.2));
    if (Math.hypot(x, z - 14) < 8) col.lerp(stone, Math.min(1, (8 - Math.hypot(x, z - 14)) / 1.5));
    if (Math.hypot(x, z + 150) < 17) col.lerp(arenaC, 0.85);
    if (rd < RIVER_W + 2.2) col.lerp(sand, Math.max(0, 1 - Math.abs(rd - RIVER_W - 0.6) / 1.6));
    tmp.setHSL(0, 0, 0.94 + 0.06 * Math.sin(i * 12.9898)); col.multiply(tmp); cols.set([col.r, col.g, col.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); ground.receiveShadow = true; add(ground);

  // ---- river (animated water shader) + bridges ----
  const wm = new THREE.ShaderMaterial({ transparent: true, uniforms: { t: { value: 0 } }, vertexShader: 'varying vec2 vU; varying vec3 vW; void main(){ vU=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float t; varying vec2 vU; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){ vec2 p=vW.xz*vec2(.35,.9); float a=n(p+vec2(t*.9,0.)), b=n(p*1.7-vec2(t*1.3,t*.2));
        float edge=smoothstep(.0,.18,vU.y)*smoothstep(1.,.82,vU.y); vec3 deep=vec3(.16,.45,.62), lite=vec3(.42,.78,.86);
        vec3 c=mix(deep,lite,a*.6+b*.3); float foam=smoothstep(.72,.9,a*b*1.6)+ (1.-edge)*.7; c=mix(c,vec3(.95,1.,1.),clamp(foam,0.,1.)*.75);
        gl_FragColor=vec4(c,.86); }` });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, RIVER_W * 2 + 1.4, 1, 1), wm); water.rotation.x = -Math.PI / 2; water.position.set(0, -0.22, RIVER_Z); add(water); animated.water = wm;
  const wood = std(0x9a6a3e), woodD = std(0x6b4527);
  for (const bx of BRIDGES) { const b = new THREE.Group(); b.position.set(bx, 0, RIVER_Z);
    for (let k = -5; k <= 5; k++) { const pl = mesh(new THREE.BoxGeometry(5.2, 0.18, 0.62), k % 2 ? wood : woodD, 0, 0.3 + Math.cos(k / 5 * 1.2) * 0.12, k * 0.68); b.add(pl); }
    for (const sx of [-2.5, 2.5]) { const rail = mesh(new THREE.BoxGeometry(0.16, 0.16, 7.6), woodD, sx, 1.05, 0); b.add(rail); for (const zz of [-3.6, -1.2, 1.2, 3.6]) b.add(mesh(new THREE.BoxGeometry(0.22, 1, 0.22), woodD, sx, 0.6, zz)); }
    add(b); }

  // ---- town hub ----
  const wall = std(0xf2e6cf), roofs = [0xc8553d, 0x3d6fc8, 0xd18f2e, 0x5a9a4a];
  const houses: [number, number, number][] = [[-9, 20, 0.3], [9, 22, -0.25], [-11, 8, 0.15], [10, 9, -0.2], [-4, 26, 0]];
  houses.forEach(([x, z, ry], i) => { const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = ry;
    h.add(mesh(new THREE.BoxGeometry(4.2, 2.6, 3.6), wall, 0, 1.3, 0)); const roof = mesh(new THREE.ConeGeometry(3.4, 1.9, 4), std(roofs[i % 4]), 0, 3.55, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.85); h.add(roof);
    h.add(mesh(new THREE.BoxGeometry(0.9, 1.5, 0.1), woodD, 0, 0.75, 1.82)); for (const wx of [-1.3, 1.3]) h.add(mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), std(0xffd98a, { emissive: 0xffb84a, emissiveIntensity: 0.6 }), wx, 1.5, 1.82, false));
    add(h); addCol(x, z, 2.5); });
  // fountain
  const fnt = new THREE.Group(); fnt.position.set(0, 0, 14); fnt.add(mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.6, 20), std(0xbab0a0), 0, 0.3, 0));
  const fw = mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0x6fd0e8, roughness: 0.1, emissive: 0x2a7090, emissiveIntensity: 0.4 }), 0, 0.58, 0, false); fnt.add(fw);
  fnt.add(mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.8, 10), std(0xbab0a0), 0, 1.2, 0)); add(fnt); addCol(0, 14, 2.6);
  // windmill landmark (west of town, visible across the route)
  const wmill = new THREE.Group(); wmill.position.set(-17, 0, 14);
  wmill.add(mesh(new THREE.CylinderGeometry(1.6, 2.6, 8, 8), wall, 0, 4, 0)); wmill.add(mesh(new THREE.ConeGeometry(2.3, 2.6, 8), std(0xc8553d), 0, 9.3, 0));
  const blades = new THREE.Group(); blades.position.set(0, 7.2, 2.1); for (let k = 0; k < 4; k++) { const bl = mesh(new THREE.BoxGeometry(0.5, 5.2, 0.08), std(0xe9dcc0), 0, 2.6, 0); const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI) / 2; arm.add(bl); blades.add(arm); }
  blades.add(mesh(new THREE.SphereGeometry(0.4, 8, 6), woodD, 0, 0, 0)); wmill.add(blades); animated.blades = blades; add(wmill); addCol(-17, 14, 2.8);
  // fences + lamp posts along the plaza
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; if (Math.abs(Math.sin(a)) > 0.85 && Math.cos(a) * 0 === 0 && Math.sin(a) < 0) continue; const x = Math.cos(a) * 13.2, z = 14 + Math.sin(a) * 13.2; if (z < 4) continue;
    const lamp = new THREE.Group(); lamp.position.set(x, 0, z); lamp.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), woodD, 0, 1.3, 0)); lamp.add(mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }), 0, 2.7, 0, false)); add(lamp); }

  // ---- ruins landmark (NW) ----
  const stoneM = std(0xb7b0a2, { flatShading: true }), mossy = std(0x8d9a78, { flatShading: true });
  const arch = (x: number, z: number, ry: number, broken = false) => { const g = new THREE.Group(); g.position.set(x, plateau(z), z); g.rotation.y = ry;
    for (const sx of [-2.2, 2.2]) { const h = broken && sx > 0 ? 2.4 : 5; g.add(mesh(new THREE.BoxGeometry(1.2, h, 1.2), sx > 0 ? mossy : stoneM, sx, h / 2, 0)); }
    if (!broken) g.add(mesh(new THREE.BoxGeometry(6, 1, 1.4), stoneM, 0, 5.4, 0)); add(g);
    const c = Math.cos(ry), s = Math.sin(ry); addCol(x + c * -2.2, z - s * -2.2, 0.9); addCol(x + c * 2.2, z - s * 2.2, 0.9); };
  arch(-28, -103, 0); arch(-36, -112, Math.PI / 2, true); arch(-20, -120, 0.4); arch(-31, -121, -0.3, true);
  for (let k = 0; k < 6; k++) { const x = -28 + (rnd() - 0.5) * 14, z = -112 + (rnd() - 0.5) * 12; if (Math.hypot(x + 28, z + 112) < 4) continue; const b = mesh(new THREE.BoxGeometry(1.3, 0.6, 1.3), stoneM, x, plateau(z) + 0.3, z); b.rotation.set(rnd() * 0.4, rnd() * 3, rnd() * 0.4); add(b); }
  // giant tree landmark (east meadow)
  if (models.MapleTree_1) { const gt = new THREE.Group(); for (const m of models.MapleTree_1) { const mm = new THREE.Mesh(m.geometry, m.material); mm.castShadow = !low; gt.add(mm); } gt.position.set(38, 0, -64); gt.scale.setScalar(3.2); add(gt); addCol(38, -64, 2.4); }

  // ---- boss arena (far north) ----
  const A = world.shrine; const arenaFloor = mesh(new THREE.CylinderGeometry(17.5, 18, 0.3, 48), std(0xa79fc0), A.x, plateau(A.z) + 0.02, A.z); arenaFloor.castShadow = false; add(arenaFloor);
  const sigil = new THREE.Mesh(new THREE.RingGeometry(6, 6.6, 6), new THREE.MeshBasicMaterial({ color: 0xc06bff, transparent: true, opacity: 0.85, toneMapped: false })); sigil.rotation.x = -Math.PI / 2; sigil.position.set(A.x, plateau(A.z) + 0.2, A.z); add(sigil); world.seal = sigil;
  for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2 + Math.PI / 14; if (Math.abs(a - Math.PI / 2) < 0.35) continue; const x = A.x + Math.cos(a) * 19.5, z = A.z + Math.sin(a) * 19.5;
    add(mesh(new THREE.BoxGeometry(1.6, 6 + (k % 3), 1.6), stoneM, x, plateau(z) + (6 + (k % 3)) / 2, z)); const cr = mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshBasicMaterial({ color: 0xc06bff, toneMapped: false }), x, plateau(z) + 8 + (k % 3), z, false); add(cr); animated.crystals.push(cr); }
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 70, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xc06bff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  beam.position.set(A.x, 35, A.z); add(beam); world.beam = beam;
  // gates: seal (arena entrance) + shortcut boulder (east trail)
  const sealM = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({ color: 0xb06bff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  sealM.position.set(0, plateau(-128) + 2.2, -128); add(sealM); world.gates.push({ x: 0, z: -128, r: 4.6, open: false, mesh: sealM, kind: 'seal' });
  const boulder = new THREE.Group(); boulder.position.set(36, 0, -22); for (let k = 0; k < 3; k++) { const r = mesh(new THREE.DodecahedronGeometry(1.6 - k * 0.3, 0), stoneM, (k - 1) * 1.8, 1.1, (k % 2) * 0.6); r.rotation.set(k, k * 2, 0); boulder.add(r); } add(boulder);
  world.gates.push({ x: 36, z: -22, r: 3.6, open: false, mesh: boulder, kind: 'shortcut' });

  // ---- vegetation ----
  const trees: Record<string, { x: number; z: number; s: number; ry: number }[]> = {}; const put = (n: string, x: number, z: number, s: number) => (trees[n] ??= []).push({ x, z, s, ry: rnd() * 6.28 });
  const treeKinds = ['PineTree_2', 'PineTree_4', 'NormalTree_5', 'MapleTree_1', 'PineTree_2'];
  const step = low ? 4.2 : 3.2;
  for (let x = -W / 2; x < W / 2; x += step) for (let z = cz - D / 2; z < cz + D / 2; z += step) {
    const jx = x + (rnd() - 0.5) * step * 0.9, jz = z + (rnd() - 0.5) * step * 0.9, d = sdf(jx, jz);
    if (Math.abs(jz - RIVER_Z) < RIVER_W + 1.5) continue;
    if (d > 1.6 && d < 14) { if (rnd() < (d < 5 ? 0.8 : 0.45)) put(treeKinds[Math.floor(rnd() * treeKinds.length)], jx, jz, 0.7 + rnd() * 0.35 + Math.min(0.3, d * 0.03)); else if (rnd() < 0.5) put(rnd() < 0.5 ? 'Bush_Large' : 'Bush', jx, jz, 1 + rnd()); }
    else if (d >= 14 && rnd() < (low ? 0.12 : 0.22)) put(treeKinds[Math.floor(rnd() * 3)], jx, jz, 1.1 + rnd() * 0.6);
  }
  // meadow details: flowers, grass tufts, bushes along edges, a few rocks (solid)
  const fl = low ? 160 : 420;
  for (let i = 0, tries = 0; i < fl && tries < 9000; tries++) { const x = (rnd() - 0.5) * W, z = cz + (rnd() - 0.5) * D, d = sdf(x, z); if (d > -0.5 || inRiver(x, z) || pathD(x, z) < 2 || Math.hypot(x, z - 14) < 9 || Math.hypot(x, z + 150) < 18) continue;
    const r = rnd(); put(r < 0.4 ? 'Grass_Large' : r < 0.7 ? 'Flower_3_Clump' : r < 0.9 ? 'Flower_4_Clump' : 'Bush_Large_Flowers', x, z, r < 0.9 ? 1.6 + rnd() : 0.9); i++; }
  for (let i = 0, tries = 0; i < 26 && tries < 3000; tries++) { const x = (rnd() - 0.5) * W, z = cz + (rnd() - 0.5) * D, d = sdf(x, z); if (d > -2.5 || d < -9 || pathD(x, z) < 3.5 || inRiver(x, z) || Math.hypot(x, z - 14) < 14 || Math.hypot(x, z + 150) < 19) continue;
    const s = 1 + rnd() * 1.2; put(['Rock_1', 'Rock_3', 'Rock_5'][i % 3], x, z, s); addCol(x, z, 0.6 * s); i++; }
  for (const [n, items] of Object.entries(trees)) scatter(n, items, !low && !/Grass|Flower/.test(n));

  // camp markers: campfire + logs
  for (const c of world.camps) { const g = new THREE.Group(); g.position.set(c.pos.x, plateau(c.pos.z), c.pos.z);
    for (let k = 0; k < 3; k++) { const l = mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2, 6), woodD, 0, 0.15, 0); l.rotation.set(Math.PI / 2, 0, (k * Math.PI) / 3); g.add(l); }
    g.add(mesh(new THREE.ConeGeometry(0.35, 0.9, 6), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false }), 0, 0.55, 0, false)); add(g); addCol(c.pos.x, c.pos.z, 0.5); }

  // ---- ambient particles: drifting leaves + golden dust (follow the camera) ----
  const mk = (n: number, size: number, color: number, add2: boolean) => { const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) p.set([(rnd() - 0.5) * 60, rnd() * 8, (rnd() - 0.5) * 50], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.85, depthWrite: false, blending: add2 ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false })); pts.frustumCulled = false; add(pts); return pts; };
  animated.leaves = mk(low ? 60 : 160, 0.22, 0xe8a040, false); animated.dust = low ? undefined : mk(220, 0.09, 0xfff0b0, true);
  buildMinimapBase();
}
export function openGate(kind: 'shortcut' | 'seal') { const g = world.gates.find((x) => x.kind === kind); if (g && !g.open) { g.open = true; return true; } return false; }
export function updateWorld(t: number, dt: number, focus: THREE.Vector3) {
  if (animated.blades) animated.blades.rotation.z = t * 0.6; if (animated.water) animated.water.uniforms.t.value = t;
  for (const c of animated.crystals) { c.rotation.y = t; }
  for (const g of world.gates) if (g.open && g.mesh && g.mesh.visible) { g.mesh.position.y -= dt * 3; if (g.mesh.position.y < -6) g.mesh.visible = false; }
  for (const pts of [animated.leaves, animated.dust]) { if (!pts) continue; pts.position.set(focus.x, 0, focus.z); const a = pts.geometry.attributes.position as THREE.BufferAttribute; const lf = pts === animated.leaves;
    for (let i = 0; i < a.count; i++) { let x = a.getX(i), y = a.getY(i), z = a.getZ(i); if (lf) { x += Math.sin(t + i) * dt * 0.8 + dt * 0.6; y -= dt * 0.7; z += Math.cos(t * 0.7 + i) * dt * 0.5; if (y < 0) { y = 8; } } else { y += Math.sin(t * 0.5 + i) * dt * 0.15; x += Math.cos(t * 0.3 + i) * dt * 0.1; }
      if (x > 30) x -= 60; if (x < -30) x += 60; a.setXYZ(i, x, y, z); } a.needsUpdate = true; }
}
export function setBeam(on: number, t: number) { if (world.beam) (world.beam.material as THREE.MeshBasicMaterial).opacity = on * (0.2 + Math.sin(t * 3) * 0.05); if (world.seal) world.seal.rotation.z = t * 0.3; }

// ---------- minimap: local radar with fog of war ----------
const X0 = -75, Z0 = -181, MW = 150, MH = 230; // 1px = 1 unit
const base = document.createElement('canvas'); base.width = MW; base.height = MH;
const fog = document.createElement('canvas'); fog.width = MW; fog.height = MH; const fg = fog.getContext('2d')!;
function buildMinimapBase() { const g = base.getContext('2d')!; const img = g.createImageData(MW, MH);
  for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) { const x = X0 + i, z = Z0 + j, d = sdf(x, z), k = (j * MW + i) * 4; let c = [30, 58, 34];
    if (d < 0) c = pathD(x, z) < 2 ? [201, 164, 106] : [111, 174, 74]; if (inRiver(x, z)) c = onBridge(x) && d < 0 ? [154, 106, 62] : [70, 150, 200]; if (Math.hypot(x, z + 150) < 18) c = [167, 159, 192];
    img.data.set([c[0], c[1], c[2], 255], k); } g.putImageData(img, 0, 0); }
export function resetFog() { fg.globalCompositeOperation = 'source-over'; fg.fillStyle = '#0a1210'; fg.fillRect(0, 0, MW, MH); }
export function reveal(p: THREE.Vector3, r = 18) { const x = p.x - X0, y = p.z - Z0; fg.globalCompositeOperation = 'destination-out'; const gr = fg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#000'); gr.addColorStop(0.7, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)'); fg.fillStyle = gr; fg.beginPath(); fg.arc(x, y, r, 0, 7); fg.fill(); }
export function drawMinimap(cv: HTMLCanvasElement, player: THREE.Vector3, face: THREE.Vector3, shrineOpen: boolean, enemies: THREE.Vector3[]) {
  const g = cv.getContext('2d')!, S = cv.width, R = 55, k = S / (R * 2); g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.clip();
  g.fillStyle = '#0a1210'; g.fillRect(0, 0, S, S); g.translate(S / 2, S / 2); g.scale(k, k); g.translate(-(player.x - X0), -(player.z - Z0));
  g.imageSmoothingEnabled = false; g.drawImage(base, 0, 0); g.drawImage(fog, 0, 0);
  const dot = (x: number, z: number, r: number, c: string) => { g.fillStyle = c; g.beginPath(); g.arc(x - X0, z - Z0, r, 0, 7); g.fill(); };
  for (const c of world.camps) if (c.found) dot(c.pos.x, c.pos.z, 3, c.cleared ? '#6fe38a' : '#ff8a2a');
  for (const e of enemies) if (e.distanceTo(player) < 30) dot(e.x, e.z, 1.3, '#ff3f5a');
  if (shrineOpen) dot(world.shrine.x, world.shrine.z, 4, '#c06bff');
  g.restore();
  // edge arrow toward the arena once the seal is broken
  if (shrineOpen) { const a = Math.atan2(world.shrine.z - player.z, world.shrine.x - player.x), d = player.distanceTo(world.shrine); if (d > R) { g.save(); g.translate(S / 2 + Math.cos(a) * (S / 2 - 8), S / 2 + Math.sin(a) * (S / 2 - 8)); g.rotate(a); g.fillStyle = '#c06bff'; g.beginPath(); g.moveTo(7, 0); g.lineTo(-4, 5); g.lineTo(-4, -5); g.fill(); g.restore(); } }
  g.save(); g.translate(S / 2, S / 2); g.rotate(Math.atan2(face.z, face.x)); g.fillStyle = '#4fe3ff'; g.strokeStyle = '#000'; g.beginPath(); g.moveTo(7, 0); g.lineTo(-4, 4.5); g.lineTo(-4, -4.5); g.closePath(); g.fill(); g.stroke(); g.restore();
}
