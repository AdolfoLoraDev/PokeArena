import { checkResize } from './scene';
// Game flow: title/starter, start/resume/pause, travel, blackout, camera and main loop.
import * as THREE from 'three';
import { t, setLang, getLang, applyI18n } from './i18n';
import { save, persist, resetSave, addMon } from './save';
import { camera, render, setZone, followSun, setupQuality } from './scene';
import { buildWorld, world, resetFog, loadFog, fogData, reveal, setWayActive, heightAt, updateWorld } from './world';
import { ZONES } from './zones';
import { nameOf, dexStr } from './dex';
import { sfx, initAudio, startMusic, applyVolumes } from './audio';
import { updateVfx, castFx, levelFx } from './vfx';
import { fanfare } from './ui';
import { updateFx, updateFades, updateNums, clearFx, flashRing } from './fx';
import { portrait } from './sprites';
import { G, $, V, L, player, isTouch, maxHp, modal, closeModal, tickText, banner, toast, syncTeam, setTeamChangeHook } from './state';
import { pressed, setKeyHandler } from './input';
import { setBlackout, damageEnemy } from './combat';
import { buildSpawnPoints, clearUnits } from './spawns';
import { buildNpcs } from './npcs';
import { clearCatch } from './catch';
import { buildTeamHud, updateHud } from './hud';
import { initMenus, openPanel, closePanels, panelOpen } from './menus';
import { updatePlay } from './play';

