import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { save } from './save';

export const ARENA_R = 21;
export const canvas = document.getElementById('gl') as HTMLCanvasElement;
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07051a); scene.fog = new THREE.FogExp2(0x07051a, 0.022);
export const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

function gridTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#3a2a9a'; g.lineWidth = 3; for (let i = 0; i <= 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
  g.strokeStyle = '#1b1450'; g.lineWidth = 1; for (let i = 32; i < 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// floor: glossy dark stone + emissive grid
const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R + 3, 96),
  new THREE.MeshStandardMaterial({ color: 0x120d2c, metalness: 0.75, roughness: 0.28, emissive: 0xffffff, emissiveMap: gridTex(), emissiveIntensity: 0.55 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
// center sigil
const sig = new THREE.Mesh(new THREE.RingGeometry(4.6, 5, 64), new THREE.MeshBasicMaterial({ color: 0x8f6bff, transparent: true, opacity: 0.7 }));
sig.rotation.x = -Math.PI / 2; sig.position.y = 0.01; scene.add(sig);
const sig2 = new THREE.Mesh(new THREE.RingGeometry(8.8, 9, 6), new THREE.MeshBasicMaterial({ color: 0x4fe3ff, transparent: true, opacity: 0.5 }));
sig2.rotation.x = -Math.PI / 2; sig2.position.y = 0.01; scene.add(sig2);
// neon boundary ring
const ring = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R + 0.6, 0.12, 8, 160), new THREE.MeshBasicMaterial({ color: 0x4fe3ff }));
ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; scene.add(ring);
const ring2 = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R + 1.4, 0.08, 8, 160), new THREE.MeshBasicMaterial({ color: 0xff4fd8 }));
ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.6; scene.add(ring2);
// pillars with neon strips
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1a1440, metalness: 0.4, roughness: 0.5 });
const pillars: THREE.Object3D[] = [];
for (let i = 0; i < 10; i++) {
  const a = (i / 10) * Math.PI * 2, r = ARENA_R + 3.5, h = 5 + (i % 2) * 3;
  const p = new THREE.Group(); p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.4), pillarMat); body.position.y = h / 2; body.castShadow = true; p.add(body);
  const col = i % 2 ? 0xff4fd8 : 0x4fe3ff;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.12, 1.46), new THREE.MeshBasicMaterial({ color: col }));
  strip.position.y = h - 0.4; p.add(strip); const s2 = strip.clone(); s2.position.y = 0.6; p.add(s2);
  const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), new THREE.MeshBasicMaterial({ color: col })); cap.position.y = h + 1; p.add(cap);
  scene.add(p); pillars.push(cap);
}
// floating crystals far
for (let i = 0; i < 26; i++) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.3 + Math.random() * 0.6), new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x8f6bff : 0x4fe3ff, transparent: true, opacity: 0.8 }));
  const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 25; m.position.set(Math.cos(a) * r, 4 + Math.random() * 14, Math.sin(a) * r); scene.add(m); pillars.push(m);
}
scene.add(new THREE.HemisphereLight(0x8a7bff, 0x0a0820, 0.7));
const sun = new THREE.DirectionalLight(0xc0b8ff, 1.3); sun.position.set(-12, 24, 10); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30 }); scene.add(sun);
const l1 = new THREE.PointLight(0x4fe3ff, 60, 40); l1.position.set(-10, 5, -8); scene.add(l1);
const l2 = new THREE.PointLight(0xff4fd8, 60, 40); l2.position.set(10, 5, 8); scene.add(l2);
export const playerLight = new THREE.PointLight(0x6fc3ff, 18, 9); playerLight.position.y = 1.5; scene.add(playerLight);

let composer: EffectComposer | null = null, bloom: UnrealBloomPass;
export function setupQuality() {
  const high = save.quality === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.75 : 1));
  renderer.shadowMap.enabled = high;
  if (high && !composer) {
    composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.45, 0.86); composer.addPass(bloom); composer.addPass(new OutputPass());
  }
  if (!high) composer = null;
  resize();
}
export function resize() {
  const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
}
window.addEventListener('resize', resize);
export function render(time: number) {
  sig.rotation.z = time * 0.2; sig2.rotation.z = -time * 0.1;
  for (let i = 0; i < pillars.length; i++) { pillars[i].rotation.y = time + i; }
  (ring.material as THREE.MeshBasicMaterial).color.setHSL(0.52 + Math.sin(time) * 0.03, 1, 0.6);
  composer ? composer.render() : renderer.render(scene, camera);
}
