// Wild Pokémon: spawn points per zone, alphas, Mewtwo, unit AI and name plates.
import * as THREE from 'three';
import { t } from './i18n';
import { EnemyDef } from './data';
import { save, markSeen } from './save';
import { scene, camera } from './scene';
import { heightAt, collide, walkable, zoneAt, BX0, BX1, BZ0, BZ1 } from './world';
import { ZONES, ARENA } from './zones';
import { mon, nameOf, dexStr, scaleOf, wildHp, wildDmg, wildXp, isRanged, TYPE_COLOR, spdOf } from './dex';
import { sfx } from './audio';
import { burst, trail, groundRing, dmgNum } from './fx';
import { Billboard, loadSpecies } from './sprites';
import { G, V, player, Unit, plate, banner, gateOpen } from './state';
import { hurtPlayer, fireProj, killEnemy } from './combat';
import { bossAI } from './boss';

interface SP { pos: THREE.Vector3; zi: number; alpha: boolean; t: number; unit: Unit | null; }
export const spawnPts: SP[] = [];
export function buildSpawnPoints() {
  spawnPts.length = 0;
  ZONES.forEach((z, zi) => {
    if (!z.spawns.length) return; let n = 0, tries = 0; const want = 34;
    while (n < want && tries++ < 4000) {
      const x = BX0 + Math.random() * (BX1 - BX0), zz = BZ0 + Math.random() * (BZ1 - BZ0);
      if (zoneAt(x, zz) !== zi || !walkable(x, zz, 1.2) || Math.hypot(x, zz) < 26 || Math.hypot(x - ARENA[0], zz - ARENA[1]) < 26) continue;
      spawnPts.push({ pos: V(x, 0, zz), zi, alpha: false, t: 0, unit: null }); n++;
    }
    if (z.alpha) spawnPts.push({ pos: V(z.alpha.at[0], 0, z.alpha.at[1]), zi, alpha: true, t: 0, unit: null });
  });
}
export const spawnZoneOf = (u: Unit) => (u.sp >= 0 ? ZONES[spawnPts[u.sp].zi].id : '');
export function markRespawn(u: Unit, s: number) { if (u.sp >= 0) { spawnPts[u.sp].unit = null; spawnPts[u.sp].t = s; } }

export function makeUnit(id: number, lv: number, pos: THREE.Vector3, o: { alpha?: boolean; boss?: boolean; sp?: number } = {}) {
  const sc = scaleOf(id) * (o.alpha ? 1.5 : 1); const bb = new Billboard(sc); bb.setSpecies(dexStr(id), sc);
  const hp = o.boss ? 900 : wildHp(id, lv) * (o.alpha ? 4 : 1);
  const def: EnemyDef = { dex: dexStr(id), name: nameOf(id), hp, speed: Math.min(7, spdOf(id) * 0.7), dmg: wildDmg(id, lv) * (o.alpha ? 1.4 : 1) * (o.boss ? 1.3 : 1), ranged: o.boss || isRanged(id), xp: wildXp(id, lv) * (o.alpha ? 5 : 1) * (o.boss ? 10 : 1), scale: sc, color: TYPE_COLOR[mon(id).t[0]], posture: hp * (o.boss ? 0.4 : 0.8) };
  const max = o.boss ? hp * 3 : hp;
  const u: Unit = { bb, pos: pos.clone(), kb: V(), hp: max, max, posture: 0, maxPosture: def.posture, stagger: 0, lastHit: 99, def, id, lv, types: mon(id).t, state: 'chase', st: 0, cd: 1 + Math.random(), tele: null, burn: 0,
    boss: !!o.boss, alpha: !!o.alpha, bar: 0, inv: o.boss ? 1.5 : 0, pat: 0, hb: plate(160, 40, o.alpha ? 4.2 : 3.4), sp: o.sp ?? -1, aggro: !!o.boss, home: pos.clone(), prev: pos.clone(), wander: pos.clone(), wt: 0 };
  scene.add(bb.group); if (!o.boss) scene.add(u.hb); G.enemies.push(u); markSeen(id); return u;
}
export function removeUnit(u: Unit) { cancelTele(u); scene.remove(u.bb.group); scene.remove(u.hb); const i = G.enemies.indexOf(u); if (i >= 0) G.enemies.splice(i, 1); if (G.lockT === u) G.lockT = null; }
export function clearUnits() { for (const u of [...G.enemies]) removeUnit(u); for (const s of spawnPts) { s.unit = null; s.t = 0; } }