let menuT = 0;
function clearCombat() { clearUnits(); clearCatch(); for (const p of G.projs) p.mesh.parent?.remove(p.mesh); G.projs = []; for (const s of G.shock) s.mesh.parent?.remove(s.mesh); G.shock = []; clearFx(); G.lockT = null; }
export function showScreen(id: string | null) { ['title', 'optScr', 'credScr'].forEach((s) => $('#' + s).classList.toggle('hidden', s !== id)); if (id === 'optScr') syncOptions(); }
export function startGame() {
  if (!save.mons.length) { pickStarter(); return; }
  showScreen(null); closePanels(); clearCombat(); setZone(true);
  const fog = localStorage.getItem('pa_fog'); if (fog) loadFog(fog); else resetFog();
  if (save.pos) player.pos.set(save.pos[0], 0, save.pos[1]); else player.pos.copy(world.start);
  for (const w of world.ways) setWayActive(w.id, save.ways.includes(w.id));
  buildSpawnPoints(); buildNpcs(); G.mode = 'play'; syncTeam(); G.team.forEach((m) => { if (m.hp <= 0) m.hp = maxHp(m); });
  player.face.set(0, 0, -1); player.bb.group.visible = true; G.camTarget.copy(player.pos); reveal(player.pos, 30); G.curZone = -1;
  buildTeamHud(); $('#hud').classList.remove('hidden'); $('#touch').classList.toggle('hidden', !isTouch);
}
function pickStarter() {
  G.mode = 'modal'; const ids = [1, 4, 7, 25];
  modal(L('Choose your partner', 'Elige a tu compañero'), `<p>${L('More Pokémon can be caught in the wild — all 151 await!', '¡Podrás capturar más en la naturaleza: te esperan los 151!')}</p><div class="starters">${ids.map((i) => `<button data-st="${i}"><img src="${portrait(dexStr(i))}"><b>${nameOf(i)}</b></button>`).join('')}</div>`, []);
  document.querySelectorAll<HTMLElement>('[data-st]').forEach((b) => (b.onclick = () => { sfx.level(); addMon(+b.dataset.st!, 3); closeModal(true); startGame(); banner(L('Talk to the Elder (!)', 'Habla con la Anciana (!)'), '#ffd23f', 3); }));
}
export function toMenu() {
  savePos(); clearCombat(); closeModal(true); closePanels(); G.mode = 'menu'; setZone(false);
  $('#hud').classList.add('hidden'); $('#touch').classList.add('hidden'); player.bb.group.visible = false; showScreen('title');
}
function pauseGame() {
  G.mode = 'pause'; const b: [string, () => void][] = [[t('resume'), resume], [L('Team', 'Equipo'), () => { closeModal(true); openPanel('teamScr', true); }],
    [L('Map', 'Mapa'), () => { closeModal(true); openPanel('mapScr', true); }], [t('options'), () => { closeModal(true); showScreen('optScr'); }], [t('menu'), toMenu]];
  modal(t('paused'), '', b);
}
export function resume() { closeModal(true); closePanels(); showScreen(null); if (G.team.length) G.mode = 'play'; }
function blackout() {
  if (G.mode === 'menu') return; clearCombat(); G.team.forEach((m) => { m.hp = maxHp(m); m.endured = false; });
  player.pos.copy(world.start); G.active = 0; syncTeam(); toast(L('You whited out… back to town.', 'Te has debilitado… de vuelta al pueblo.')); banner(t('defeat'), '#ff5a6a');
}
export function travel(id: string) {
  const w = world.ways.find((x) => x.id === id); if (!w) return; clearCombat();
  player.pos.set(w.pos.x + 2.5, 0, w.pos.z + 2.5); G.camTarget.copy(player.pos); reveal(player.pos, 24); flashRing(player.pos, 3, 0x4fe3ff); sfx.dash(); G.mode = 'play';
}
function savePos() { if (G.mode === 'menu' || !G.team.length) return; save.pos = [player.pos.x, player.pos.z]; persist(); try { localStorage.setItem('pa_fog', fogData()); } catch {} }
function syncOptions() {
  document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === getLang()));
  document.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.classList.toggle('on', b.dataset.q === save.quality));
  ($('#volMusic') as HTMLInputElement).value = String(save.music); ($('#volSfx') as HTMLInputElement).value = String(save.sfx);
  $('#ctrlText').innerHTML = `${t('ctrlDesk')}<br><br>${t('ctrlMob')}`;
}
export function initUi() {
  initMenus(travel, () => { if (G.mode === 'pause' && $('#modal').classList.contains('hidden')) G.mode = G.team.length && $('#title').classList.contains('hidden') ? 'play' : G.mode; });
  setBlackout(blackout); setTeamChangeHook(buildTeamHud);
  document.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => {
    initAudio(); startMusic(); sfx.ui(); const g = b.dataset.go!;
    if (g === 'play') startGame(); else if (g === 'title') { if (G.mode === 'pause') { showScreen(null); pauseGame(); } else showScreen('title'); }
    else if (g === 'teamScr' || g === 'dexScr') { if (save.mons.length) openPanel(g, false); else toast(L('Press Play to choose your partner first.', 'Pulsa Jugar para elegir compañero primero.')); } else showScreen(g);
  }));
  $('#pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (G.mode === 'play') pauseGame(); });
  $('#menuBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (G.mode === 'play') openPanel('teamScr', true); });
  $('#talk').addEventListener('pointerdown', (e) => { e.stopPropagation(); pressed.add('t'); });
  document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang!); syncOptions(); if (G.team.length) buildTeamHud(); }));
  document.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.addEventListener('click', () => { save.quality = b.dataset.q as any; persist(); setupQuality(); syncOptions(); }));
  $('#volMusic').addEventListener('input', (e) => { save.music = +(e.target as HTMLInputElement).value; persist(); applyVolumes(); });
  $('#volSfx').addEventListener('input', (e) => { save.sfx = +(e.target as HTMLInputElement).value; persist(); applyVolumes(); sfx.ui(); });
  $('#resetBtn').addEventListener('click', () => { if (confirm(t('resetQ'))) { resetSave(); localStorage.removeItem('pa_fog'); location.reload(); } });
  setKeyHandler((k) => {
    if (k === 'escape') { if (panelOpen()) closePanels(); else if (G.mode === 'play') pauseGame(); else if (G.mode === 'pause' || G.mode === 'modal') resume(); return; }
    const P: Record<string, string> = { m: 'mapScr', k: 'skillScr', j: 'questScr', p: 'teamScr', i: 'dexScr' };
    if (P[k] && (G.mode === 'play' || panelOpen())) { if (panelOpen()) closePanels(); else openPanel(P[k], true); }
  });
  addEventListener('pagehide', savePos); setInterval(savePos, 5000); applyI18n(); setLang(getLang());
}
function updateCamera(dt: number) {
  const portrait = innerWidth / innerHeight < 1;
  if (G.mode === 'menu') { menuT += dt * 0.12; const r = 22; camera.position.set(Math.sin(menuT) * r, 11, Math.cos(menuT) * r); camera.lookAt(0, 1.5, 0); followSun(0, 0); }
  else { const h = (isTouch ? 13 : 14) * (portrait ? 1.3 : 1), b = (isTouch ? 12 : 13.5) * (portrait ? 1.1 : 1); const y = heightAt(G.camTarget.x, G.camTarget.z);
    camera.position.set(G.camTarget.x, y + h, G.camTarget.z + b); camera.lookAt(G.camTarget.x, y + 0.8, G.camTarget.z); }
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake; camera.position.y += (Math.random() - 0.5) * G.shake; G.shake = Math.max(0, G.shake - dt * 2.2); }
}
const clock = new THREE.Clock(); let time = 0;
export function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 1 / 20); time += raw;
  let dt = raw; if (G.hitstop > 0) { G.hitstop -= raw; dt = raw * 0.05; }
  if (G.mode === 'play') updatePlay(dt); else if (G.mode === 'menu') updateWorld(time, raw, V(0, 0, 0), 0);
  checkResize(); pressed.clear(); updateFx(dt); updateVfx(dt); updateFades(dt); updateNums(raw); updateCamera(raw); tickText(raw);
  if (G.mode !== 'menu' && G.team.length) updateHud();
  render(time);
}
export function buildAll() { buildWorld(save.quality === 'low'); world.group.visible = true; }
(window as any).__game = { camera, G, player, world, save, ZONES, travel, startGame, fanfare, castFx, levelFx, tp: (x: number, z: number) => player.pos.set(x, 0, z),
  kill: () => [...G.enemies].forEach((e) => damageEnemy(e, 99999, 0, player.pos)), openPanel, addMon: (id: number, lv: number) => { addMon(id, lv); syncTeam(); } };
