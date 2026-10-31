import * as THREE from 'three';
import { t, applyI18n, setLang, getLang } from './i18n';
import { TEAM, ENEMIES, WAVES, UPGRADES, ITEMS, BOSS_BARS, xpFor, Move, EnemyDef, Species } from './data';
import { save, persist, resetSave, MemberSave } from './save';
import { scene, camera, renderer, setupQuality, render, playerLight, setZone, followSun } from './scene';
import { world, buildWorld, collide, projBlocked, heightAt, reveal, resetFog, drawMinimap, setBeam, updateWorld, openGate, loadWorldAssets } from './world';
import { Billboard, loadSpecies, portrait } from './sprites';
import { setGroundFn, burst, trail, updateFx, groundRing, slash, flashRing, updateFades, dmgNum, updateNums, clearFx, dotTex } from './fx';
import { sfx, initAudio, applyVolumes, startMusic } from './audio';
import CREDITS from './credits.txt?raw';

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- team / stats ----------
interface Member { sp: Species; ms: MemberSave; hp: number; cds: number[]; stage: number; }
function stageOf(sp: Species, lvl: number) { let s = 0; sp.stages.forEach((st, i) => { if (lvl >= st.level) s = i; }); return s; }
function stats(m: { sp: Species; ms: MemberSave }) {
  const s = { dmg: 1 + 0.07 * (m.ms.level - 1), hp: 9 * (m.ms.level - 1) + stageOf(m.sp, m.ms.level) * 20, cd: 1, ls: 0, pos: 1, spd: 1 };
  for (const u of m.ms.upgrades) { if (u === 'u_dmg') s.dmg *= 1.2; if (u === 'u_hp') s.hp += 25; if (u === 'u_cd') s.cd *= 0.85; if (u === 'u_ls') s.ls += 0.06; if (u === 'u_pos') s.pos *= 1.35; if (u === 'u_spd') s.spd *= 1.12; }
  const it = m.ms.item; if (it === 'i_belt') s.dmg *= 1.15; if (it === 'i_claw') s.cd *= 0.8; if (it === 'i_bell') s.ls += 0.08; if (it === 'i_band') s.hp += 40; if (it === 'i_lens') s.pos *= 1.5;
  return s;
}
const maxHp = (m: Member) => m.sp.hp + stats(m).hp;
const mname = (m: { sp: Species; ms: MemberSave }) => m.sp.stages[stageOf(m.sp, m.ms.level)].name;
const moveName = (mv: Move) => (getLang() === 'es' ? mv.es : mv.en);
let team: Member[] = [];
let active = 0;

// ---------- units ----------
interface Unit { bb: Billboard; pos: THREE.Vector3; kb: THREE.Vector3; hp: number; max: number; posture: number; maxPosture: number; stagger: number; lastHit: number;
  def: EnemyDef; state: string; st: number; cd: number; tele: THREE.Mesh | null; burn: number; boss: boolean; bar: number; inv: number; pat: number; lungeDir: THREE.Vector3; hb: THREE.Sprite; camp: number; aggro: boolean; home: THREE.Vector3; prev: THREE.Vector3; }
let enemies: Unit[] = [];
const player = { bb: new Billboard(1), pos: V(0, 0, 6), face: V(0, 0, -1), dashT: 0, dashDir: V(), iframes: 0, dashCd: 0, parryT: 0, parryCd: 0, counterT: 0, swapCd: 0,
  dashMove: null as Move | null, dashHit: new Set<Unit>(), cone: 0, coneMove: null as Move | null, coneT: 0, ccT: 0, ccN: 0, ccMove: null as Move | null };
scene.add(player.bb.group);
interface Proj { mesh: THREE.Sprite; pos: THREE.Vector3; vel: THREE.Vector3; r: number; dmg: number; posture: number; mine: boolean; life: number; color: number; burn: boolean; homing?: boolean; }
let projs: Proj[] = [];
interface Wave { mesh: THREE.Mesh; r: number; spd: number; max: number; dmg: number; hit: boolean; }
let shock: Wave[] = [];

// ---------- game state ----------
type Mode = 'menu' | 'play' | 'pause' | 'modal' | 'end';
let mode: Mode = 'menu';
let waveIdx = 0, waveDelay = 0, firstWaveStarted = false, runTime = 0, kills = 0, bossSpawned = false, hitstop = 0, shake = 0, lockT: Unit | null = null;
const pendingLevel: number[] = [];

// ---------- menu showcase ----------
const showA = new Billboard(1.3), showB = new Billboard(1.7);
showA.group.position.set(-5, 0, 1.5); showB.group.position.set(5, 0, -1.5); scene.add(showA.group, showB.group);
showA.setSpecies('0448', 1.3); showB.setSpecies('0150', 1.7); showA.setFacing(1, -0.3); showB.setFacing(-1, 0.3);

// ---------- input ----------
const keys = new Set<string>(); const mouseNdc = new THREE.Vector2(); let mouseDown = false, mouseOnScreen = false;
const pressed = new Set<string>(); const stickVec = new THREE.Vector2(); let atkHeld = false;
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase(); if (k === 'tab') e.preventDefault(); if (!keys.has(k)) pressed.add(k); keys.add(k);
  if (k === 'escape') { if (mode === 'play') pauseGame(); else if (mode === 'pause') resume(); }
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
const cv = renderer.domElement;
cv.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; mouseNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); mouseOnScreen = true; });
cv.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; initAudio(); if (e.button === 0) { mouseDown = true; pressed.add('atk'); } if (e.button === 2) pressed.add('f'); });
addEventListener('pointerup', (e) => { if (e.button === 0) mouseDown = false; });
// touch stick
const stick = $('#stick'), knob = $('#knob'); let stickId = -1, sc = { x: 0, y: 0 };
stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; const r = stick.getBoundingClientRect(); sc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
const endStick = (e: PointerEvent) => { if (e.pointerId !== stickId) return; stickId = -1; stickVec.set(0, 0); knob.style.transform = ''; };
stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick); stick.addEventListener('lostpointercapture', endStick as any);
function moveStick(e: PointerEvent) { let dx = e.clientX - sc.x, dy = e.clientY - sc.y; const l = Math.hypot(dx, dy), mx = 48; if (l > mx) { dx *= mx / l; dy *= mx / l; } stickVec.set(dx / mx, dy / mx); knob.style.transform = `translate(${dx}px,${dy}px)`; }
document.querySelectorAll<HTMLElement>('#tbtns button').forEach((b) => {
  const a = b.dataset.a!; const map: Record<string, string> = { q: 'q', e: 'e', r: 'r', dash: ' ', parry: 'f', lock: 'tab', atk: 'atk' };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); pressed.add(map[a]); if (a === 'atk') atkHeld = true; });
  const up = () => { if (a === 'atk') atkHeld = false; }; b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
});
const ray = new THREE.Raycaster(), groundPlane = new THREE.Plane(V(0, 1, 0), 0);
function mouseGround() { ray.setFromCamera(mouseNdc, camera); const p = V(); return ray.ray.intersectPlane(groundPlane, p) ? p : null; }

