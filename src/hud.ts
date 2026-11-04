// In-game HUD: party, move bar, cooldowns, boss bar, minimap, quest tracker, context buttons.
import { t } from './i18n';
import { BOSS_BARS } from './data';
import { save } from './save';
import { camera } from './scene';
import { drawMinimap, world } from './world';
import { ZONES, QUESTS } from './zones';
import { mon, nameOf, dexStr, movesOf, LEARN, hex, TYPE_COLOR, xpFor } from './dex';
import { portrait } from './sprites';
import { G, $, L, player, isTouch, maxHp, moveName, stats } from './state';
import { swapTo, unlocked } from './combat';
import { catchTarget } from './catch';
import { nearNpc, npcObjs, qTitle, active as activeQuests } from './npcs';

export function buildTeamHud() {
  const el = $('#team'); el.innerHTML = '';
  G.team.forEach((m, i) => {
    const d = document.createElement('div'); d.className = 'pm'; d.style.setProperty('--c', hex(TYPE_COLOR[mon(m.ms.id).t[0]]));
    d.innerHTML = `<img src="${portrait(dexStr(m.ms.id))}"><div><div class="nm">${nameOf(m.ms.id)} <span class="k">${t('level')}${m.ms.lv}${isTouch ? '' : ` · [${i + 1}]`}</span></div><div class="hp"><i></i></div><div class="xp"><i></i></div></div>`;
    d.addEventListener('pointerdown', (e) => { e.stopPropagation(); swapTo(i); }); el.appendChild(d);
  });
  const mv = $('#moves'); mv.innerHTML = '';
  ['LMB', 'Q', 'E', 'R'].forEach((k) => { const d = document.createElement('div'); d.className = 'mvb'; mv.appendChild(d); d.innerHTML = `<b>${k}</b><span></span><div class="cd"></div>`; });
  refreshMoveHud();
}
export function refreshMoveHud() {
  const m = G.team[G.active]; if (!m) return; const mvs = movesOf(m.ms.id);
  document.querySelectorAll<HTMLElement>('#moves .mvb').forEach((d, i) => {
    d.style.setProperty('--c', hex(mvs[i].color)); const lk = !unlocked(m, i); d.classList.toggle('locked', lk);
    d.querySelector('span')!.textContent = lk ? `🔒 ${t('level')}${LEARN[i]}` : moveName(mvs[i]);
  });
  ['atk', 'q', 'e', 'r'].forEach((a, i) => { const b = document.querySelector<HTMLElement>(`#tbtns [data-a=${a}]`); if (!b) return; b.classList.toggle('locked', !unlocked(m, i)); b.style.setProperty('--c', hex(mvs[i].color)); });
  document.querySelectorAll<HTMLElement>('#team .pm').forEach((d, i) => d.classList.toggle('on', i === G.active));
}
let mmT = 0; const mmCv = document.getElementById('minimap') as HTMLCanvasElement;
export function updateHud() {
  document.querySelectorAll<HTMLElement>('#team .pm').forEach((d, i) => {
    const m = G.team[i]; if (!m) return; (d.querySelector('.hp i') as HTMLElement).style.width = (100 * Math.max(0, m.hp)) / maxHp(m) + '%';
    (d.querySelector('.xp i') as HTMLElement).style.width = (100 * m.ms.xp) / xpFor(m.ms.lv) + '%'; d.classList.toggle('dead', m.hp <= 0);
  });
  const m = G.team[G.active]; if (!m) return; const cdm = stats(m.ms).cd, mvs = movesOf(m.ms.id);
  const cdEls = isTouch ? ['atk', 'q', 'e', 'r'].map((a) => document.querySelector(`#tbtns [data-a=${a}]`) as HTMLElement) : Array.from(document.querySelectorAll<HTMLElement>('#moves .mvb'));
  cdEls.forEach((d, i) => { if (!d) return; let c = d.querySelector('.cd') as HTMLElement; if (!c) { c = document.createElement('div'); c.className = 'cd'; d.appendChild(c); } c.style.height = Math.min(100, (100 * Math.max(0, m.cds[i])) / (mvs[i].cd * cdm)) + '%'; });
  const boss = G.enemies.find((e) => e.boss);
  $('#bossbar').classList.toggle('hidden', !boss);
  if (boss) {
    const per = boss.def.hp, bar = Math.min(2, Math.floor((boss.max - boss.hp) / per)), frac = (boss.hp - (2 - bar) * per) / per;
    const fill = $('.bfill'), under = $('.bunder'); fill.style.background = hex(BOSS_BARS[bar]);
    under.style.background = bar < 2 ? hex(BOSS_BARS[bar + 1]) : '#220810'; fill.style.transform = `scaleX(${Math.max(0, frac)})`;
    $('.bcount').textContent = '×' + (3 - bar);
  }
  const z = ZONES[G.curZone]; $('#wave').textContent = `${L(z.en, z.es)} · ${t('level')}${z.lv[0]}–${z.lv[1]}`;
  if ((mmT += 1) % 6 === 0) {
    const marks = G.enemies.filter((e) => e.pos.distanceTo(player.pos) < 60).map((e) => ({ x: e.pos.x, z: e.pos.z, c: e.boss ? '#c06bff' : e.alpha ? '#ffd23f' : e.aggro ? '#ff5a6a' : '#ffffffaa', r: e.alpha || e.boss ? 3 : 1.6 }));
    for (const o of npcObjs) marks.push({ x: o.pos.x, z: o.pos.z, c: '#5ae0ff', r: 2 });
    for (const w of world.ways) marks.push({ x: w.pos.x, z: w.pos.z, c: save.ways.includes(w.id) ? '#4fe3ff' : '#5a6a7a', r: 2.2 });
    drawMinimap(mmCv, player.pos, player.face, marks);
  }
  // quest tracker
  const qs = activeQuests().slice(0, 2);
  $('#track').innerHTML = qs.map((q) => { const s = save.quests[q.id]; return `<div class="${s.done ? 'dn' : ''}">${s.done ? '✔' : '•'} ${qTitle(q)} <b>${s.done ? L('Return', 'Volver') : s.p + '/' + q.n}</b></div>`; }).join('');
  // context buttons
  const ct = catchTarget(); $('#catchHint').style.display = ct && !isTouch ? 'block' : 'none'; if (ct) $('#catchHint').textContent = L('[C] Throw ball', '[C] Lanzar ball');
  document.querySelector<HTMLElement>('#tbtns [data-a=catch]')?.classList.toggle('ready', !!ct);
  const np = nearNpc(); const tk = $('#talk'); tk.style.display = np && G.mode === 'play' ? 'block' : 'none';
  if (np) tk.textContent = (isTouch ? '💬 ' : '[T] ') + L(np.n.en, np.n.es);
  const rt = $('#reticle');
  if (G.lockT && G.enemies.includes(G.lockT)) { const p = G.lockT.pos.clone(); p.y += 1.2 * G.lockT.def.scale; p.project(camera); rt.style.display = 'block'; rt.style.left = ((p.x + 1) / 2) * innerWidth + 'px'; rt.style.top = ((1 - p.y) / 2) * innerHeight + 'px'; }
  else rt.style.display = 'none';
}
export const questCount = () => QUESTS.filter((q) => save.quests[q.id]?.claimed).length;
