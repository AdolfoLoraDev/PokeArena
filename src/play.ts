// Per-frame gameplay update: player control, moves, projectiles, world interaction.
import * as THREE from 'three';
import { save, persist } from './save';
import { scene, camera, followSun, playerLight } from './scene';
import { heightAt, collide, projBlocked, updateWorld, setBeam, reveal, zoneAt, world, setWayActive, setGateOpen } from './world';
import { ZONES } from './zones';
import { spdOf, TYPE_COLOR, evosOf } from './dex';
import { sfx } from './audio';
import { burst, trail, flashRing } from './fx';
import { t } from './i18n';
import { G, V, L, player, isTouch, stats, maxHp, banner, toast, gateOpen, hitstopFor } from './state';
import { keys, pressed, inp, aimVec, mouseGround, moveVec } from './input';
import { useMove, swapTo, nearestEnemy, damageEnemy, hurtPlayer, fireProj, aoeHit, doEvolve } from './combat';
import { updateEnemy, updateSpawns } from './spawns';
import { tryCatch, updateCatch } from './catch';
import { updateNpcs, nearNpc, talk, questEvent, checkPassiveQuests } from './npcs';
import { refreshMoveHud } from './hud';

const prevP = V();
export function updatePlay(dt: number) {
  G.runTime += dt; const m = G.team[G.active]; const st = stats(m.ms);
  for (const mm of G.team) mm.cds = mm.cds.map((c) => Math.max(0, c - dt));
  for (const k of ['dashCd', 'parryCd', 'iframes', 'parryT', 'counterT', 'swapCd', 'aimT'] as const) player[k] -= dt;
  prevP.copy(player.pos);
  if (player.evoT > 0) { evoAnim(dt); return; }
  if (G.evoQueue.length && !G.enemies.some((e) => e.aggro)) { const em = G.evoQueue.shift()!; const ev = evosOf(em.ms.id).find((e) => e.evo && !e.evo.stone && em.ms.lv >= e.evo.lv); const mi = G.team.findIndex((x) => x.ms.uid === em.ms.uid); if (ev && mi >= 0 && G.team[mi].hp > 0) { swapTo(mi, true); player.evoT = 2.2; player.evoM = G.team[mi]; player.evoTo = ev.id; } }
  const mv = moveVec();
  // aim: lock > right stick > mouse > auto-aim
  if (G.lockT && !G.enemies.includes(G.lockT)) G.lockT = null;
  if (G.lockT) player.face.copy(G.lockT.pos).sub(player.pos).setY(0).normalize();
  else if (player.aimT > 0 && aimVec.lengthSq() > 0) player.face.set(aimVec.x, 0, aimVec.y).normalize();
  else if (!isTouch && inp.mouseOnScreen) { const g = mouseGround(); if (g) { const d = g.sub(player.pos).setY(0); if (d.lengthSq() > 0.05) player.face.copy(d.normalize()); } }
  else { const n = nearestEnemy(player.pos, 11, true); if (n) player.face.copy(n.pos).sub(player.pos).setY(0).normalize(); else if (mv.lengthSq() > 0.01) player.face.copy(mv).normalize(); }
  // actions
  if (pressed.has('1')) swapTo(0); if (pressed.has('2')) swapTo(1); if (pressed.has('3')) swapTo(2);
  if (pressed.has('tab')) G.lockT = G.lockT ? null : nearestEnemy(player.pos, 20);
  if ((pressed.has(' ') || pressed.has('shift')) && player.dashCd <= 0 && player.dashT <= 0) { player.dashT = 0.17; player.dashDir.copy(mv.lengthSq() > 0.01 ? mv.clone().normalize() : player.face); player.iframes = 0.32; player.dashCd = 0.55 * st.dashCd; player.dashMove = null; sfx.dash(); }
  if (pressed.has('f') && player.parryCd <= 0) { player.parryT = 0.24; player.parryCd = 0.55; flashRing(player.pos, 1.3, 0xffe35a, 0.24); }
  if (pressed.has('atk') || inp.mouseDown || inp.atkHeld) useMove(0, pressed.has('atk'));
  if (pressed.has('q')) useMove(1, true); if (pressed.has('e')) useMove(2, true); if (pressed.has('r')) useMove(3, true);
  if (pressed.has('c')) tryCatch();
  if (pressed.has('t') || pressed.has('enter')) { const n = nearNpc(); if (n) { talk(n); return; } }
  // move
  if (player.dashT > 0) {
    player.dashT -= dt; const sp = player.dashMove ? 30 : 19; player.pos.addScaledVector(player.dashDir, sp * dt);
    trail(player.pos.clone().setY(heightAt(player.pos.x, player.pos.z) + 0.8), player.dashMove ? player.dashMove.color : 0x8f6bff);
    if (player.dashMove) for (const e of [...G.enemies]) if (!player.dashHit.has(e) && e.pos.distanceTo(player.pos) < 1.6 * e.def.scale) { player.dashHit.add(e); damageEnemy(e, player.dashMove.dmg, player.dashMove.posture, player.pos, { kb: 9, type: player.dashMove.type }); sfx.hit(); hitstopFor(0.05); }
  } else player.pos.addScaledVector(mv, spdOf(m.ms.id) * st.spd * dt * (keys.has('shift') ? 1.15 : 1));
  collide(player.pos, 0.45, prevP);
  // world
  const zi = zoneAt(player.pos.x, player.pos.z);
  if (zi !== G.curZone) { G.curZone = zi; const z = ZONES[zi]; banner(`${L(z.en, z.es)}`, '#dfffe0', 2); toast(`${t('level')} ${z.lv[0]}–${z.lv[1]}`); }
  updateWorld(G.runTime, dt, player.pos, zi); followSun(player.pos.x, player.pos.z);
  setGateOpen(gateOpen()); setBeam(gateOpen() && !save.mewtwo ? 1 : 0, G.runTime);
  if (Math.floor(G.runTime * 4) !== Math.floor((G.runTime - dt) * 4)) { reveal(player.pos); waystones(); }
  if (player.cone > 0) { player.coneT -= dt; if (player.coneT <= 0) { player.coneT = 0.05; player.cone--; const c = player.coneMove!; const a = Math.atan2(player.face.z, player.face.x) + (Math.random() - 0.5) * 0.5; fireProj(player.pos.clone().addScaledVector(player.face, 0.8), V(Math.cos(a), 0, Math.sin(a)), 16, 0.5, c.dmg, c.posture, true, c.color, !!c.burn, false, c.type); if (player.cone % 3 === 0) sfx.shoot(); } }
  if (player.ccN > 0) { player.ccT -= dt; if (player.ccT <= 0) { player.ccT = 0.12; player.ccN--; const c = player.ccMove!; aoeHit({ ...c, dmg: c.dmg / c.count!, posture: c.posture / c.count! }); hitstopFor(0.04); } }
  // anim
  player.bb.setFacing(player.face.x, player.face.z);
  if (player.bb.anim !== 'Attack' && player.bb.anim !== 'Hurt') player.bb.play(mv.lengthSq() > 0.01 ? 'Walk' : 'Idle');
  placePlayer(dt); player.bb.mesh.visible = !(player.iframes > 0 && player.dashT <= 0 && Math.floor(G.runTime * 20) % 2 === 0);
  updateSpawns(dt); for (const e of [...G.enemies]) updateEnemy(e, dt);
  updateNpcs(dt); updateCatch(dt); updateProjs(dt);
  if (!G.enemies.some((e) => e.aggro) && m.hp > 0) m.hp = Math.min(maxHp(m), m.hp + maxHp(m) * 0.02 * dt);
  G.camTarget.lerp(player.pos.clone().addScaledVector(player.face, 1.2), Math.min(1, dt * 5));
}
function placePlayer(dt: number) {
  player.bb.group.position.set(player.pos.x, heightAt(player.pos.x, player.pos.z), player.pos.z); player.bb.update(dt, camera);
  playerLight.position.set(player.pos.x, player.bb.group.position.y + 1.6, player.pos.z);
}
function evoAnim(dt: number) {
  const k = 1 - player.evoT / 2.2; player.evoT -= dt; player.bb.flash = Math.sin(k * 40) > 0 ? 0.08 : 0;
  if (Math.random() < 0.6) burst(player.pos.clone().setY(heightAt(player.pos.x, player.pos.z) + 1), 0xffffff, 2, 3, 4, 0.6);
  player.bb.group.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.25); placePlayer(dt); updateNpcs(dt);
  if (player.evoT <= 0) { player.bb.group.scale.setScalar(1); if (player.evoM && player.evoTo) doEvolve(player.evoM.ms, player.evoTo); player.evoM = null; refreshMoveHud(); }
}
function waystones() {
  for (const w of world.ways) if (!save.ways.includes(w.id) && w.pos.distanceTo(player.pos) < 4) {
    save.ways.push(w.id); setWayActive(w.id, true); persist(); sfx.level(); flashRing(w.pos, 3, 0x4fe3ff);
    toast('◆ ' + L('Waystone activated — fast travel unlocked', 'Monolito activado: viaje rápido desbloqueado')); questEvent('visit', w.id); checkPassiveQuests();
  }
}
function updateProjs(dt: number) {
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i]; p.life -= dt;
    if (p.homing && p.mine) { const n = nearestEnemy(p.pos, 8); if (n) { const d = n.pos.clone().sub(p.pos).setY(0).normalize().multiplyScalar(p.vel.length()); p.vel.lerp(d, Math.min(1, dt * 4)); } }
    p.pos.addScaledVector(p.vel, dt); const gy = heightAt(p.pos.x, p.pos.z); p.mesh.position.set(p.pos.x, p.pos.y + gy, p.pos.z); if (Math.random() < 0.6) trail(p.mesh.position, p.color);
    let dead = p.life <= 0 || projBlocked(p.pos);
    if (dead && p.life > 0) burst(p.mesh.position.clone(), p.color, 8, 4, 2, 0.3);
    if (!dead && p.mine) { for (const e of [...G.enemies]) if (!e.caught && e.pos.clone().setY(1).distanceTo(p.pos) < p.r + 0.6 * e.def.scale) { damageEnemy(e, p.dmg, p.posture, p.pos, { burn: p.burn, type: p.type, ult: p.ult }); sfx.hit(); burst(p.mesh.position, p.color, 14, 6, 2, 0.4); dead = p.r < 1; if (dead) break; } }
    else if (!dead && !p.mine && p.pos.clone().setY(0).distanceTo(player.pos) < p.r + 0.5) { if (hurtPlayer(p.dmg, p.pos, null, p)) dead = true; }
    if (dead) { scene.remove(p.mesh); G.projs.splice(i, 1); }
  }
  for (let i = G.shock.length - 1; i >= 0; i--) {
    const s = G.shock[i]; s.r += s.spd * dt; s.mesh.scale.setScalar(s.r); (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - s.r / s.max);
    if (s.dmg && !s.hit) { const d = player.pos.distanceTo(V(s.mesh.position.x, 0, s.mesh.position.z)); if (Math.abs(d - s.r) < 0.7 && hurtPlayer(s.dmg, s.mesh.position, null)) s.hit = true; }
    if (s.r >= s.max) { scene.remove(s.mesh); G.shock.splice(i, 1); }
  }
}
export { TYPE_COLOR };