// ---------- HUD ----------
function buildTeamHud() {
  const el = $('#team'); el.innerHTML = '';
  team.forEach((m, i) => {
    const d = document.createElement('div'); d.className = 'pm'; d.style.setProperty('--c', m.sp.color);
    d.innerHTML = `<img src="${portrait(m.sp.stages[m.stage].dex)}"><div><div class="nm">${mname(m)} <span class="k">${t('level')} ${m.ms.level} · [${i + 1}]</span></div><div class="hp"><i></i></div></div>`;
    d.addEventListener('pointerdown', (e) => { e.stopPropagation(); swapTo(i); }); el.appendChild(d);
  });
  const mv = $('#moves'); mv.innerHTML = '';
  ['LMB', 'Q', 'E', 'R'].forEach((k, i) => { const d = document.createElement('div'); d.className = 'mvb'; mv.appendChild(d); d.innerHTML = `<b>${k}</b><span></span><div class="cd"></div>`; });
  refreshMoveHud();
}
function refreshMoveHud() {
  const m = team[active]; if (!m) return;
  document.querySelectorAll<HTMLElement>('#moves .mvb').forEach((d, i) => { d.style.setProperty('--c', '#' + m.sp.moves[i].color.toString(16).padStart(6, '0')); d.querySelector('span')!.textContent = moveName(m.sp.moves[i]); });
  document.querySelectorAll<HTMLElement>('#team .pm').forEach((d, i) => d.classList.toggle('on', i === active));
}
function updateHud() {
  document.querySelectorAll<HTMLElement>('#team .pm').forEach((d, i) => { const m = team[i]; (d.querySelector('.hp i') as HTMLElement).style.width = (100 * Math.max(0, m.hp) / maxHp(m)) + '%'; d.classList.toggle('dead', m.hp <= 0); });
  const m = team[active], cdm = stats(m).cd;
  const cdEls = isTouch ? ['atk', 'q', 'e', 'r'].map((a) => document.querySelector(`#tbtns [data-a=${a}]`) as HTMLElement) : Array.from(document.querySelectorAll<HTMLElement>('#moves .mvb'));
  cdEls.forEach((d, i) => { let c = d.querySelector('.cd') as HTMLElement; if (!c) { c = document.createElement('div'); c.className = 'cd'; d.appendChild(c); } c.style.height = (100 * Math.max(0, m.cds[i]) / (m.sp.moves[i].cd * cdm)) + '%'; });
  const boss = enemies.find((e) => e.boss);
  $('#bossbar').classList.toggle('hidden', !boss);
  if (boss) {
    const per = boss.def.hp, bar = Math.min(2, Math.floor((boss.max - boss.hp) / per)), frac = (boss.hp - (2 - bar) * per) / per;
    const fill = $('.bfill'), under = $('.bunder'); fill.style.background = '#' + BOSS_BARS[bar].toString(16).padStart(6, '0');
    under.style.background = bar < 2 ? '#' + BOSS_BARS[bar + 1].toString(16).padStart(6, '0') : '#220810'; fill.style.transform = `scaleX(${Math.max(0, frac)})`;
    $('.bcount').textContent = '×' + (3 - bar);
    let pe = document.getElementById('bposture'); if (!pe) { pe = document.createElement('div'); pe.id = 'bposture'; pe.innerHTML = '<i></i>'; $('#bossbar').appendChild(pe); }
    (pe.firstChild as HTMLElement).style.width = (boss.stagger > 0 ? 100 : (100 * boss.posture) / boss.maxPosture) + '%';
  }
  $('#wave').textContent = bossSpawned ? 'BOSS' : t('camps', { n: campsDone(), m: world.camps.length });
  if ((mmT += 1) % 6 === 0) drawMinimap(mmCv, player.pos, player.face, shrineOpen() || bossSpawned, enemies.map((e) => e.pos));
  const rt = $('#reticle');
  if (lockT && enemies.includes(lockT)) { const p = lockT.pos.clone(); p.y = 1.2 * lockT.def.scale; p.project(camera); rt.style.display = 'block'; rt.style.left = ((p.x + 1) / 2) * innerWidth + 'px'; rt.style.top = ((1 - p.y) / 2) * innerHeight + 'px'; }
  else rt.style.display = 'none';
}
let bannerTimer = 0; let mmT = 0; const mmCv = document.getElementById('minimap') as HTMLCanvasElement;
function banner(txt: string, color = '#fff', dur = 1.6) { const b = $('#banner'); b.textContent = txt; b.style.color = color; b.classList.add('show'); bannerTimer = dur; }
let promptTimer = 0;
function prompt(txt: string, dur = 1.4) { $('#prompt').textContent = txt; promptTimer = dur; }

// lock-on line
const lockLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V()]), new THREE.LineDashedMaterial({ color: 0xff4f8a, dashSize: 0.4, gapSize: 0.3, toneMapped: false }));
lockLine.visible = false; scene.add(lockLine);

// enemy health bars (sprites)
function hbSprite() { const c = document.createElement('canvas'); c.width = 64; c.height = 10; const tex = new THREE.CanvasTexture(c); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, toneMapped: false })); s.scale.set(1.6, 0.25, 1); s.renderOrder = 5; (s as any).ctx = c.getContext('2d'); return s; }
function drawHb(u: Unit) { const g = (u.hb as any).ctx as CanvasRenderingContext2D; g.clearRect(0, 0, 64, 10); g.fillStyle = '#000a'; g.fillRect(0, 0, 64, 10); g.fillStyle = u.stagger > 0 ? '#ffd23f' : '#ff3f5a'; g.fillRect(1, 1, 62 * Math.max(0, u.hp / u.max), 5); g.fillStyle = '#ffd23f'; g.fillRect(1, 7, 62 * (u.stagger > 0 ? 1 : u.posture / u.maxPosture), 2); (u.hb.material.map as THREE.Texture).needsUpdate = true; }

