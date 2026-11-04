// Town hub built from KayKit Medieval Hexagon Pack buildings & props (CC0, Kay Lousberg).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { addCol, addFade } from './world';

const KK = ['building_tavern_blue', 'building_home_A_red', 'building_home_B_yellow', 'building_church_blue', 'building_market_red', 'building_blacksmith_red',
  'building_windmill_yellow', 'building_well_blue', 'building_tower_A_yellow', 'building_home_B_blue', 'building_home_A_yellow', 'building_watermill_blue',
  'barrel', 'crate_A_big', 'crate_B_small', 'sack', 'flag_red', 'flag_blue', 'tent', 'wheelbarrow', 'weaponrack', 'resource_lumber', 'bucket_water',
  'mountain_A_grass_trees', 'mountain_B_grass', 'mountain_C', 'mountain_A', 'hills_A_trees', 'cloud_big', 'cloud_small', 'waterlily_A', 'waterplant_A'];
export const kk: Record<string, THREE.Object3D> = {};
export async function loadTownAssets() {
  const l = new GLTFLoader();
  await Promise.all(KK.map(async (n) => { try { const g = await l.loadAsync(`/assets/kaykit/${n}.gltf`); g.scene.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; addFade(o.material); } }); kk[n] = g.scene; } catch { /* optional asset */ } }));
}
let spinner: THREE.Object3D | null = null; const flags: THREE.Object3D[] = [];
/** place a KayKit model; front faces +z, so ry = atan2(-x,-z) makes it face the plaza */
export function place(add: (o: THREE.Object3D) => void, gy: (x: number, z: number) => number, n: string, x: number, z: number, s: number, ry?: number, col = 0) {
  const src = kk[n]; if (!src) return null; const o = src.clone(true); o.position.set(x, gy(x, z) - 0.02, z); o.scale.setScalar(s);
  o.rotation.y = ry ?? Math.atan2(-x, -z); add(o); if (col) addCol(x, z, col); return o;
}
export function buildTown(low: boolean, add: (o: THREE.Object3D) => void, gy: (x: number, z: number) => number) {
  flags.length = 0; spinner = null;
  const P = (n: string, x: number, z: number, s: number, col = 0, ry?: number) => place(add, gy, n, x, z, s, ry, col);
  P('building_tavern_blue', 0, 18.5, 6.4, 3.8); P('building_home_A_red', -12, 13.5, 6.6, 2.6); P('building_home_B_yellow', 11.5, 14, 6.6, 2.6);
  P('building_church_blue', 15.5, -11.5, 6.2, 3.6); P('building_market_red', -14.5, -12, 6.2, 3.2); P('building_blacksmith_red', 18.5, 8.5, 5.6, 2.6);
  P('building_home_A_yellow', -19, 6.5, 5.6, 2.3); P('building_tower_A_yellow', 10, -18.5, 6, 2);
  const wm = P('building_windmill_yellow', -26, 15, 8, 3.2); if (wm) wm.traverse((o) => { if (/blade|wing|sail|fan/i.test(o.name)) spinner = o; });
  P('building_home_B_blue', -27, -4, 6, 2.6); P('building_watermill_blue', 27, 18, 6.5, 3); P('building_home_A_red', 26, -6, 6, 2.6);
  P('building_well_blue', 5.5, 10.5, 4.2, 1.3);
  // props: market stall clutter, tavern barrels, banners
  const props: [string, number, number, number, number?][] = [['barrel', -10.5, -8.5, 2.6], ['barrel', -11.6, -7.9, 2.6], ['crate_A_big', -17.5, -8, 2.6], ['crate_B_small', -16.6, -7, 2.4], ['sack', -12.4, -8.8, 2.6],
    ['barrel', 3.6, 14.2, 2.6], ['barrel', -3.6, 14.4, 2.6], ['crate_A_big', -4.6, 13.4, 2.4], ['wheelbarrow', 14.8, 9.4, 2.6, 0.6], ['resource_lumber', 20.5, 3.4, 2.6, 1.2], ['weaponrack', 15.5, 5.6, 2.6, -1.2],
    ['tent', 12.5, -4.5, 3.4, -1.7], ['bucket_water', 7.2, 9.4, 2.6], ['crate_B_small', 13.5, -7, 2.4], ['sack', 11.6, -6.6, 2.6]];
  for (const [n, x, z, s, ry] of props) P(n, x, z, s, n === 'tent' ? 1.4 : 0.6, ry ?? Math.random() * 6.28);
  for (const [n, x, z] of [['flag_red', -4, -17.5], ['flag_blue', 4, -17.5], ['flag_red', -17.5, -3], ['flag_blue', 17.5, 1.5]] as const) { const f = P(n, x, z, 3.4, 0.3, 0); if (f) flags.push(f); }
  // fountain (centre piece) — stone basin, water, spout
  const stone = new THREE.MeshStandardMaterial({ color: 0xa9a291, roughness: 0.8 }), water = new THREE.MeshStandardMaterial({ color: 0x3f9ac0, roughness: 0.1, metalness: 0.1, emissive: 0x0a3a50, emissiveIntensity: 0.4 });
  const fnt = new THREE.Group(); fnt.position.set(0, 0, 3);
  const m = (g: THREE.BufferGeometry, mt: THREE.Material, y: number) => { const o = new THREE.Mesh(g, mt); o.position.y = y; o.castShadow = !low; o.receiveShadow = true; fnt.add(o); return o; };
  m(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 24), stone, 0.35); m(new THREE.CylinderGeometry(2.25, 2.25, 0.1, 24), water, 0.62); m(new THREE.CylinderGeometry(0.35, 0.55, 1.9, 10), stone, 1.25);
  m(new THREE.CylinderGeometry(1.1, 0.8, 0.35, 16), stone, 2.2); m(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 16), water, 2.36);
  add(fnt); addCol(0, 3, 2.8);
  // lamp posts with warm glow
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.9 }), glow = new THREE.MeshBasicMaterial({ color: 0xffc870, toneMapped: false });
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2, x = Math.cos(a) * 17.5, z = Math.sin(a) * 17.5;
    if (Math.abs(x) < 5 && z < 0 || Math.abs(z + 2) < 5 && Math.abs(x) > 12) continue;
    const g = new THREE.Group(); g.position.set(x, 0, z); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 3, 6), wood); post.position.y = 1.5; post.castShadow = !low; g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), wood); arm.position.set(0.3, 2.9, 0); g.add(arm);
    const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), glow); bulb.position.set(0.6, 2.62, 0); g.add(bulb); g.rotation.y = -a; add(g); addCol(x, z, 0.25); }
}
export function updateTown(t: number) {
  if (spinner) spinner.rotation.z = t * 0.7;
  flags.forEach((f, i) => { f.rotation.y = Math.sin(t * 1.3 + i) * 0.12; });
}
