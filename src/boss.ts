// Mewtwo boss patterns (3 health bars → harder patterns).
import * as THREE from 'three';
import { BOSS_BARS } from './data';
import { heightAt } from './world';
import { sfx } from './audio';
import { burst, trail, flashRing } from './fx';
import { G, V, player, Unit } from './state';
import { hurtPlayer, fireProj, addShock } from './combat';
import { teleRing, cancelTele } from './spawns';

export function bossAI(u: Unit, dt: number, toP: THREE.Vector3, dist: number) {
  const ph = Math.min(2, u.bar); u.cd -= dt; u.bb.setFacing(toP.x, toP.z);
  if (Math.random() < dt * 2) trail(u.pos.clone().setY(1 + Math.random() * 2), BOSS_BARS[ph]);
  if (u.inv > 0) return;
  if (u.state === 'chase') {
    if (dist > 6) { u.pos.addScaledVector(toP, u.def.speed * 0.6 * dt); u.bb.play('Walk'); } else if (dist < 4) { u.pos.addScaledVector(toP, -u.def.speed * 0.5 * dt); u.bb.play('Walk'); } else u.bb.play('Idle');
    if (u.cd <= 0) {
      const pats = ph === 0 ? ['fan', 'tele'] : ph === 1 ? ['fan', 'tele', 'ring', 'fan2'] : ['ring', 'tele', 'shock', 'fan2', 'shock'];
      u.pat = (u.pat + 1) % pats.length; u.state = pats[u.pat]; u.st = 0; u.cd = Math.max(0.7, 2.1 - ph * 0.55);
      if (u.state === 'tele') teleRing(u, 3, player.pos);
      if (u.state === 'shock') teleRing(u, 2.2);
    }
    return;
  }
  u.st += dt;
  if (u.state === 'fan' || u.state === 'fan2') {
    if (u.st > 0.45 && u.st - dt <= 0.45) { const n = u.state === 'fan' ? 5 : 9, spread = u.state === 'fan' ? 0.9 : 1.6; u.bb.play('Attack', true, true); sfx.shoot();
      for (let k = 0; k < n; k++) { const a = Math.atan2(toP.z, toP.x) + (k / (n - 1) - 0.5) * spread; fireProj(u.pos.clone(), V(Math.cos(a), 0, Math.sin(a)), 13 + ph * 2, 0.5, u.def.dmg, 0, false, 0xc06bff); } }
    if (u.st > 0.9) u.state = 'chase';
  } else if (u.state === 'ring') {
    if (u.st > 0.6 && u.st - dt <= 0.6) { u.bb.play('Attack', true, true); sfx.shoot(); for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2 + G.runTime; fireProj(u.pos.clone(), V(Math.cos(a), 0, Math.sin(a)), 9, 0.6, u.def.dmg, 0, false, 0x5a2aff); } }
    if (u.st > 1.1) u.state = 'chase';
  } else if (u.state === 'tele') {
    if (u.tele) { u.tele.position.set(player.pos.x, heightAt(player.pos.x, player.pos.z) + 0.06, player.pos.z); (u.tele.material as THREE.MeshBasicMaterial).color.setHex(u.st > 0.7 ? 0xffffff : 0xff2a3c); }
    if (u.st > 0.4 && u.st - dt <= 0.4) { burst(u.pos.clone().setY(1), 0xc06bff, 30, 6, 3, 0.5); u.bb.group.visible = false; }
    if (u.st > 0.9) { const at = u.tele ? V(u.tele.position.x, 0, u.tele.position.z) : player.pos.clone(); cancelTele(u); u.pos.copy(at).add(V(0, 0, -1.6)); u.bb.group.visible = true; u.bb.play('Attack', true, true);
      burst(at.clone().setY(0.5), 0xff3fd2, 50, 10, 4, 0.6); flashRing(at, 3, 0xff3fd2); sfx.heavy(); G.shake = Math.max(G.shake, 0.5);
      if (player.pos.distanceTo(at) < 3) hurtPlayer(u.def.dmg * 1.6, at, u); u.state = 'recover2'; u.st = 0; }
  } else if (u.state === 'shock') {
    if (u.tele) (u.tele.material as THREE.MeshBasicMaterial).color.setHex(u.st > 0.5 ? 0xffffff : 0xff2a3c);
    if (u.st > 0.7) { cancelTele(u); addShock(u.pos, 18, 9, u.def.dmg * 1.2); u.bb.play('Attack', true, true); sfx.heavy(); G.shake = 0.4; u.state = 'recover2'; u.st = 0; }
  } else if (u.state === 'recover2' || u.state === 'recover') { if (u.st > 0.8 - ph * 0.15) u.state = 'chase'; }
}