// ---------- spawning ----------
function spawnEnemy(key: string, at?: THREE.Vector3, camp = -1) {
  const def = ENEMIES[key]; const bb = new Billboard(def.scale); bb.setSpecies(def.dex, def.scale);
  const a = Math.random() * Math.PI * 2, pos = at ? at.clone() : V(Math.cos(a) * 15, 0, Math.sin(a) * 15);
  const boss = key === 'mewtwo'; const max = boss ? def.hp * 3 : def.hp * (1 + waveIdx * 0.15);
  const u: Unit = { bb, pos, kb: V(), hp: max, max, posture: 0, maxPosture: def.posture, stagger: 0, lastHit: 0, def, state: 'chase', st: 0, cd: 1 + Math.random(), tele: null, burn: 0, boss, bar: 0, inv: boss ? 1.5 : 0, pat: 0, lungeDir: V(), hb: hbSprite(), camp, aggro: camp < 0, home: pos.clone(), prev: pos.clone() };
  if (!boss) bb.group.add(u.hb); u.hb.position.y = 1.9 * def.scale;
  scene.add(bb.group); bb.group.position.copy(pos); enemies.push(u); burst(pos.clone().setY(0.5), def.color, 24, 5, 3, 0.7); flashRing(pos, 1.5, def.color);
  return u;
}
function spawnCamps() { world.camps.forEach((c, ci) => { waveIdx = c.tier; const list = WAVES[c.tier].slice(0, 3 + (ci % 3)); list.forEach((k, i) => { const a = (i / list.length) * Math.PI * 2; const p = c.pos.clone().add(V(Math.cos(a) * 3.5, 0, Math.sin(a) * 3.5)); spawnEnemy(k, p, ci); }); }); waveIdx = 0; }
const SHRINE_NEED = 4; const campsDone = () => world.camps.filter((c) => c.cleared).length; const shrineOpen = () => campsDone() >= SHRINE_NEED;
function spawnBoss() { bossSpawned = true; banner(t('bossIncoming'), '#c06bff', 2.4); sfx.boss(); shake = 0.8; spawnEnemy('mewtwo', world.shrine.clone().add(V(0, 0, -3))); }