export function updateSpawns(dt: number) {
  for (let i = 0; i < spawnPts.length; i++) {
    const s = spawnPts[i]; const d = s.pos.distanceTo(player.pos);
    if (s.unit) { if (d > 85 && !s.unit.aggro) { removeUnit(s.unit); s.unit = null; } continue; }
    if (s.t > 0) { s.t -= dt; continue; }
    if (d < 16 || d > 50) continue;
    const z = ZONES[s.zi]; let id: number, lv: number;
    if (s.alpha) { id = z.alpha!.id; lv = z.alpha!.lv; } else { id = z.spawns[Math.floor(Math.random() * z.spawns.length)]; if (mon(id).leg && Math.random() > 0.08) id = z.spawns[0]; lv = z.lv[0] + Math.floor(Math.random() * (z.lv[1] - z.lv[0] + 1)); }
    loadSpecies(dexStr(id)); s.unit = makeUnit(id, lv, s.pos, { alpha: s.alpha, sp: i });
  }
  if (gateOpen() && !save.mewtwo && !G.enemies.some((e) => e.boss) && player.pos.distanceTo(V(ARENA[0], 0, ARENA[1])) < 16) {
    banner(t('bossIncoming'), '#c06bff', 2.4); sfx.boss(); G.shake = 0.8; makeUnit(150, 50, V(ARENA[0], 0, ARENA[1] - 4), { boss: true });
  }
}
export function cancelTele(u: Unit) { if (u.tele) { scene.remove(u.tele); u.tele = null; } }
export function teleRing(u: Unit, r: number, at?: THREE.Vector3) { cancelTele(u); u.tele = groundRing(r * 0.9, r, 0xff2a3c, 0.75); const p = at || u.pos; u.tele.position.set(p.x, heightAt(p.x, p.z) + 0.06, p.z); }

