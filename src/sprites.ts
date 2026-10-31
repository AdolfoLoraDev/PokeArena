import * as THREE from 'three';
export interface AnimInfo { frameWidth: number; frameHeight: number; durations: number[]; tex: THREE.Texture; rows: number; foot: number; }
export type AnimName = 'Idle' | 'Walk' | 'Attack' | 'Hurt';
const cache = new Map<string, Promise<Record<string, AnimInfo>>>();
const loader = new THREE.TextureLoader();
const BASE = import.meta.env.BASE_URL + 'pmd/';
function footOf(img: HTMLImageElement, fw: number, fh: number) {
  const c = document.createElement('canvas'); c.width = fw; c.height = fh; const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, fw, fh, 0, 0, fw, fh); const d = g.getImageData(0, 0, fw, fh).data;
  for (let y = fh - 1; y >= 0; y--) for (let x = 0; x < fw; x++) if (d[(y * fw + x) * 4 + 3] > 20) return fh - 1 - y;
  return 0;
}
export function loadSpecies(dex: string) {
  if (!cache.has(dex)) cache.set(dex, (async () => {
    const meta = await (await fetch(BASE + dex + '/anims.json')).json();
    const out: Record<string, AnimInfo> = {};
    await Promise.all((['Idle', 'Walk', 'Attack', 'Hurt'] as AnimName[]).map(async (n) => {
      const m = meta[n]; const tex = await loader.loadAsync(BASE + dex + '/' + m.file);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false;
      const img = tex.image as HTMLImageElement; const rows = Math.round(img.height / m.frameHeight);
      out[n] = { frameWidth: m.frameWidth, frameHeight: m.frameHeight, durations: m.durations, tex, rows, foot: footOf(img, m.frameWidth, m.frameHeight) };
    }));
    return out;
  })());
  return cache.get(dex)!;
}
export const portrait = (dex: string) => BASE + dex + '/portrait.png';
const PX = 1 / 16; // world units per sprite pixel
export class Billboard {
  group = new THREE.Group(); mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; anims: Record<string, AnimInfo> | null = null;
  anim: AnimName = 'Idle'; frame = 0; tick = 0; dir = 0; scale = 1; once = false; shadow: THREE.Mesh; tex: THREE.Texture | null = null;
  flash = 0; footW = 0; private static up = new THREE.Vector3();
  constructor(scale = 1) {
    this.scale = scale;
    this.mat = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, alphaTest: 0.3, depthWrite: true, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), this.mat); this.group.add(this.mesh);
    this.mesh.renderOrder = 2;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.45, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.02; this.group.add(this.shadow);
  }
  async setSpecies(dex: string, scale?: number) { if (scale) this.scale = scale; this.anims = await loadSpecies(dex); this.tex = null; this.play('Idle', true); }
  play(a: AnimName, force = false, once = false) {
    if (!this.anims || (!force && a === this.anim)) return;
    if (!force && this.once && a !== 'Hurt' && a !== 'Attack') return;
    this.anim = a; this.frame = 0; this.tick = 0; this.once = once; this.apply();
  }
  private apply() {
    const A = this.anims![this.anim]; if (!this.tex || this.tex.image !== A.tex.image) { this.tex?.dispose(); this.tex = A.tex.clone(); this.tex.needsUpdate = true; this.mat.map = this.tex; this.mat.needsUpdate = true; }
    const cols = A.durations.length; const row = Math.min(this.dir, A.rows - 1);
    this.tex.repeat.set(1 / cols, 1 / A.rows); this.tex.offset.set(this.frame / cols, 1 - (row + 1) / A.rows);
    const s = this.scale * PX * 1.6; this.mesh.scale.set(A.frameWidth * s, A.frameHeight * s, 1);
    this.footW = A.foot * s;
    this.shadow.scale.setScalar(this.scale);
  }
  setFacing(fx: number, fz: number) { if (fx * fx + fz * fz < 1e-4) return; let a = Math.atan2(fx, fz) / (Math.PI / 4); this.dir = ((Math.round(a) % 8) + 8) % 8; }
  update(dt: number, cam: THREE.Camera) {
    if (!this.anims) return; const A = this.anims[this.anim];
    this.tick += dt * 60 * (this.anim === 'Attack' ? 1.6 : 1);
    while (this.tick >= A.durations[this.frame]) { this.tick -= A.durations[this.frame]; this.frame++;
      if (this.frame >= A.durations.length) { if (this.once) { this.once = false; this.anim = 'Idle'; this.frame = 0; this.apply(); return; } this.frame = 0; } }
    this.apply();
    this.mesh.quaternion.copy(cam.quaternion); Billboard.up.set(0, 1, 0).applyQuaternion(cam.quaternion); this.mesh.position.copy(Billboard.up).multiplyScalar(-this.footW);
    if (this.flash > 0) { this.flash -= dt; this.mat.color.setRGB(4, 4, 4); } else this.mat.color.setRGB(0.82, 0.82, 0.86);
  }
}