// ---------- combat ----------
const hitstopFor = (s: number) => (hitstop = Math.max(hitstop, s));
function damageEnemy(u: Unit, dmg: number, posture: number, from: THREE.Vector3, opts: { crit?: boolean; burn?: boolean; kb?: number } = {}) {
  if (u.hp <= 0) return; if (u.inv > 0) { dmgNum(u.pos, '—'); return; }
  const st = stats(team[active]);
  let d = dmg * st.dmg * (u.stagger > 0 ? 1.5 : 1) * (0.9 + Math.random() * 0.2); d = Math.round(d);
  u.hp -= d; u.lastHit = 0; u.bb.flash = 0.08; u.bb.play('Hurt', true, true);
  if (u.stagger <= 0) { u.posture += posture * st.pos; if (u.posture >= u.maxPosture) { u.stagger = u.boss ? 3 : 2.5; u.posture = 0; prompt(t('stagger')); sfx.break(); hitstopFor(0.12); shake = Math.max(shake, 0.5); burst(u.pos.clone().setY(1), 0xffd23f, 40, 9, 4, 0.8); cancelTele(u); u.state = 'chase'; } }
  if (opts.burn) u.burn = 3;
  const dir = u.pos.clone().sub(from).setY(0).normalize(); u.kb.addScaledVector(dir, (opts.kb ?? 5) * (u.boss ? 0.3 : 1));
  dmgNum(u.pos, String(d), opts.crit || u.stagger > 0 ? 'crit' : ''); burst(u.pos.clone().setY(1), 0xffffff, 8, 5, 2, 0.3);
  if (st.ls > 0) healActive(d * st.ls);
  if (u.boss) checkBossPhase(u);
  if (!u.hb.parent && !u.boss) u.bb.group.add(u.hb);
  if (u.hp <= 0) killEnemy(u);
}
function healActive(n: number) { const m = team[active]; m.hp = Math.min(maxHp(m), m.hp + n); }
function checkBossPhase(u: Unit) {
  const bar = Math.floor((u.max - u.hp) / u.def.hp);
  if (bar > u.bar && u.hp > 0) { u.bar = bar; u.inv = 1.6; u.hp = u.max - bar * u.def.hp; cancelTele(u); u.state = 'chase'; u.st = 0; u.cd = 1.6; u.stagger = 0;
    banner(t('phase', { n: bar + 1 }), '#' + BOSS_BARS[bar].toString(16).padStart(6, '0'), 1.8); sfx.boss(); shake = 0.9; hitstopFor(0.25);
    burst(u.pos.clone().setY(1.5), BOSS_BARS[bar], 45, 14, 5, 0.9); addShock(u.pos, 22, 14, 0); player.pos.addScaledVector(player.pos.clone().sub(u.pos).setY(0).normalize(), 3); }
}
function killEnemy(u: Unit) {
  kills++; burst(u.pos.clone().setY(0.8), u.def.color, 40, 8, 4, 0.9); sfx.heavy(); shake = Math.max(shake, 0.3); hitstopFor(0.06); cancelTele(u);
  scene.remove(u.bb.group); enemies = enemies.filter((e) => e !== u); if (lockT === u) lockT = null;
  // XP
  team.forEach((m, i) => { if (m.hp <= 0 && i !== active) return; gainXp(i, Math.round(u.def.xp * (i === active ? 1 : 0.5))); });
  if (u.boss) setTimeout(() => endRun(true), 1400);
  if (u.camp >= 0 && !enemies.some((e) => e.camp === u.camp)) { const c = world.camps[u.camp]; c.cleared = true; for (const m of team) if (m.hp > 0) m.hp = Math.min(maxHp(m), m.hp + maxHp(m) * 0.35);
    const n = campsDone(); if (c.name === 'bigtree' && openGate('shortcut')) setTimeout(() => prompt(t('shortcut'), 2), 1700);
    if (n === SHRINE_NEED) { openGate('seal'); banner(t('sealBroken'), '#c06bff', 2.4); sfx.boss(); } else prompt(t('campClear', { n, m: world.camps.length }), 1.6); }
}
function gainXp(i: number, xp: number) {
  const m = team[i]; m.ms.xp += xp;
  while (m.ms.xp >= xpFor(m.ms.level)) { m.ms.xp -= xpFor(m.ms.level); m.ms.level++; pendingLevel.push(i);
    const ns = stageOf(m.sp, m.ms.level), oldName = m.sp.stages[m.stage].name;
    const ratio = m.hp / maxHp(m);
    if (ns !== m.stage) { m.stage = ns; banner(t('evolve', { a: oldName, b: m.sp.stages[ns].name }), '#ffe35a', 2.2); sfx.level(); if (i === active) { player.bb.setSpecies(m.sp.stages[ns].dex, m.sp.stages[ns].scale); burst(player.pos.clone().setY(1), 0xffffff, 80, 10, 6, 1.2); } }
    m.hp = Math.max(m.hp, ratio * maxHp(m)) + 15;
    m.hp = Math.min(m.hp, maxHp(m));
  }
  persist();
}
function hurtPlayer(dmg: number, from: THREE.Vector3, src: Unit | null, proj?: Proj): boolean {
  if (player.iframes > 0) { if (player.dashT > 0) dmgNum(player.pos, 'MISS'); return false; }
  if (player.parryT > 0) { // PARRY
    player.parryT = 0; player.parryCd = 0; player.counterT = 1.6; sfx.parry(); hitstopFor(0.14); shake = Math.max(shake, 0.35);
    burst(player.pos.clone().setY(1).lerp(from, 0.4), 0xffe35a, 36, 9, 3, 0.6); flashRing(player.pos, 2.4, 0xffe35a);
    prompt(t('parry') + '  →  ' + (isTouch ? '⚔' : 'LMB') + ' ' + t('counter'), 1.6);
    if (src) { src.posture += src.maxPosture * 0.45; src.st = 0; src.state = 'recover'; src.cd = 1.2; src.bb.play('Hurt', true, true); if (src.posture >= src.maxPosture) damageEnemy(src, 1, 0, player.pos); }
    if (proj) { proj.mine = true; proj.vel.multiplyScalar(-1.3); proj.dmg *= 2; proj.life = 2; }
    return false;
  }
  const m = team[active]; m.hp -= dmg; player.bb.flash = 0.1; player.bb.play('Hurt', true, true); sfx.hurt(); shake = Math.max(shake, 0.35); hitstopFor(0.05);
  dmgNum(player.pos, String(Math.round(dmg)), 'p'); player.iframes = 0.35;
  player.pos.addScaledVector(player.pos.clone().sub(from).setY(0).normalize(), 0.8);
  if (m.hp <= 0) { m.hp = 0; banner(mname(m) + ' ' + t('fainted'), '#ff5a6a'); const n = team.findIndex((x) => x.hp > 0); if (n < 0) setTimeout(() => endRun(false), 900); else swapTo(n, true); }
  return true;
}
function nearestEnemy(p: THREE.Vector3, maxD = 99) { let best: Unit | null = null, bd = maxD; for (const e of enemies) { const d = e.pos.distanceTo(p); if (d < bd) { bd = d; best = e; } } return best; }
function useMove(i: number) {
  const m = team[active]; if (m.hp <= 0 || m.cds[i] > 0 || player.dashT > 0) return; const mv = m.sp.moves[i]; const st = stats(m);
  m.cds[i] = mv.cd * st.cd; const f = player.face.clone(); const ang = Math.atan2(f.z, f.x);
  player.bb.play('Attack', true, true);
  const counter = i === 0 && player.counterT > 0;
  if (mv.kind === 'melee') {
    sfx.swing(); player.pos.addScaledVector(f, 0.35);
    slash(player.pos.clone().addScaledVector(f, 0.6), -ang, mv.range * (counter ? 1.5 : 1), counter ? 0xffe35a : mv.color);
    for (const e of [...enemies]) { const d = e.pos.clone().sub(player.pos).setY(0); const reach = mv.range + 0.5 * e.def.scale * (counter ? 1.5 : 1);
      if (d.length() < reach && d.normalize().dot(f) > 0.25) { damageEnemy(e, mv.dmg * (counter ? 3.2 : 1), mv.posture * (counter ? 4 : 1), player.pos, { crit: counter, burn: mv.burn }); sfx.hit(); hitstopFor(counter ? 0.16 : 0.035); if (counter) shake = 0.6; } }
    if (counter) { player.counterT = 0; prompt(t('counter') + '!'); }
  } else if (mv.kind === 'proj') { sfx.shoot(); fireProj(player.pos.clone().addScaledVector(f, 0.8), f, mv.speed!, mv.radius!, mv.dmg, mv.posture, true, mv.color, mv.burn, mv.id === 'aura'); }
  else if (mv.kind === 'dash') { sfx.dash(); player.dashT = mv.range / 30; player.dashDir.copy(f); player.iframes = player.dashT + 0.1; player.dashMove = mv; player.dashHit.clear(); }
  else if (mv.kind === 'aoe') {
    if (mv.count) { player.ccT = 0; player.ccN = mv.count; player.ccMove = mv; }
    else aoeHit(mv);
  } else if (mv.kind === 'cone') { player.cone = mv.count!; player.coneMove = mv; player.coneT = 0; }
  if (i > 0) player.counterT = player.counterT; // counter only on basic
}
function aoeHit(mv: Move) {
  sfx.heavy(); flashRing(player.pos, mv.range, mv.color, 0.4); burst(player.pos.clone().setY(0.6), mv.color, 50, 10, 3, 0.6); shake = Math.max(shake, 0.3);
  for (const e of [...enemies]) if (e.pos.distanceTo(player.pos) < mv.range + 0.5) damageEnemy(e, mv.dmg, mv.posture, player.pos, { burn: mv.burn, kb: 8 });
}
const projGeoMat = new Map<number, THREE.SpriteMaterial>();
function fireProj(p: THREE.Vector3, dir: THREE.Vector3, spd: number, r: number, dmg: number, posture: number, mine: boolean, color: number, burn = false, homing = false) {
  let mat = projGeoMat.get(color); if (!mat) { mat = new THREE.SpriteMaterial({ map: dotTex, color: new THREE.Color(color).multiplyScalar(2.2), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); projGeoMat.set(color, mat); }
  const s = new THREE.Sprite(mat); s.scale.setScalar(r * 2.6); scene.add(s); p.y = 1;
  projs.push({ mesh: s, pos: p.clone(), vel: dir.clone().setY(0).normalize().multiplyScalar(spd), r, dmg, posture, mine, life: 2.2, color, burn, homing });
}
function addShock(p: THREE.Vector3, max: number, spd: number, dmg: number) { const m = groundRing(0.85, 1, dmg ? 0xff3fd2 : 0xffffff, 0.9, 96); m.position.x = p.x; m.position.z = p.z; m.position.y = heightAt(m.position.x, m.position.z) + 0.06; shock.push({ mesh: m, r: 0.5, spd, max, dmg, hit: false }); }
function swapTo(i: number, forced = false) {
  if (mode !== 'play' || i === active || !team[i] || team[i].hp <= 0 || (!forced && player.swapCd > 0)) return;
  active = i; player.swapCd = 0.8; const m = team[i], s = m.sp.stages[m.stage];
  player.bb.setSpecies(s.dex, s.scale); sfx.swap(); burst(player.pos.clone().setY(1), parseInt(m.sp.color.slice(1), 16), 40, 8, 4, 0.6); flashRing(player.pos, 2.5, parseInt(m.sp.color.slice(1), 16));
  playerLight.color.set(m.sp.color); refreshMoveHud();
  // swap-in shockwave
  for (const e of enemies) if (e.pos.distanceTo(player.pos) < 3) damageEnemy(e, 8, 15, player.pos, { kb: 7 });
}
function cancelTele(u: Unit) { if (u.tele) { scene.remove(u.tele); u.tele = null; } }
function teleRing(u: Unit, r: number, at?: THREE.Vector3) { cancelTele(u); u.tele = groundRing(r * 0.9, r, 0xff2a3c, 0.75); u.tele.position.x = (at || u.pos).x; u.tele.position.z = (at || u.pos).z; u.tele.position.y = heightAt(u.tele.position.x, u.tele.position.z) + 0.06; }

// ---------- enemy AI ----------
function updateEnemy(u: Unit, dt: number) {
  u.prev.copy(u.pos); u.lastHit += dt; if (u.inv > 0) u.inv -= dt;
  if (u.burn > 0) { u.burn -= dt; if (Math.random() < dt * 2) { u.hp -= 3; dmgNum(u.pos, '3'); if (u.hp <= 0) { killEnemy(u); return; } } trail(u.pos.clone().setY(1), 0xff6a1a); }
  if (u.lastHit > 1.5 && u.stagger <= 0) u.posture = Math.max(0, u.posture - dt * u.maxPosture * 0.12);
  u.pos.addScaledVector(u.kb, dt); u.kb.multiplyScalar(Math.pow(0.002, dt));
  const toP = player.pos.clone().sub(u.pos).setY(0), dist = toP.length(); toP.normalize();
  if (u.stagger > 0) { u.stagger -= dt; if (Math.random() < dt * 8) burst(u.pos.clone().setY(1.6 * u.def.scale), 0xffd23f, 1, 1, 1, 0.4); finishUnit(u, dt); return; }
  if (u.boss) { bossAI(u, dt, toP, dist); finishUnit(u, dt); return; }
  if (!u.aggro) { if (dist < 13 || u.lastHit < 0.1) { for (const o of enemies) if (o.camp === u.camp) o.aggro = true; } else { u.bb.play('Idle'); finishUnit(u, dt); return; } }
  if (u.camp >= 0 && u.pos.distanceTo(u.home) > 30 && dist > 18) { u.aggro = false; u.pos.lerp(u.home, dt); }
  u.cd -= dt; const want = u.def.ranged ? 7 : 1.6;
  if (u.state === 'chase') {
    if (dist > want) { u.pos.addScaledVector(toP, u.def.speed * dt); u.bb.play('Walk'); } else if (u.def.ranged && dist < want - 2) { u.pos.addScaledVector(toP, -u.def.speed * 0.6 * dt); u.bb.play('Walk'); } else u.bb.play('Idle');
    u.bb.setFacing(toP.x, toP.z);
    if (u.cd <= 0 && dist < want + 1.5) { u.state = 'wind'; u.st = u.def.ranged ? 0.7 : 0.6; if (!u.def.ranged) teleRing(u, 1.3); else teleRing(u, 0.9); }
  } else if (u.state === 'wind') {
    u.st -= dt; u.bb.setFacing(toP.x, toP.z); if (u.tele) { (u.tele.material as THREE.MeshBasicMaterial).color.setHex(u.st < 0.2 ? 0xffffff : 0xff2a3c); u.tele.position.x = u.pos.x; u.tele.position.z = u.pos.z; u.tele.position.y = heightAt(u.tele.position.x, u.tele.position.z) + 0.06; }
    if (u.st <= 0) { cancelTele(u); u.bb.play('Attack', true, true);
      if (u.def.ranged) { fireProj(u.pos.clone(), toP, 11, 0.4, u.def.dmg, 0, false, u.def.color); }
      else { u.lungeDir.copy(toP); u.pos.addScaledVector(toP, Math.min(1.2, Math.max(0, dist - 1))); if (u.pos.distanceTo(player.pos) < 1.9) hurtPlayer(u.def.dmg, u.pos, u); sfx.swing(); }
      u.state = 'recover'; u.st = 0.7; u.cd = 1.5 + Math.random() * 1.2; }
  } else if (u.state === 'recover') { u.st -= dt; if (u.st <= 0) u.state = 'chase'; }
  finishUnit(u, dt);
}
function finishUnit(u: Unit, dt: number) {
  for (const o of enemies) if (o !== u) { const d = u.pos.clone().sub(o.pos).setY(0); const l = d.length(), min = 1.1 * (u.def.scale + o.def.scale) / 2; if (l < min && l > 0.001) u.pos.addScaledVector(d.normalize(), (min - l) * 0.5); }
  collide(u.pos, 0.45 * u.def.scale, u.prev);
  if (u.state !== 'tele') u.bb.group.visible = true;
  u.bb.group.position.copy(u.pos); u.bb.group.position.y = heightAt(u.pos.x, u.pos.z) + (u.boss ? 0.4 + Math.sin(runTime * 2) * 0.25 : 0);
  u.bb.update(dt, camera); if (!u.boss) drawHb(u);
}
function bossAI(u: Unit, dt: number, toP: THREE.Vector3, dist: number) {
  const ph = u.bar; u.cd -= dt; u.bb.setFacing(toP.x, toP.z);
  if (Math.random() < dt * 2) trail(u.pos.clone().setY(1 + Math.random() * 2), BOSS_BARS[ph]);
  if (u.inv > 0) return;
  if (u.state === 'chase') {
    if (dist > 6) { u.pos.addScaledVector(toP, u.def.speed * 0.6 * dt); u.bb.play('Walk'); } else if (dist < 4) { u.pos.addScaledVector(toP, -u.def.speed * 0.5 * dt); u.bb.play('Walk'); } else u.bb.play('Idle');
    if (u.cd <= 0) {
      const pats = ph === 0 ? ['fan', 'tele'] : ph === 1 ? ['fan', 'tele', 'ring', 'fan2'] : ['ring', 'tele', 'shock', 'fan2', 'shock'];
      u.pat = (u.pat + 1) % pats.length; u.state = pats[u.pat]; u.st = 0; u.cd = Math.max(0.7, 2.1 - ph * 0.55);
      if (u.state === 'tele') { const a = Math.random() * Math.PI * 2; u.lungeDir.set(player.pos.x + Math.cos(a) * 2.2, 0, player.pos.z + Math.sin(a) * 2.2); teleRing(u, 3, player.pos); }
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
    if (u.st > 0.6 && u.st - dt <= 0.6) { u.bb.play('Attack', true, true); sfx.shoot(); const n = 14; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + runTime; fireProj(u.pos.clone(), V(Math.cos(a), 0, Math.sin(a)), 9, 0.6, u.def.dmg, 0, false, 0x5a2aff); } }
    if (u.st > 1.1) u.state = 'chase';
  } else if (u.state === 'tele') {
    if (u.tele) { u.tele.position.x = player.pos.x; u.tele.position.z = player.pos.z; u.tele.position.y = heightAt(u.tele.position.x, u.tele.position.z) + 0.06; (u.tele.material as THREE.MeshBasicMaterial).color.setHex(u.st > 0.7 ? 0xffffff : 0xff2a3c); }
    if (u.st > 0.4 && u.st - dt <= 0.4) { burst(u.pos.clone().setY(1), 0xc06bff, 30, 6, 3, 0.5); u.bb.group.visible = false; }
    if (u.st > 0.9) { const at = u.tele ? V(u.tele.position.x, 0, u.tele.position.z) : player.pos.clone(); cancelTele(u); u.pos.copy(at).add(V(0, 0, -1.6)); u.bb.group.visible = true; u.bb.play('Attack', true, true);
      burst(at.clone().setY(0.5), 0xff3fd2, 50, 10, 4, 0.6); flashRing(at, 3, 0xff3fd2); sfx.heavy(); shake = Math.max(shake, 0.5);
      if (player.pos.distanceTo(at) < 3) hurtPlayer(u.def.dmg * 1.6, at, u); u.state = 'recover2'; u.st = 0; }
  } else if (u.state === 'shock') {
    if (u.tele) (u.tele.material as THREE.MeshBasicMaterial).color.setHex(u.st > 0.5 ? 0xffffff : 0xff2a3c);
    if (u.st > 0.7) { cancelTele(u); addShock(u.pos, 18, 9, u.def.dmg * 1.2); u.bb.play('Attack', true, true); sfx.heavy(); shake = 0.4; u.state = 'recover2'; u.st = 0; }
  } else if (u.state === 'recover2' || u.state === 'recover') { if (u.st > 0.8 - ph * 0.15) u.state = 'chase'; }
}

// ---------- main update ----------
const camTarget = V(); const playerPrev = V(); let menuT = 0;
function updatePlay(dt: number) {
  runTime += dt; const m = team[active]; const st = stats(m);
  for (const mm of team) mm.cds = mm.cds.map((c) => Math.max(0, c - dt));
  player.dashCd -= dt; player.parryCd -= dt; player.iframes -= dt; player.parryT -= dt; player.counterT -= dt; player.swapCd -= dt;
  playerPrev.copy(player.pos);
  // movement
  const mv = V(); if (keys.has('w') || keys.has('arrowup')) mv.z -= 1; if (keys.has('s') || keys.has('arrowdown')) mv.z += 1; if (keys.has('a') || keys.has('arrowleft')) mv.x -= 1; if (keys.has('d') || keys.has('arrowright')) mv.x += 1;
  if (stickVec.lengthSq() > 0.02) mv.set(stickVec.x, 0, stickVec.y); if (mv.lengthSq() > 1) mv.normalize();
  // aim
  if (lockT && !enemies.includes(lockT)) lockT = null;
  if (lockT) player.face.copy(lockT.pos).sub(player.pos).setY(0).normalize();
  else if (!isTouch && mouseOnScreen) { const g = mouseGround(); if (g) { const d = g.sub(player.pos).setY(0); if (d.lengthSq() > 0.05) player.face.copy(d.normalize()); } }
  else { const n = nearestEnemy(player.pos, 11); if (n) player.face.copy(n.pos).sub(player.pos).setY(0).normalize(); else if (mv.lengthSq() > 0.01) player.face.copy(mv).normalize(); }
  // actions
  if (pressed.has('1')) swapTo(0); if (pressed.has('2')) swapTo(1); if (pressed.has('3')) swapTo(2);
  if (pressed.has('tab')) { if (lockT) { const others = enemies.filter((e) => e !== lockT); lockT = others.length && enemies.length > 1 ? nearestEnemy(player.pos.clone().addScaledVector(player.face, 4)) : null; if (lockT === null || lockT === undefined) lockT = null; } else lockT = nearestEnemy(player.pos); }
  if ((pressed.has(' ') || pressed.has('shift')) && player.dashCd <= 0 && player.dashT <= 0) { player.dashT = 0.17; player.dashDir.copy(mv.lengthSq() > 0.01 ? mv.clone().normalize() : player.face); player.iframes = 0.32; player.dashCd = 0.55; player.dashMove = null; sfx.dash(); }
  if (pressed.has('f') && player.parryCd <= 0) { player.parryT = 0.24; player.parryCd = 0.55; flashRing(player.pos, 1.3, 0xffe35a, 0.24); }
  if (pressed.has('atk') || mouseDown || atkHeld) useMove(0);
  if (pressed.has('q')) useMove(1); if (pressed.has('e')) useMove(2); if (pressed.has('r')) useMove(3);
  // move
  if (player.dashT > 0) { player.dashT -= dt; const sp = player.dashMove ? 30 : 19; player.pos.addScaledVector(player.dashDir, sp * dt); trail(player.pos.clone().setY(0.8), player.dashMove ? player.dashMove.color : 0x8f6bff); trail(player.pos.clone().setY(1.2), 0xffffff);
    if (player.dashMove) for (const e of [...enemies]) if (!player.dashHit.has(e) && e.pos.distanceTo(player.pos) < 1.6 * e.def.scale) { player.dashHit.add(e); damageEnemy(e, player.dashMove.dmg, player.dashMove.posture, player.pos, { kb: 9 }); sfx.hit(); hitstopFor(0.05); }
  } else { player.pos.addScaledVector(mv, m.sp.speed * st.spd * dt); }
  collide(player.pos, 0.45, playerPrev);
  updateWorld(runTime, dt, camTarget);
  followSun(player.pos.x, player.pos.z); if (Math.floor(runTime * 6) !== Math.floor((runTime - dt) * 6)) { reveal(player.pos); for (const c of world.camps) if (!c.found && c.pos.distanceTo(player.pos) < 20) c.found = true; }
  setBeam(shrineOpen() ? 1 : 0, runTime);
  if (!bossSpawned && mode === 'play' && player.pos.distanceTo(world.shrine) < 13) { if (shrineOpen()) spawnBoss(); else if (false) prompt(t('sealed', { n: SHRINE_NEED - campsDone() }), 1.6); }
  // continuous moves
  if (player.cone > 0) { player.coneT -= dt; if (player.coneT <= 0) { player.coneT = 0.05; player.cone--; const mvv = player.coneMove!; const a = Math.atan2(player.face.z, player.face.x) + (Math.random() - 0.5) * 0.5; fireProj(player.pos.clone().addScaledVector(player.face, 0.8), V(Math.cos(a), 0, Math.sin(a)), 16, 0.5, mvv.dmg, mvv.posture, true, mvv.color, true); if (player.cone % 3 === 0) sfx.shoot(); } }
  if (player.ccN > 0) { player.ccT -= dt; if (player.ccT <= 0) { player.ccT = 0.12; player.ccN--; aoeHit({ ...player.ccMove!, dmg: player.ccMove!.dmg / player.ccMove!.count!, posture: player.ccMove!.posture / player.ccMove!.count! }); hitstopFor(0.04); } }
  // anim
  player.bb.setFacing(player.face.x, player.face.z);
  if (player.bb.anim !== 'Attack' && player.bb.anim !== 'Hurt') player.bb.play(mv.lengthSq() > 0.01 ? 'Walk' : 'Idle');
  player.bb.group.position.copy(player.pos); player.bb.group.position.y = heightAt(player.pos.x, player.pos.z); player.bb.update(dt, camera); player.bb.mesh.visible = !(player.iframes > 0 && player.dashT <= 0 && Math.floor(runTime * 20) % 2 === 0);
  playerLight.position.set(player.pos.x, 1.6, player.pos.z);
  // enemies
  for (const e of [...enemies]) updateEnemy(e, dt);
  // projectiles
  for (let i = projs.length - 1; i >= 0; i--) { const p = projs[i]; p.life -= dt;
    if (p.homing && p.mine) { const n = nearestEnemy(p.pos, 8); if (n) { const d = n.pos.clone().sub(p.pos).setY(0).normalize().multiplyScalar(p.vel.length()); p.vel.lerp(d, Math.min(1, dt * 4)); } }
    p.pos.addScaledVector(p.vel, dt); p.mesh.position.copy(p.pos); if (Math.random() < 0.6) trail(p.pos, p.color);
    p.mesh.position.y = p.pos.y + heightAt(p.pos.x, p.pos.z); let dead = p.life <= 0 || projBlocked(p.pos);
    if (dead && p.life > 0) burst(p.pos.clone(), p.color, 8, 4, 2, 0.3);
    if (!dead && p.mine) { for (const e of [...enemies]) if (e.pos.clone().setY(1).distanceTo(p.pos) < p.r + 0.6 * e.def.scale) { damageEnemy(e, p.dmg, p.posture, p.pos, { burn: p.burn }); sfx.hit(); burst(p.pos, p.color, 14, 6, 2, 0.4); dead = p.r < 1; if (dead) break; } }
    else if (!dead && p.pos.clone().setY(0).distanceTo(player.pos) < p.r + 0.5) { const hit = hurtPlayer(p.dmg, p.pos, null, p); if (hit || player.iframes > 0 && !p.mine) dead = hit; }
    if (dead) { scene.remove(p.mesh); projs.splice(i, 1); }
  }
  // shockwaves
  for (let i = shock.length - 1; i >= 0; i--) { const s = shock[i]; s.r += s.spd * dt; s.mesh.scale.setScalar(s.r); (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - s.r / s.max);
    if (s.dmg && !s.hit) { const d = player.pos.distanceTo(V(s.mesh.position.x, 0, s.mesh.position.z)); if (Math.abs(d - s.r) < 0.7) { if (hurtPlayer(s.dmg, s.mesh.position, null)) s.hit = true; } }
    if (s.r >= s.max) { scene.remove(s.mesh); shock.splice(i, 1); } }
  // lock line
  if (lockT) { const a = player.pos.clone().setY(0.6), b = lockT.pos.clone().setY(0.6); lockLine.geometry.setFromPoints([a, b]); lockLine.computeLineDistances(); lockLine.visible = true; } else lockLine.visible = false;
  // level-ups when out of combat; slow regen while exploring
  const inCombat = enemies.some((e) => e.aggro);
  if (!inCombat) { if (pendingLevel.length) { showLevelUp(); return; } if (m.hp > 0) m.hp = Math.min(maxHp(m), m.hp + maxHp(m) * 0.03 * dt); }
  // camera
  camTarget.lerp(player.pos.clone().addScaledVector(player.face, 1.2), Math.min(1, dt * 5));
}
function updateCamera(dt: number) {
  const portraitish = innerWidth / innerHeight < 1.2;
  if (mode === 'menu') { menuT += dt * 0.15; camera.position.set(Math.sin(Math.sin(menuT) * 0.5) * 16, 6.5, Math.cos(Math.sin(menuT) * 0.5) * 16); camera.lookAt(0, 2.2, 0); }
  else { const h = isTouch ? 17 : 19, b = isTouch ? 9 : 10; camera.position.set(camTarget.x, h * (portraitish ? 1.3 : 1), camTarget.z + b); camera.lookAt(camTarget.x, 0.8, camTarget.z); }
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 2.2); }
}