function drawPlate(u: Unit) {
  const g = (u.hb as any).ctx as CanvasRenderingContext2D; g.clearRect(0, 0, 160, 40);
  g.font = 'bold 15px system-ui,sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000c';
  const txt = (u.alpha ? '★ ' : '') + `${t('level')}${u.lv} ${u.def.name}`; g.strokeText(txt, 80, 15); g.fillStyle = u.alpha ? '#ffd23f' : u.aggro ? '#ff9a9a' : '#fff'; g.fillText(txt, 80, 15);
  g.fillStyle = '#000a'; g.fillRect(20, 22, 120, 12); g.fillStyle = u.stagger > 0 ? '#ffd23f' : u.hp / u.max < 0.35 ? '#5ae0ff' : '#ff3f5a'; g.fillRect(22, 24, 116 * Math.max(0, u.hp / u.max), 6);
  g.fillStyle = '#ffd23f'; g.fillRect(22, 31, 116 * (u.stagger > 0 ? 1 : u.posture / u.maxPosture), 2); (u.hb.material.map as THREE.Texture).needsUpdate = true;
}
export function updateEnemy(u: Unit, dt: number) {
  u.prev.copy(u.pos); u.lastHit += dt; if (u.inv > 0) u.inv -= dt;
  if (u.burn > 0) { u.burn -= dt; if (Math.random() < dt * 2) { u.hp -= 3; dmgNum(u.pos, '3'); if (u.hp <= 0) { killEnemy(u); return; } } trail(u.pos.clone().setY(1), 0xff6a1a); }
  if (u.lastHit > 1.5 && u.stagger <= 0) u.posture = Math.max(0, u.posture - dt * u.maxPosture * 0.12);
  if (!u.boss && u.aggro && u.lastHit > 12 && u.hp < u.max) u.hp = Math.min(u.max, u.hp + u.max * 0.05 * dt);
  u.pos.addScaledVector(u.kb, dt); u.kb.multiplyScalar(Math.pow(0.002, dt));
  const toP = player.pos.clone().sub(u.pos).setY(0), dist = toP.length(); toP.normalize();
  if (u.stagger > 0) { u.stagger -= dt; if (Math.random() < dt * 8) burst(u.pos.clone().setY(1.6 * u.def.scale), 0xffd23f, 1, 1, 1, 0.4); finish(u, dt); return; }
  if (u.boss) { bossAI(u, dt, toP, dist); finish(u, dt); return; }
  if (!u.aggro && dist < (u.alpha ? 11 : 8.5) && player.evoT <= 0) u.aggro = true;
  if (u.aggro && (u.pos.distanceTo(u.home) > 32 || dist > 30)) { u.aggro = false; u.state = 'chase'; cancelTele(u); }
  if (!u.aggro) { // wander near home
    u.wt -= dt; if (u.wt <= 0) { u.wt = 2 + Math.random() * 4; u.wander.copy(u.home).add(V((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10)); }
    const w = u.wander.clone().sub(u.pos).setY(0); if (w.length() > 0.5) { w.normalize(); u.pos.addScaledVector(w, u.def.speed * 0.35 * dt); u.bb.setFacing(w.x, w.z); u.bb.play('Walk'); } else u.bb.play('Idle');
    finish(u, dt); return;
  }
  u.cd -= dt; const want = u.def.ranged ? 7 : 1.6;
  if (u.state === 'chase') {
    if (dist > want) { u.pos.addScaledVector(toP, u.def.speed * dt); u.bb.play('Walk'); } else if (u.def.ranged && dist < want - 2) { u.pos.addScaledVector(toP, -u.def.speed * 0.6 * dt); u.bb.play('Walk'); } else u.bb.play('Idle');
    u.bb.setFacing(toP.x, toP.z);
    if (u.cd <= 0 && dist < want + 1.5) { u.state = 'wind'; u.st = u.def.ranged ? 0.7 : 0.6; teleRing(u, u.def.ranged ? 0.9 : 1.3 * Math.sqrt(u.def.scale)); }
  } else if (u.state === 'wind') {
    u.st -= dt; u.bb.setFacing(toP.x, toP.z); if (u.tele) { (u.tele.material as THREE.MeshBasicMaterial).color.setHex(u.st < 0.2 ? 0xffffff : 0xff2a3c); u.tele.position.set(u.pos.x, heightAt(u.pos.x, u.pos.z) + 0.06, u.pos.z); }
    if (u.st <= 0) { cancelTele(u); u.bb.play('Attack', true, true);
      if (u.def.ranged) fireProj(u.pos.clone(), toP, 11, 0.4, u.def.dmg, 0, false, u.def.color);
      else { u.pos.addScaledVector(toP, Math.min(1.2, Math.max(0, dist - 1))); if (u.pos.distanceTo(player.pos) < 1.4 + 0.5 * u.def.scale) hurtPlayer(u.def.dmg, u.pos, u); sfx.swing(); }
      u.state = 'recover'; u.st = 0.7; u.cd = 1.5 + Math.random() * 1.2; }
  } else if (u.state === 'recover') { u.st -= dt; if (u.st <= 0) u.state = 'chase'; }
  finish(u, dt);
}
function finish(u: Unit, dt: number) {
  for (const o of G.enemies) if (o !== u) { const d = u.pos.clone().sub(o.pos).setY(0); const l = d.length(), min = 1.1 * (u.def.scale + o.def.scale) / 2; if (l < min && l > 0.001) u.pos.addScaledVector(d.normalize(), (min - l) * 0.5); }
  collide(u.pos, 0.45 * u.def.scale, u.prev);
  if (u.state !== 'tele') u.bb.group.visible = true;
  const y = heightAt(u.pos.x, u.pos.z); u.bb.group.position.set(u.pos.x, y + (u.boss ? 0.4 + Math.sin(G.runTime * 2) * 0.25 : 0), u.pos.z);
  u.bb.update(dt, camera);
  if (!u.boss) { const near = u.pos.distanceTo(player.pos) < 22; u.hb.visible = near; if (near) { u.hb.position.set(u.pos.x, y + 1.7 * u.def.scale + 0.9, u.pos.z); drawPlate(u); } }
}
