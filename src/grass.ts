// Dense instanced grass around the player: stable per-cell hash placement, wind sway and player push.
import * as THREE from 'three';
import { ZONES, ARENA } from './zones';
import { sdf, zoneAt, groundY, pathD, seaF, LAVA } from './world';

const DENS = [0.35, 0.95, 0.85, 0.45, 0.4, 0.07];
const U = { uT: { value: 0 }, uP: { value: new THREE.Vector3() } };
let mesh: THREE.InstancedMesh | null = null, R = 30, CELL = 0.85, last = new THREE.Vector3(1e9, 0, 0);
function bladeGeo() {
  const pos: number[] = [], idx: number[] = [], nrm: number[] = []; let v = 0;
  for (let b = 0; b < 7; b++) { const a = (b / 7) * Math.PI * 2 + b * 0.7, r = b ? 0.12 + (b % 3) * 0.08 : 0, ox = Math.cos(a) * r, oz = Math.sin(a) * r, h = 0.3 + ((b * 37) % 10) / 26, w = 0.085, ry = a * 1.7;
    const cx = Math.cos(ry) * w, cz = Math.sin(ry) * w, lean = 0.12;
    pos.push(ox - cx, 0, oz - cz, ox + cx, 0, oz + cz, ox - cx * 0.5 + lean * Math.cos(a), h * 0.6, oz - cz * 0.5 + lean * Math.sin(a), ox + cx * 0.5 + lean * Math.cos(a), h * 0.6, oz + cz * 0.5 + lean * Math.sin(a), ox + lean * 1.8 * Math.cos(a), h, oz + lean * 1.8 * Math.sin(a));
    for (let k = 0; k < 5; k++) nrm.push(0, 1, 0); idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2, v + 2, v + 3, v + 4); v += 5; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx); return g;
}
function grassMat() {
  const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform vec3 uP; varying float vH;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vH = clamp(position.y / 0.9, 0., 1.); vec3 ip = instanceMatrix[3].xyz; float h2 = vH * vH;
        float w = sin(uT * 1.9 + ip.x * 0.35 + ip.z * 0.22) * 0.6 + sin(uT * 3.7 + ip.x * 0.9) * 0.25;
        transformed.x += w * 0.16 * h2; transformed.z += w * 0.07 * h2;
        vec3 dd = ip - uP; float dl = length(dd.xz); float push = smoothstep(1.4, 0.2, dl) * h2 * 0.5; transformed.xz += normalize(dd.xz + 0.001) * push; transformed.y -= push * 0.4;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.66, 1.12, vH);');
  };
  m.customProgramCacheKey = () => 'grass-wind'; return m;
}
const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
export function buildGrass(low: boolean, add: (o: THREE.Object3D) => void) {
  R = low ? 20 : 30; CELL = low ? 0.9 : 0.72; const max = Math.ceil((Math.PI * R * R) / (CELL * CELL));
  mesh = new THREE.InstancedMesh(bladeGeo(), grassMat(), max); mesh.frustumCulled = false; mesh.receiveShadow = !low; mesh.count = 0;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3); add(mesh); last.set(1e9, 0, 0);
}
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color(), c2 = new THREE.Color();
function regen(f: THREE.Vector3) {
  if (!mesh) return; let n = 0; const x0 = Math.floor((f.x - R) / CELL), x1 = Math.ceil((f.x + R) / CELL), z0 = Math.floor((f.z - R) / CELL), z1 = Math.ceil((f.z + R) / CELL);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
    const h = hash(i, j), x = (i + hash(j, i) * 0.9) * CELL, z = (j + h * 0.9) * CELL; if ((x - f.x) ** 2 + (z - f.z) ** 2 > R * R) continue;
    const d = sdf(x, z); if (d > 5) continue; const zi = zoneAt(x, z); let p = DENS[zi]; if (d > 0) p *= 1 - d / 5;
    if (h > p) continue;
    if (pathD(x, z) < 2.5 || seaF(x, z) > 0.3 || Math.hypot(x, z - 3) < 10.5 || Math.hypot(x - ARENA[0], z - ARENA[1]) < 19) continue;
    if (LAVA.some(([lx, lz, lr]) => Math.hypot(x - lx, z - lz) < lr + 3)) continue;
    const s = 0.8 + hash(i * 3, j * 7) * 0.9; q.setFromAxisAngle(up, h * 40); m4.compose(ps.set(x, groundY(x, z) - 0.03, z), q, sc.set(s, s * (zi === 2 ? 1.35 : 1), s));
    if (n >= (mesh.instanceMatrix.count)) break; mesh.setMatrixAt(n, m4);
    const th = ZONES[zi].theme; c.setHex(th.grass2).lerp(c2.setHex(th.grass), hash(j * 5, i * 2)); c.multiplyScalar(1.05); mesh.setColorAt(n, c); n++;
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
}
export function updateGrass(t: number, focus: THREE.Vector3, _zi: number) {
  if (!mesh) return; U.uT.value = t; U.uP.value.set(focus.x, 0, focus.z);
  if (Math.hypot(focus.x - last.x, focus.z - last.z) > R * 0.3) { last.copy(focus); regen(focus); }
}
