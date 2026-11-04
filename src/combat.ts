// Damage, XP / level-ups / evolution, player moves, projectiles, swapping.
import * as THREE from 'three';
import { t } from './i18n';
import { BOSS_BARS, Move } from './data';
import { save, persist, addMon, markSeen, MonSave } from './save';
import { scene } from './scene';
import { heightAt } from './world';
import { ZONES } from './zones';
import { mon, nameOf, movesOf, LEARN, xpFor, eff, evosOf, hex, TYPE_COLOR, STONES } from './dex';
import { sfx } from './audio';
import { burst, trail, groundRing, slash, flashRing, dmgNum, dotTex } from './fx';
import { G, V, L, player, Unit, Proj, Member, stats, maxHp, moveName, hitstopFor, prompt, banner, toast, setPlayerSpecies, syncTeam } from './state';
import { removeUnit, cancelTele, markRespawn, spawnZoneOf } from './spawns';
import { questEvent, checkPassiveQuests, stoneName } from './npcs';
import { buildTeamHud, refreshMoveHud } from './hud';
import { fanfare } from './ui';
import { levelFx, hitFx, castFx } from './vfx';

const gy = (p: THREE.Vector3, up = 1) => p.clone().setY(heightAt(p.x, p.z) + up);
export const unlocked = (m: Member, i: number) => m.ms.lv >= LEARN[i];

