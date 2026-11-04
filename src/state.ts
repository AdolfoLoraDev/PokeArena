// Shared game state + small helpers used by every gameplay module.
import * as THREE from 'three';
import { getLang } from './i18n';
import { Move, EnemyDef } from './data';
import { MonSave, save, monByUid } from './save';
import { scene } from './scene';
import { hpOf, powOf, defOf, dexStr, scaleOf } from './dex';
import { rk } from './skills';
import { Billboard } from './sprites';

export const $ = (s: string) => document.querySelector(s) as HTMLElement;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const L = (en: string, es: string) => (getLang() === 'es' ? es : en);
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export interface Member { ms: MonSave; hp: number; cds: number[]; endured: boolean; }
export interface Unit {
  bb: Billboard; pos: THREE.Vector3; kb: THREE.Vector3; hp: number; max: number; posture: number; maxPosture: number; stagger: number; lastHit: number;
  def: EnemyDef; id: number; lv: number; types: string[]; state: string; st: number; cd: number; tele: THREE.Mesh | null; burn: number;
  boss: boolean; alpha: boolean; bar: number; inv: number; pat: number; hb: THREE.Sprite;
  sp: number; aggro: boolean; home: THREE.Vector3; prev: THREE.Vector3; wander: THREE.Vector3; wt: number; caught?: boolean;
}
export interface Proj { mesh: THREE.Sprite; pos: THREE.Vector3; vel: THREE.Vector3; r: number; dmg: number; posture: number; mine: boolean; life: number; color: number; burn: boolean; homing?: boolean; type?: string; ult?: boolean; }
export interface Wave { mesh: THREE.Mesh; r: number; spd: number; max: number; dmg: number; hit: boolean; }
export type Mode = 'menu' | 'play' | 'pause' | 'modal';

export const player = {
  bb: new Billboard(1), pos: V(0, 0, 6), face: V(0, 0, -1), dashT: 0, dashDir: V(), iframes: 0, dashCd: 0, parryT: 0, parryCd: 0, counterT: 0, swapCd: 0,
  evoT: 0, evoTo: 0, evoM: null as Member | null, dashMove: null as Move | null, dashHit: new Set<Unit>(),
  cone: 0, coneMove: null as Move | null, coneT: 0, ccT: 0, ccN: 0, ccMove: null as Move | null, aimT: 0,
};
scene.add(player.bb.group);

export const G = {
  mode: 'menu' as Mode, team: [] as Member[], active: 0, enemies: [] as Unit[], projs: [] as Proj[], shock: [] as Wave[],
  runTime: 0, hitstop: 0, shake: 0, lockT: null as Unit | null, curZone: 0, camTarget: V(), evoQueue: [] as Member[],
};
export const hpCache = new Map<number, number>();

export function stats(ms: MonSave) {
  return {
    pow: powOf(ms.id, ms.lv) * (1 + 0.08 * rk(ms, 'pow')), crit: 0.05 + 0.07 * rk(ms, 'crit'), pos: 1 + 0.2 * rk(ms, 'brk'), ult: rk(ms, 'ult'), exec: rk(ms, 'exec'),
    hpMul: 1 + 0.1 * rk(ms, 'hp'), arm: (1 - 0.06 * rk(ms, 'arm')) * (1 - Math.min(0.35, defOf(ms.id) / 400)), parry: 0.08 * rk(ms, 'parry'),
    dashCd: 1 - 0.2 * rk(ms, 'dash'), endure: rk(ms, 'endure'), spd: 1 + 0.06 * rk(ms, 'spd'), cd: 1 - 0.06 * rk(ms, 'cd'),
    ls: 0.03 * rk(ms, 'ls'), catch: 1 + 0.15 * rk(ms, 'catch'), xp: 1 + 0.15 * rk(ms, 'xp'),
  };
}
export const maxHpOf = (ms: MonSave) => Math.round(hpOf(ms.id, ms.lv) * stats(ms).hpMul);
export const maxHp = (m: Member) => maxHpOf(m.ms);
export const moveName = (mv: Move) => (getLang() === 'es' ? mv.es : mv.en);
export const hitstopFor = (s: number) => { G.hitstop = Math.max(G.hitstop, s); };
export const gateOpen = () => !!save.quests.q11?.done;

export function setPlayerSpecies() { const m = G.team[G.active]; if (m) player.bb.setSpecies(dexStr(m.ms.id), scaleOf(m.ms.id)); }
let onTeamChange: () => void = () => {};
export const setTeamChangeHook = (f: () => void) => { onTeamChange = f; };
export function syncTeam() {
  for (const m of G.team) hpCache.set(m.ms.uid, m.hp);
  const prev = G.team[G.active]?.ms.uid;
  G.team = save.party.map((uid) => { const ms = monByUid(uid); return { ms, hp: Math.min(maxHpOf(ms), hpCache.get(uid) ?? maxHpOf(ms)), cds: [0, 0, 0, 0], endured: false }; });
  G.active = Math.max(0, G.team.findIndex((m) => m.ms.uid === prev));
  if (G.team[G.active] && G.team[G.active].hp <= 0) { const n = G.team.findIndex((m) => m.hp > 0); if (n >= 0) G.active = n; }
  setPlayerSpecies(); if (G.mode !== 'menu') onTeamChange();
}

// transient UI text
let bannerTimer = 0, promptTimer = 0;
export function banner(txt: string, color = '#fff', dur = 1.6) { const b = $('#banner'); b.textContent = txt; b.style.color = color; b.classList.add('show'); bannerTimer = dur; }
export function prompt(txt: string, dur = 1.4) { $('#prompt').textContent = txt; promptTimer = dur; }
export function toast(txt: string) {
  const box = $('#toasts'); const el = document.createElement('div'); el.className = 'toast'; el.textContent = txt; box.appendChild(el);
  setTimeout(() => el.remove(), 2600); while (box.children.length > 3) box.firstChild!.remove();
}
export function tickText(dt: number) {
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) $('#banner').classList.remove('show'); }
  if (promptTimer > 0) { promptTimer -= dt; if (promptTimer <= 0) $('#prompt').textContent = ''; }
}

// modal dialog
export function modal(title: string, html: string, btns: [string, () => void][], onBtn?: () => void) {
  $('#modal').classList.remove('hidden'); $('#mtitle').textContent = title; $('#mbody').innerHTML = html;
  if (btns.length) {
    const d = document.createElement('div'); d.className = 'mbtns';
    btns.forEach(([l, f]) => { const b = document.createElement('button'); b.textContent = l; b.onclick = () => { onBtn?.(); f(); }; d.appendChild(b); });
    $('#mbody').appendChild(d);
  }
}
export function closeModal(keepMode = false) { $('#modal').classList.add('hidden'); if (!keepMode && G.mode === 'modal') G.mode = 'play'; }

// canvas sprite for name plates
export function plate(w = 128, h = 30, sx = 2.6) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, toneMapped: false })); s.scale.set(sx, (sx * h) / w, 1); s.renderOrder = 5;
  (s as any).ctx = c.getContext('2d'); return s;
}
