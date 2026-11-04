// Splat-mapped terrain material: blends CC0 ambientCG textures (grass / dirt / sand / rock) over the
// hand-painted zone vertex colours. Texture detail is luminance-normalised so each zone keeps its palette.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
function tex(n: string) {
  const t = loader.load(`/tex/${n}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace; return t;
}
let cache: THREE.MeshStandardMaterial | null = null;
export function terrainMaterial() {
  if (cache) return cache;
  const u = { tGrass: { value: tex('grass') }, tDirt: { value: tex('dirt') }, tSand: { value: tex('sand') }, tRock: { value: tex('rock') } };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vTW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = splat; vTW = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tGrass, tDirt, tSand, tRock; varying vec4 vSplat; varying vec3 vTW;
        vec3 lin(vec3 c){ return c * c * (c * 0.3 + 0.7); }
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
        vec3 det(sampler2D s, vec2 uv, vec3 mean, float keep){ vec3 a = lin(texture2D(s, uv).rgb), b = lin(texture2D(s, uv * 0.23 + 0.37).rgb);
          vec3 c = mix(a, b, 0.4); float l = dot(c, vec3(.3,.59,.11)) / dot(mean, vec3(.3,.59,.11)); vec3 hue = c / max(mean, vec3(.01));
          return mix(vec3(l), hue, keep); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec2 uv = vTW.xz * 0.22; float wd = vSplat.x, ws = vSplat.y, wr = vSplat.z;
          float macro = vn(vTW.xz * 0.045) * 0.6 + vn(vTW.xz * 0.17) * 0.4;
          wd = clamp(wd + (macro - 0.5) * 0.5 * step(0.05, wd), 0., 1.);
          float wg = max(0., 1. - wd - ws - wr);
          vec3 g = det(tGrass, uv, vec3(.118,.154,.026), 0.25);
          vec3 d = det(tDirt, uv * 0.8, vec3(.324,.298,.098), 0.45);
          vec3 sd = det(tSand, uv * 0.7, vec3(.337,.261,.157), 0.35);
          vec3 r = det(tRock, vec2(vTW.x + vTW.z, vTW.y * 1.6) * 0.09 + uv * 0.35, vec3(.078,.072,.058), 0.3);
          vec3 dm = (g * wg + d * wd + sd * ws + r * wr) / max(0.001, wg + wd + ws + wr);
          dm = mix(vec3(1.), dm, 0.85) * (0.86 + 0.28 * macro);
          diffuseColor.rgb *= clamp(dm, 0.2, 2.2); }`);
  };
  m.customProgramCacheKey = () => 'terrain-splat';
  cache = m; return m;
}
