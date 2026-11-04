// Catching: weaken a wild Pokémon (<35% HP or staggered) and throw a ball (C / 🔴 button).
import * as THREE from 'three';
import { save, addMon, persist } from './save';
import { scene } from './scene';
import { heightAt } from './world';
import { mon, nameOf } from './dex';
import { sfx } from './audio';
import { burst, flashRing } from './fx';
import { G, L, player, Unit, stats, prompt, toast, syncTeam } from './state';
import { removeUnit, markRespawn, cancelTele, spawnZoneOf } from './spawns';
import { questEvent, checkPassiveQuests } from './npcs';

export const catchable = (u: Unit) => !u.boss && !u.caught && (u.hp / u.max < 0.35 || u.stagger > 0);
export function catchTarget() {
  let best: Unit | null = null, bd = 7;
  for (const u of G.enemies) { if (!catchable(u)) continue; const d = u.pos.distanceTo(player.pos); if (d < bd) { bd = d; best = u; } }
  return best;
}
function ballTex() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!;
  g.fillStyle = '#e23'; g.beginPath(); g.arc(16, 16, 14, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 14, 0, Math.PI); g.fill();
  g.fillStyle = '#222'; g.fillRect(2, 14.5, 28, 3); g.beginPath(); g.arc(16, 16, 5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(16, 16, 3, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const ballMat = new THREE.SpriteMaterial({ map: ballTex(), toneMapped: false });
interface Throw { s: THREE.Sprite; u: Unit; t: number; from: THREE.Vector3; ok: boolean; }
const throws: Throw[] = [];

export function tryCatch() {
  const u = catchTarget(); if (!u) { prompt(L('Weaken a Pokémon first (<35% HP)', 'Debilita un Pokémon primero (<35% PS)'), 1.2); return; }
  const m = mon(u.id); const st = stats(G.team[G.active].ms);
  let ch = (0.3 + (m.cr / 255) * 0.6 + (1 - u.hp / u.max) * 0.3 + (u.stagger > 0 ? 0.15 : 0)) * st.catch;
  if (u.alpha) ch *= 0.55; if (m.leg) ch *= 0.4; ch = Math.min(0.95, ch);
  u.caught = true; cancelTele(u); u.state = 'caught';
  const s = new THREE.Sprite(ballMat); s.scale.setScalar(0.5); scene.add(s);
  throws.push({ s, u, t: 0, from: player.pos.clone(), ok: Math.random() < ch }); sfx.shoot();
}
export function updateCatch(dt: number) {
  for (let i = throws.length - 1; i >= 0; i--) {
    const th = throws[i]; th.t += dt; const u = th.u;
    if (th.t < 0.45) { const k = th.t / 0.45; const p = th.from.clone().lerp(u.pos, k); th.s.position.set(p.x, heightAt(p.x, p.z) + 1 + Math.sin(k * Math.PI) * 2, p.z); continue; }
    if (th.t - dt < 0.45) { u.bb.group.visible = false; u.hb.visible = false; burst(u.pos.clone().setY(heightAt(u.pos.x, u.pos.z) + 1), 0xffffff, 20, 4, 2, 0.4); }
    u.bb.group.visible = false; th.s.position.set(u.pos.x, heightAt(u.pos.x, u.pos.z) + 0.3, u.pos.z);
    th.s.material.rotation = Math.sin(th.t * 14) * (th.t < 1.6 ? 0.4 : 0);
    if (th.t < 1.7) continue;
    scene.remove(th.s); throws.splice(i, 1);
    if (th.ok) {
      flashRing(u.pos, 1.6, 0xffe35a); sfx.level(); removeUnit(u); markRespawn(u, u.alpha ? 180 : 30);
      const newSpecies = !save.caught.includes(u.id); addMon(u.id, u.lv);
      toast(`● ${nameOf(u.id)} ${L('caught!', '¡capturado!')}${save.party.length >= 3 && !save.party.includes(save.nextUid - 1) ? ' → PC' : ''}`);
      if (newSpecies) toast('📘 ' + L('New Pokédex entry', 'Nueva entrada en la Pokédex'));
      questEvent('catch', undefined, mon(u.id).t); if (u.alpha) questEvent('alpha', spawnZoneOf(u));
      syncTeam(); checkPassiveQuests(); persist();
    } else {
      u.caught = false; u.bb.group.visible = true; u.state = 'chase'; u.aggro = true; u.hp = Math.min(u.max, u.hp + u.max * 0.1);
      burst(u.pos.clone().setY(1), 0xff3f5a, 20, 6, 3, 0.5); prompt(L('It broke free!', '¡Se ha escapado!'), 1.2); sfx.break();
    }
  }
}
export function clearCatch() { for (const th of throws) scene.remove(th.s); throws.length = 0; }