export function damageEnemy(u: Unit, dmg: number, posture: number, from: THREE.Vector3, o: { crit?: boolean; burn?: boolean; kb?: number; type?: string; ult?: boolean } = {}) {
  if (u.hp <= 0 || u.caught) return; if (u.inv > 0) { dmgNum(u.pos, '—'); return; }
  const ms = G.team[G.active].ms, st = stats(ms);
  const crit = o.crit || Math.random() < st.crit; const e = o.type ? eff(o.type, u.types) : 1; const stab = o.type && mon(ms.id).t.includes(o.type) ? 1.2 : 1;
  let d = dmg * st.pow * stab * Math.max(0.25, e) * (crit ? 1.6 : 1) * (o.ult ? 1 + 0.25 * st.ult : 1) * (st.exec && u.hp / u.max < 0.3 ? 1.4 : 1) * (u.stagger > 0 ? 1.5 : 1) * (0.9 + Math.random() * 0.2);
  d = Math.max(1, Math.round(d));
  u.hp -= d; u.lastHit = 0; u.bb.flash = 0.08; u.bb.play('Hurt', true, true); u.aggro = true;
  if (u.sp >= 0) for (const x of G.enemies) if (x.sp === u.sp) x.aggro = true;
  if (u.stagger <= 0) { u.posture += posture * st.pos; if (u.posture >= u.maxPosture) { u.stagger = u.boss ? 3 : 2.5; u.posture = 0; prompt(t('stagger')); sfx.break(); hitstopFor(0.12); G.shake = Math.max(G.shake, 0.5); burst(gy(u.pos), 0xffd23f, 40, 9, 4, 0.8); cancelTele(u); u.state = 'chase'; } }
  if (o.burn) u.burn = 3;
  u.kb.addScaledVector(u.pos.clone().sub(from).setY(0).normalize(), (o.kb ?? 5) * (u.boss || u.alpha ? 0.3 : 1));
  dmgNum(u.pos, String(d) + (e >= 2 ? '!' : ''), crit || u.stagger > 0 || e >= 2 ? 'crit' : e < 1 ? 'weak' : ''); hitFx(u.pos, o.type, (crit ? 1.7 : 1) * (o.ult ? 1.5 : 1) * (e >= 2 ? 1.3 : 1));
  if (st.ls > 0) healActive(d * st.ls);
  if (u.boss) checkBossPhase(u);
  if (u.hp <= 0) killEnemy(u);
}
export function healActive(n: number) { const m = G.team[G.active]; m.hp = Math.min(maxHp(m), m.hp + n); }
function checkBossPhase(u: Unit) {
  const bar = Math.floor((u.max - u.hp) / u.def.hp);
  if (bar > u.bar && u.hp > 0) {
    u.bar = bar; u.inv = 1.6; u.hp = u.max - bar * u.def.hp; cancelTele(u); u.state = 'chase'; u.st = 0; u.cd = 1.6; u.stagger = 0;
    banner(t('phase', { n: bar + 1 }), hex(BOSS_BARS[bar]), 1.8); sfx.boss(); G.shake = 0.9; hitstopFor(0.25);
    burst(gy(u.pos, 1.5), BOSS_BARS[bar], 45, 14, 5, 0.9); addShock(u.pos, 22, 14, 0); player.pos.addScaledVector(player.pos.clone().sub(u.pos).setY(0).normalize(), 3);
  }
}
export function killEnemy(u: Unit) {
  burst(gy(u.pos, 0.8), u.def.color, 40, 8, 4, 0.9); sfx.heavy(); G.shake = Math.max(G.shake, 0.3); hitstopFor(0.06);
  removeUnit(u);
  G.team.forEach((m, i) => { if (m.hp > 0 || i === G.active) gainXp(i, u.def.xp * (i === G.active ? 1 : 0.5)); });
  questEvent('defeat', ZONES[G.curZone].id); questEvent('defeatType', undefined, u.types);
  if (u.alpha) questEvent('alpha', spawnZoneOf(u));
  markRespawn(u, u.alpha ? 180 : 25 + Math.random() * 20);
  if (Math.random() < (u.alpha ? 0.5 : 0.012)) { const s = STONES[Math.floor(Math.random() * STONES.length)]; save.stones[s] = (save.stones[s] || 0) + 1; toast('💎 ' + stoneName(s)); }
  if (u.boss) {
    save.mewtwo = true; questEvent('boss');
    if (!save.caught.includes(150)) { addMon(150, 45); if (save.party.length !== G.team.length) syncTeam(); toast('★ Mewtwo ' + L('joined you!', '¡se une a ti!')); }
    banner(t('victory'), '#ffe35a', 3);
  }
  persist();
}
export function gainXp(i: number, xp: number) {
  const m = G.team[i]; if (!m) return; const ms = m.ms; ms.xp += Math.round(xp * stats(ms).xp); let up = false;
  while (ms.xp >= xpFor(ms.lv) && ms.lv < 60) {
    ms.xp -= xpFor(ms.lv); ms.lv++; up = true; m.hp = Math.min(maxHp(m), m.hp + 15);
    LEARN.forEach((l, k) => { if (l === ms.lv) toast(`✦ ${nameOf(ms.id)}: ${moveName(movesOf(ms.id)[k])}`); });
    const ev = evosOf(ms.id).find((e) => e.evo && !e.evo.stone && ms.lv >= e.evo.lv); if (ev && !G.evoQueue.includes(m)) G.evoQueue.push(m);
  }
  if (up) { sfx.level(); if (i === G.active) { fanfare(L('Level Up', 'Subes de nivel'), `${nameOf(ms.id)} · ${t('level')} ${ms.lv} · +1 ${L('skill point', 'punto de habilidad')}`); levelFx(player.pos); flashRing(player.pos, 2.2, 0xffe35a); } else toast(`▲ ${nameOf(ms.id)} ${t('level')} ${ms.lv}`); buildTeamHud(); }
}
export function evolveMember(ms: MonSave, to: number) {
  const m = G.team.find((x) => x.ms === ms);
  if (m && G.team[G.active] === m && G.mode === 'play') { player.evoT = 2.2; player.evoTo = to; player.evoM = m; return; }
  doEvolve(ms, to);
}
export function doEvolve(ms: MonSave, to: number) {
  const old = nameOf(ms.id); ms.id = to; if (!save.caught.includes(to)) save.caught.push(to); markSeen(to); persist();
  fanfare(L('Evolution', 'Evolución'), `${old} → ${nameOf(to)}`, '#9fe8ff'); sfx.level();
  const m = G.team.find((x) => x.ms === ms);
  if (m) { m.hp = maxHp(m); if (G.team[G.active] === m) { setPlayerSpecies(); burst(gy(player.pos), 0xffffff, 80, 10, 6, 1.2); flashRing(player.pos, 3.5, 0xffffff); } }
  buildTeamHud(); checkPassiveQuests();
}
let onBlackout: () => void = () => {};
export const setBlackout = (f: () => void) => { onBlackout = f; };
export function hurtPlayer(dmg: number, from: THREE.Vector3, src: Unit | null, proj?: Proj): boolean {
  if (player.evoT > 0) return false;
  if (player.iframes > 0) { if (player.dashT > 0) dmgNum(player.pos, 'MISS'); return false; }
  const m = G.team[G.active], st = stats(m.ms);
  if (player.parryT > 0) {
    player.parryT = 0; player.parryCd = 0; player.counterT = 1.6; sfx.parry(); hitstopFor(0.14); G.shake = Math.max(G.shake, 0.35);
    burst(gy(player.pos).lerp(from, 0.4), 0xffe35a, 36, 9, 3, 0.6); flashRing(player.pos, 2.4, 0xffe35a); prompt(t('parry'), 1.0);
    if (st.parry) healActive(maxHp(m) * st.parry);
    if (src) { src.posture += src.maxPosture * 0.45; src.st = 0; src.state = 'recover'; src.cd = 1.2; src.bb.play('Hurt', true, true); if (src.posture >= src.maxPosture) damageEnemy(src, 1, 0, player.pos); }
    if (proj) { proj.mine = true; proj.vel.multiplyScalar(-1.3); proj.dmg = 20; proj.life = 2; }
    return false;
  }
  dmg *= st.arm; m.hp -= dmg; player.bb.flash = 0.1; player.bb.play('Hurt', true, true); sfx.hurt(); G.shake = Math.max(G.shake, 0.35); hitstopFor(0.05);
  dmgNum(player.pos, String(Math.round(dmg)), 'p'); player.iframes = 0.35; player.pos.addScaledVector(player.pos.clone().sub(from).setY(0).normalize(), 0.8);
  if (m.hp <= 0 && st.endure && !m.endured) { m.hp = 1; m.endured = true; prompt(L('ENDURED!', '¡AGUANTÓ!'), 1.2); return true; }
  if (m.hp <= 0) { m.hp = 0; banner(nameOf(m.ms.id) + ' ' + t('fainted'), '#ff5a6a'); const n = G.team.findIndex((x) => x.hp > 0); if (n < 0) setTimeout(onBlackout, 900); else swapTo(n, true); }
  return true;
}
export function nearestEnemy(p: THREE.Vector3, maxD = 99, onlyAggro = false) {
  let best: Unit | null = null, bd = maxD;
  for (const e of G.enemies) { if (e.caught || (onlyAggro && !e.aggro && e.pos.distanceTo(p) > 8)) continue; const d = e.pos.distanceTo(p); if (d < bd) { bd = d; best = e; } }
  return best;
}
export function useMove(i: number, explicit: boolean) {
  const m = G.team[G.active]; if (!m || m.hp <= 0 || m.cds[i] > 0 || player.dashT > 0 || player.evoT > 0) return;
  if (!unlocked(m, i)) { if (explicit) prompt(`🔒 ${t('level')} ${LEARN[i]}`, 0.8); return; }
  const mv = movesOf(m.ms.id)[i]; const st = stats(m.ms);
  m.cds[i] = mv.cd * st.cd * (i === 3 ? 1 - 0.15 * st.ult : 1); const f = player.face.clone();
  player.bb.play('Attack', true, true);
  const counter = i === 0 && player.counterT > 0;
  if (mv.kind === 'melee') {
    sfx.swing(); player.pos.addScaledVector(f, 0.35);
    slash(player.pos.clone().setY(heightAt(player.pos.x, player.pos.z)).addScaledVector(f, 0.6), -Math.atan2(f.z, f.x), mv.range * (counter ? 1.5 : 1), counter ? 0xffe35a : mv.color);
    for (const e of [...G.enemies]) {
      const d = e.pos.clone().sub(player.pos).setY(0);
      if (d.length() < mv.range + 0.5 * e.def.scale * (counter ? 1.5 : 1) && d.normalize().dot(f) > 0.25) { damageEnemy(e, mv.dmg * (counter ? 3.2 : 1), mv.posture * (counter ? 4 : 1), player.pos, { type: mv.type, ult: i === 3, crit: counter, burn: mv.burn }); sfx.hit(); hitstopFor(counter ? 0.16 : 0.035); }
    }
    if (counter) { player.counterT = 0; prompt(t('counter') + '!'); }
  } else if (mv.kind === 'proj') { sfx.shoot(); fireProj(player.pos.clone().addScaledVector(f, 0.8), f, mv.speed!, mv.radius!, mv.dmg * (counter ? 2.5 : 1), mv.posture, true, mv.color, mv.burn, i === 1 || i === 3, mv.type, i === 3); if (counter) player.counterT = 0; }
  else if (mv.kind === 'dash') { sfx.dash(); player.dashT = mv.range / 30; player.dashDir.copy(f); player.iframes = player.dashT + 0.1; player.dashMove = mv; player.dashHit.clear(); }
  else if (mv.kind === 'aoe') { if (mv.count) { player.ccT = 0; player.ccN = mv.count; player.ccMove = mv; } else aoeHit(mv, i === 3); }
  else if (mv.kind === 'cone') { player.cone = mv.count!; player.coneMove = mv; player.coneT = 0; }
}
export function aoeHit(mv: Move, ult = false) {
  sfx.heavy(); flashRing(player.pos, mv.range, mv.color, 0.4); castFx(player.pos, mv.type, mv.range, ult); G.shake = Math.max(G.shake, 0.3);
  for (const e of [...G.enemies]) if (e.pos.distanceTo(player.pos) < mv.range + 0.5 * e.def.scale) damageEnemy(e, mv.dmg, mv.posture, player.pos, { burn: mv.burn, kb: 8, type: mv.type, ult });
}
const mats = new Map<number, THREE.SpriteMaterial>();
export function fireProj(p: THREE.Vector3, dir: THREE.Vector3, spd: number, r: number, dmg: number, posture: number, mine: boolean, color: number, burn = false, homing = false, type?: string, ult = false) {
  let mat = mats.get(color); if (!mat) { mat = new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(color).multiplyScalar(2.2), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); mats.set(color, mat); }
  const s = new THREE.Sprite(mat); s.scale.setScalar(r * 2.6); scene.add(s); p.y = 1;
  G.projs.push({ mesh: s, pos: p.clone(), vel: dir.clone().setY(0).normalize().multiplyScalar(spd), r, dmg, posture, mine, life: 2.2, color, burn: !!burn, homing, type, ult });
}
export function addShock(p: THREE.Vector3, max: number, spd: number, dmg: number) {
  const m = groundRing(0.85, 1, dmg ? 0xff3fd2 : 0xffffff, 0.9, 96); m.position.set(p.x, heightAt(p.x, p.z) + 0.06, p.z); G.shock.push({ mesh: m, r: 0.5, spd, max, dmg, hit: false });
}
export function swapTo(i: number, forced = false) {
  if (G.mode !== 'play' || i === G.active || !G.team[i] || G.team[i].hp <= 0 || player.evoT > 0 || (!forced && player.swapCd > 0)) return;
  G.active = i; player.swapCd = 0.8; const c = TYPE_COLOR[mon(G.team[i].ms.id).t[0]];
  setPlayerSpecies(); sfx.swap(); burst(gy(player.pos), c, 40, 8, 4, 0.6); flashRing(player.pos, 2.5, c); refreshMoveHud();
  for (const e of G.enemies) if (e.pos.distanceTo(player.pos) < 3) damageEnemy(e, 8, 15, player.pos, { kb: 7 });
}
export const trailAt = (p: THREE.Vector3, c: number) => trail(p, c);
export { V };