// ---------- flow ----------
function newRun() {
  for (const e of enemies) { cancelTele(e); scene.remove(e.bb.group); } enemies = []; for (const p of projs) scene.remove(p.mesh); projs = []; for (const s of shock) scene.remove(s.mesh); shock = []; clearFx();
  team = TEAM.map((sp, i) => { const ms = save.members[i]; const m: Member = { sp, ms, hp: 0, cds: [0, 0, 0, 0], stage: stageOf(sp, ms.level) }; m.hp = maxHp(m); return m; });
  active = 0; const s = team[0].sp.stages[team[0].stage]; player.bb.setSpecies(s.dex, s.scale); playerLight.color.set(team[0].sp.color);
  buildWorld(save.quality === 'low'); world.group.visible = true; setZone(true); resetFog();
  player.pos.copy(world.start); player.face.set(0, 0, -1); reveal(player.pos); Object.assign(player, { dashT: 0, iframes: 0, parryT: 0, counterT: 0, cone: 0, ccN: 0, swapCd: 0 });
  waveIdx = 0; waveDelay = 1.2; runTime = 0; kills = 0; bossSpawned = false; firstWaveStarted = false; lockT = null; pendingLevel.length = 0; camTarget.copy(player.pos); spawnCamps();
  buildTeamHud(); showScreen(null); $('#hud').classList.remove('hidden'); $('#touch').classList.toggle('hidden', !isTouch); showA.group.visible = showB.group.visible = false; player.bb.group.visible = true;
  mode = 'play'; banner(t('explore'), '#b9b3ff', 3);
}
function toMenu() {
  mode = 'menu'; for (const e of enemies) { cancelTele(e); scene.remove(e.bb.group); } enemies = []; for (const p of projs) scene.remove(p.mesh); projs = []; for (const s of shock) scene.remove(s.mesh); shock = []; clearFx(); lockLine.visible = false;
  world.group.visible = false; setZone(false); followSun(0, 0);
  $('#hud').classList.add('hidden'); $('#touch').classList.add('hidden'); hideModal(); showScreen('title'); showA.group.visible = showB.group.visible = true; player.bb.group.visible = false;
}
function pauseGame() { mode = 'pause'; modal(t('paused'), '', [[t('resume'), resume], [t('options'), () => { hideModal(); showScreen('optScr', true); }], [t('menu'), toMenu]]); }
function resume() { hideModal(); showScreen(null); mode = 'play'; }
$('#pauseBtn').addEventListener('pointerdown', (e) => { e.stopPropagation(); if (mode === 'play') pauseGame(); });
function showLevelUp() {
  const i = pendingLevel.shift()!; const m = team[i]; mode = 'modal'; sfx.level();
  const picks = [...UPGRADES].sort(() => Math.random() - 0.5).slice(0, 3);
  modal(t('levelUp'), `<p><img src="${portrait(m.sp.stages[m.stage].dex)}" style="width:40px;vertical-align:middle;image-rendering:pixelated"> <b>${mname(m)}</b> — ${t('level')} ${m.ms.level}</p><div class="picks"></div>`, []);
  const box = document.querySelector('#mbody .picks')!;
  picks.forEach((u) => { const b = document.createElement('button'); b.textContent = t(u); b.onclick = () => { m.ms.upgrades.push(u); persist(); if (u === 'u_hp') m.hp += 25; sfx.ui(); hideModal(); mode = 'play'; buildTeamHud(); }; box.appendChild(b); });
}
function endRun(win: boolean) {
  if (mode === 'end' || mode === 'menu') return; mode = 'end'; persist();
  if (win && (save.best === null || runTime < save.best)) { save.best = runTime; persist(); }
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  modal(win ? t('victory') : t('defeat'), `<p>${t('time')}: <b>${fmt(runTime)}</b> · ${t('kills')}: <b>${kills}</b>${save.best ? ` · ${t('best')}: <b>${fmt(save.best)}</b>` : ''}</p><p>${team.map((m) => `${mname(m)} ${t('level')} ${m.ms.level}`).join(' · ')}</p>`, [[t('retry'), () => { hideModal(); newRun(); }], [t('menu'), toMenu]]);
}
function modal(title: string, html: string, btns: [string, () => void][]) {
  $('#modal').classList.remove('hidden'); $('#mtitle').textContent = title; $('#mbody').innerHTML = html;
  if (btns.length) { const d = document.createElement('div'); d.className = 'mbtns'; btns.forEach(([l, f]) => { const b = document.createElement('button'); b.textContent = l; b.onclick = () => { sfx.ui(); f(); }; d.appendChild(b); }); $('#mbody').appendChild(d); }
}
function hideModal() { $('#modal').classList.add('hidden'); }
let returnToPause = false;
function showScreen(id: string | null, fromPause = false) {
  returnToPause = fromPause;
  ['title', 'teamScr', 'optScr', 'credScr'].forEach((s) => $('#' + s).classList.toggle('hidden', s !== id));
  if (id === 'teamScr') buildTeamScreen(); if (id === 'optScr') syncOptions();
}
document.querySelectorAll<HTMLElement>('[data-go]').forEach((b) => b.addEventListener('click', () => {
  initAudio(); startMusic(); sfx.ui(); const g = b.dataset.go!;
  if (g === 'play') newRun(); else if (g === 'title' && returnToPause) { showScreen(null); pauseGame(); } else showScreen(g);
}));
function buildTeamScreen() {
  const el = $('#teamCards'); el.innerHTML = '';
  TEAM.forEach((sp, i) => {
    const ms = save.members[i], m = { sp, ms }, stg = sp.stages[stageOf(sp, ms.level)], nextEvo = sp.stages.find((s) => s.level > ms.level);
    const d = document.createElement('div'); d.className = 'card'; d.style.setProperty('--c', sp.color);
    d.innerHTML = `<div class="hd"><img src="${portrait(stg.dex)}"><div><h3>${stg.name}</h3>${t('level')} ${ms.level}${nextEvo ? ` → ${nextEvo.name} (${t('level')} ${nextEvo.level})` : ''}</div></div>
      <div class="xp"><i style="width:${(100 * ms.xp) / xpFor(ms.level)}%"></i></div>
      <b>${t('moves')}</b><ul class="mv">${sp.moves.map((mv, k) => `<li>[${['LMB', 'Q', 'E', 'R'][k]}] ${moveName(mv)}</li>`).join('')}</ul>
      <b>${t('item')}</b><select>${['', ...ITEMS].map((it) => `<option value="${it}" ${ms.item === (it || null) ? 'selected' : ''}>${it ? t(it) : t('none')}</option>`).join('')}</select>
      <div style="margin-top:4px"><b>${t('talents')}</b>: ${ms.upgrades.length ? Object.entries(ms.upgrades.reduce((a: any, u) => ((a[u] = (a[u] || 0) + 1), a), {})).map(([u, n]) => `${t(u)}${(n as number) > 1 ? ' ×' + n : ''}`).join(', ') : '—'}</div>
      <div style="opacity:.7;margin-top:3px">HP ${sp.hp + stats(m).hp}</div>`;
    d.querySelector('select')!.addEventListener('change', (e) => { ms.item = (e.target as HTMLSelectElement).value || null; persist(); buildTeamScreen(); });
    el.appendChild(d);
  });
}
function syncOptions() {
  document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === getLang()));
  document.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.classList.toggle('on', b.dataset.q === save.quality));
  ($('#volMusic') as HTMLInputElement).value = String(save.music); ($('#volSfx') as HTMLInputElement).value = String(save.sfx);
  $('#ctrlText').innerHTML = `${t('ctrlDesk')}<br><br>${t('ctrlMob')}`;
}
document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang!); syncOptions(); if (team.length) buildTeamHud(); }));
document.querySelectorAll<HTMLElement>('[data-q]').forEach((b) => b.addEventListener('click', () => { save.quality = b.dataset.q as any; persist(); setupQuality(); syncOptions(); }));
$('#volMusic').addEventListener('input', (e) => { save.music = +(e.target as HTMLInputElement).value; persist(); applyVolumes(); });
$('#volSfx').addEventListener('input', (e) => { save.sfx = +(e.target as HTMLInputElement).value; persist(); applyVolumes(); sfx.ui(); });
$('#resetBtn').addEventListener('click', () => { if (confirm(t('resetQ'))) { resetSave(); syncOptions(); } });
$('#credList').innerHTML = CREDITS.trim().split('\n').map((l) => `<li>${l.replace(/^- /, '').replace(/</g, '&lt;')}</li>`).join('');

