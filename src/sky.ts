// Per-zone atmosphere: gradient sky dome with drifting clouds + sun glow, and lerped fog / sun / hemisphere light.
import * as THREE from 'three';
import { scene, camera, sun, arena, renderer } from './scene';

interface Look { top: number; hor: number; fog: number; dens: number; sun: number; si: number; hs: number; hg: number; exp: number; }
const LOOKS: Look[] = [
  { top: 0x4f8fdc, hor: 0xd4e8f0, fog: 0xc6dade, dens: 0.0058, sun: 0xfff0d6, si: 2.5, hs: 0xcfe2ff, hg: 0x55663a, exp: 0.95 },
  { top: 0x3f86e0, hor: 0xeaf0d8, fog: 0xd2e0c4, dens: 0.0055, sun: 0xffe6b8, si: 2.7, hs: 0xd8e8ff, hg: 0x5a6a30, exp: 0.95 },
  { top: 0x2d5a78, hor: 0x9cc0a0, fog: 0x86a890, dens: 0.0125, sun: 0xd8f0b0, si: 1.9, hs: 0xa8d0b0, hg: 0x22381c, exp: 1.0 },
  { top: 0x2a8ae8, hor: 0xdaf4fb, fog: 0xcde9f2, dens: 0.0048, sun: 0xfff8e8, si: 2.8, hs: 0xd8f0ff, hg: 0x6a7a48, exp: 0.95 },
  { top: 0x5a7cab, hor: 0xdfe6f0, fog: 0xc6d0de, dens: 0.0085, sun: 0xeaf2ff, si: 2.3, hs: 0xd0dcf0, hg: 0x4a4a48, exp: 0.95 },
  { top: 0x2a1418, hor: 0xc8704a, fog: 0x7a4a3c, dens: 0.0105, sun: 0xffa060, si: 2.1, hs: 0xffb890, hg: 0x401810, exp: 1.0 },
];
const U = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(-0.5, 0.6, 0.4).normalize() }, uT: { value: 0 } };
export const skyDome = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.); gl_Position = p.xyww; }',
  fragmentShader: `uniform vec3 uTop, uHor, uSun; uniform float uT; varying vec3 vD;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
    float fbm(vec2 p){ float a = 0., w = .5; for (int i = 0; i < 4; i++){ a += w * n(p); p *= 2.03; w *= .5; } return a; }
    void main(){ float y = max(vD.y, 0.); vec3 c = mix(uHor, uTop, pow(y, 0.55));
      float s = max(dot(vD, uSun), 0.); c += vec3(1., .85, .6) * (pow(s, 64.) * 1.2 + pow(s, 6.) * .18);
      vec2 cp = vD.xz / (vD.y + .25) * 1.6 + vec2(uT * .01, uT * .004); float cl = smoothstep(.5, .8, fbm(cp)) * smoothstep(.02, .25, vD.y);
      c = mix(c, mix(uHor, vec3(1.), .75), cl * .8); gl_FragColor = vec4(c, 1.); #include <colorspace_fragment>
    }`.replace('#include <colorspace_fragment>', '\n#include <colorspace_fragment>\n'),
}));
skyDome.frustumCulled = false; skyDome.renderOrder = -1;
const cur = { ...LOOKS[0] }; const cs = { top: new THREE.Color(), hor: new THREE.Color(), fog: new THREE.Color(), sun: new THREE.Color(), hs: new THREE.Color(), hg: new THREE.Color() };
let inited = false; const tc = new THREE.Color();
let hemi: THREE.HemisphereLight | null = null;
export function updateSky(t: number, dt: number, zi: number) {
  const play = !arena.visible; skyDome.visible = play; if (!play) { inited = false; return; }
  skyDome.position.copy(camera.position); U.uT.value = t;
  if (!hemi) hemi = scene.children.find((o) => o instanceof THREE.HemisphereLight) as THREE.HemisphereLight;
  const L = LOOKS[zi] || LOOKS[0], k = inited ? Math.min(1, dt * 1.2) : 1; inited = true;
  for (const key of ['top', 'hor', 'fog', 'sun', 'hs', 'hg'] as const) cs[key].lerp(tc.setHex(L[key]), k);
  cur.dens += (L.dens - cur.dens) * k; cur.si += (L.si - cur.si) * k; cur.exp += (L.exp - cur.exp) * k;
  U.uTop.value.copy(cs.top); U.uHor.value.copy(cs.hor);
  const fog = scene.fog as THREE.FogExp2; fog.color.copy(cs.fog); fog.density = cur.dens; (scene.background as THREE.Color).copy(cs.hor);
  sun.color.copy(cs.sun); sun.intensity = cur.si; renderer.toneMappingExposure = cur.exp * 0.9;
  if (hemi) { hemi.color.copy(cs.hs); hemi.groundColor.copy(cs.hg); hemi.intensity = 1.05; }
}
