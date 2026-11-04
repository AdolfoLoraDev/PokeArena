// Zone backdrops: KayKit mountains / hills ring each region so every zone has a distinct silhouette.
import * as THREE from 'three';
import { place, kk } from './town';
import { sdf, zoneAt, seaF } from './world';

let s = 77; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const SETS: Record<number, { n: string[]; count: number; sc: [number, number]; d: [number, number] }> = {
  1: { n: ['hills_A_trees'], count: 14, sc: [9, 14], d: [12, 40] },
  2: { n: ['hills_A_trees', 'mountain_A_grass_trees'], count: 14, sc: [10, 16], d: [14, 44] },
  4: { n: ['mountain_A_grass_trees', 'mountain_B_grass', 'mountain_C'], count: 22, sc: [14, 24], d: [12, 50] },
  5: { n: ['mountain_A', 'mountain_C'], count: 18, sc: [13, 22], d: [12, 50] },
};
let ashMat: THREE.MeshStandardMaterial | null = null;
export function buildDecor(low: boolean, add: (o: THREE.Object3D) => void, gy: (x: number, z: number) => number) {
  s = 77;
  for (const [zk, set] of Object.entries(SETS)) { const zi = +zk; let placed = 0;
    for (let tries = 0; tries < 4000 && placed < (low ? Math.ceil(set.count * 0.6) : set.count); tries++) {
      const x = -160 + rnd() * 332, z = -250 + rnd() * 326, d = sdf(x, z);
      if (d < set.d[0] || d > set.d[1] || zoneAt(x, z) !== zi || seaF(x, z) > 0.2) continue;
      const n = set.n[Math.floor(rnd() * set.n.length)]; const sc = set.sc[0] + rnd() * (set.sc[1] - set.sc[0]);
      const o = place(add, (a, b) => gy(a, b) - 1.2, n, x, z, sc, rnd() * 6.28); if (!o) continue; placed++;
      if (zi === 5) { if (!ashMat) { ashMat = new THREE.MeshStandardMaterial({ color: 0x4a3530, roughness: 1, flatShading: true }); }
        o.traverse((m: any) => { if (m.isMesh) m.material = ashMat; }); }
      o.traverse((m: any) => { if (m.isMesh) m.castShadow = false; });
    }
  }
  // coast: lilies & water plants in the shallows
  if (kk.waterlily_A) for (let i = 0; i < (low ? 14 : 30); i++) { const x = 60 + rnd() * 110, z = -40 + rnd() * 110, d = sdf(x, z); if (seaF(x, z) < 0.6 || d < 2 || d > 14) continue;
    const o = place(add, () => -0.3, rnd() < 0.6 ? 'waterlily_A' : 'waterplant_A', x, z, 2.5 + rnd() * 2, rnd() * 6.28); if (o) o.traverse((m: any) => { if (m.isMesh) m.castShadow = false; }); }
}