// ---------- loop ----------
const clock = new THREE.Clock(); let time = 0;
function frame() {
  requestAnimationFrame(frame);
  const raw = Math.min(clock.getDelta(), 1 / 20); time += raw;
  let dt = raw; if (hitstop > 0) { hitstop -= raw; dt = raw * 0.05; }
  if (mode === 'play') updatePlay(dt);
  else if (mode === 'menu') { showA.update(raw, camera); showB.update(raw, camera); showB.group.position.y = 0.4 + Math.sin(time * 2) * 0.25; if (Math.random() < 0.3) { trail(V(-5, 1 + Math.random(), 1.5), 0x4fa3ff); trail(V(5, 1.5 + Math.random() * 1.5, -1.5), 0xc06bff); } }
  pressed.clear();
  updateFx(dt); updateFades(dt); updateNums(raw); updateCamera(raw);
  if (mode !== 'menu' && team.length) updateHud();
  if (bannerTimer > 0) { bannerTimer -= raw; if (bannerTimer <= 0) $('#banner').classList.remove('show'); }
  if (promptTimer > 0) { promptTimer -= raw; if (promptTimer <= 0) $('#prompt').textContent = ''; }
  render(time);
}
async function boot() { setGroundFn(heightAt);
  applyI18n(); setLang(getLang()); setupQuality();
  await Promise.all([...['0448', '0150', '0004', '0007'].map(loadSpecies), loadWorldAssets()]).catch((e) => console.warn(e));
  $('#loading').classList.add('hidden'); frame();
  TEAM.flatMap((s) => s.stages.map((x) => x.dex)).concat(Object.values(ENEMIES).map((e) => e.dex)).forEach((d) => loadSpecies(d));
}
(window as any).__game = { get mode() { return mode; }, get enemies() { return enemies; }, get team() { return team; }, swapTo, spawnBoss, world, player, clearCamps: () => { [...enemies].forEach((e) => damageEnemy(e, 9999, 0, player.pos)); }, tp: (x: number, z: number) => player.pos.set(x, 0, z), kill: () => [...enemies].forEach((e) => damageEnemy(e, 9999, 0, player.pos)) };
boot();
// iOS Safari: block double-tap / pinch zoom while playing
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastTouchEnd < 350 && !(e.target as HTMLElement).closest('input,select')) e.preventDefault(); lastTouchEnd = n; }, { passive: false });
for (const sel of ['#touch', '#gl', '#hud']) document.querySelector(sel)!.addEventListener('touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
