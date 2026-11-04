// In-game HUD: party, move bar, cooldowns, boss bar, minimap, quest tracker, context buttons.
import { t } from './i18n';
import { BOSS_BARS } from './data';
import { save } from './save';
import { camera } from './scene';
import { drawMinimap, world } from './world';
import { ZONES, QUESTS } from './zones';
import { mon, nameOf, dexStr, movesOf, LEARN, hex, TYPE_COLOR, xpFor, typeName } from './dex';
import { portrait } from './sprites';
import { G, $, L, player, isTouch, maxHp, moveName, stats } from './state';
import { swapTo, unlocked } from './combat';
import { catchTarget } from './catch';
import { nearNpc, npcObjs, qTitle, active as activeQuests } from './npcs';

const KIND: Record<string, [string, string]> = { melee: ['Melee', 'Cuerpo a cuerpo'], proj: ['Projectile', 'Proyectil'], aoe: ['Area', 'Área'], dash: ['Dash', 'Embestida'], cone: ['Channel', 'Canalizado'] };
const icon = (id: string) => `url(/icons/${id}.svg)`;
export function buildTeamHud() {
  const el = $('#team'); el.innerHTML = '';
  G.team.forEach((m, i) => {
    const d = document.createElement('div'); d.className = 'pm'; const tp = mon(m.ms.id).t; d.style.setProperty('--c', hex(TYPE_COLOR[tp[0]]));
    d.innerHTML = `<div class="pt"><img src="${portrait(dexStr(m.ms.id))}"><i class="lv">${m.ms.lv}</i></div><div class="bd"><div class="nm">${nameOf(m.ms.id)}${isTouch ? '' : ` <span class="k">[${i + 1}]</span>`}</div>`
      + `<div class="ty">${tp.map((x) => `<span style="--t:${hex(TYPE_COLOR[x])}">${typeName(x)}</span>`).join('')}</div><div class="hp"><i></i><em></em></div><div class="xp"><i></i></div></div>`;
    d.addEventListener('pointerdown', (e) => { e.stopPropagation(); swapTo(i); }); el.appendChild(d);
  });
  const mv = $('#moves'); mv.innerHTML = '';
  ['LMB', 'Q', 'E', 'R'].forEach((k) => { const d = document.createElement('div'); d.className = 'mvb'; mv.appendChild(d); d.innerHTML = `<div class="ic"></div><div class="cd"></div><span class="cdt"></span><b class="key">${k === 'LMB' ? '🖱' : k}</b><div class="tip"></div>`; });
  ['atk', 'q', 'e', 'r'].forEach((a) => { const b = document.querySelector<HTMLElement>(`#tbtns [data-a=${a}]`); if (b && !b.querySelector('.ic')) b.innerHTML = '<div class="ic"></div><div class="cd"></div><span class="cdt"></span>'; });
  refreshMoveHud();
}
export function refreshMoveHud() {
  const m = G.team[G.active]; if (!m) return; const mvs = movesOf(m.ms.id); const st = stats(m.ms);
  document.querySelectorAll<HTMLElement>('#moves .mvb').forEach((d, i) => {
    const mv = mvs[i]; d.style.setProperty('--c', hex(mv.color)); d.style.setProperty('--ic', icon(mv.id)); const lk = !unlocked(m, i); d.classList.toggle('locked', lk); d.classList.toggle('ult', i === 3);
    const k = KIND[mv.kind]; d.querySelector('.tip')!.innerHTML = `<h5>${moveName(mv)}</h5><p>${mv.type ? `<span class="tchip" style="--t:${hex(TYPE_COLOR[mv.type])}">${typeName(mv.type)}</span> ` : ''}${L(k[0], k[1])}</p>`
      + `<p>${L('Power', 'Potencia')} <b>${Math.round(mv.dmg * st.pow)}</b> · ${L('Cooldown', 'Recarga')} <b>${(mv.cd * st.cd).toFixed(1)}s</b></p>${lk ? `<p class="lk">🔒 ${t('level')} ${LEARN[i]}</p>` : ''}`;
  });
  ['atk', 'q', 'e', 'r'].forEach((a, i) => { const b = document.querySelector<HTMLElement>(`#tbtns [data-a=${a}]`); if (!b) return; b.classList.toggle('locked', !unlocked(m, i)); b.style.setProperty('--c', hex(mvs[i].color)); b.style.setProperty('--ic', icon(mvs[i].id)); });
  document.querySelectorAll<HTMLElement>('#team .pm').forEach((d, i) => d.classList.toggle('on', i === G.active));
}
let mmT = 0; const mmCv = document.getElementById('minimap') as HTMLCanvasElement;
export function updateHud() {
  document.querySelectorAll<HTMLElement>('#team .pm').forEach((d, i) => {
    const m = G.team[i]; if (!m) return; const mx = maxHp(m), hp = Math.max(0, m.hp), f = hp / mx; const bar = d.querySelector('.hp') as HTMLElement;
    (bar.firstElementChild as HTMLElement).style.width = 100 * f + '%'; bar.classList.toggle('low', f < 0.3); (d.querySelector('.hp em') as HTMLElement).textContent = `${Math.ceil(hp)} / ${mx}`;
    (d.querySelector('.xp i') as HTMLElement).style.width = (100 * m.ms.xp) / xpFor(m.ms.lv) + '%'; d.classList.toggle('dead', m.hp <= 0);
  });
  const m = G.team[G.active]; if (!m) return; const cdm = stats(m.ms).cd, mvs = movesOf(m.ms.id);
  const cdEls = isTouch ? ['atk', 'q', 'e', 'r'].map((a) => document.querySelector(`#tbtns [data-a=${a}]`) as HTMLElement) : Array.from(document.querySelectorAll<HTMLElement>('#moves .mvb'));
  cdEls.forEach((d, i) => { if (!d) return; const tot = mvs[i].cd * cdm * (i === 3 ? 1 : 1), left = Math.max(0, m.cds[i]); const p = Math.min(1, left / tot);
    d.style.setProperty('--p', String(p)); d.classList.toggle('cooling', left > 0.05); const ct = d.querySelector('.cdt') as HTMLElement | null;
    if (ct) ct.textContent = left > 0.05 && tot > 0.8 ? (left < 1 ? left.toFixed(1) : String(Math.ceil(left))) : '';
    if (left <= 0 && d.dataset.cd === '1') { d.classList.remove('ready'); void d.offsetWidth; d.classList.add('ready'); } d.dataset.cd = left > 0.05 && tot > 0.8 ? '1' : '0'; });
  const boss = G.enemies.find((e) => e.boss);
  $('#bossbar').classList.toggle('hidden', !boss);
  if (boss) {
    const per = boss.def.hp, bar = Math.min(2, Math.floor((boss.max - boss.hp) / per)), frac = (boss.hp - (2 - bar) * per) / per;
    const fill = $('.bfill'), under = $('.bunder'); fill.style.background = hex(BOSS_BARS[bar]);
    under.style.background = bar < 2 ? hex(BOSS_BARS[bar + 1]) : '#220810'; fill.style.transform = `scaleX(${Math.max(0, frac)})`;
    $('.bcount').textContent = '×' + (3 - bar);
  }
  const z = ZONES[G.curZone]; $('#wave').innerHTML = `<b>${L(z.en, z.es)}</b><small>${t('level')} ${z.lv[0]}–${z.lv[1]}</small>`;
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
