// Tabbed panel: Team & PC storage, Skill tree, Pokédex, Quest log, World map (fast travel).
import { t } from './i18n';
import { save, persist, monByUid, MonSave } from './save';
import { mapBase, mapFog, world, BX0, BZ0 } from './world';
import { ZONES, QUESTS } from './zones';
import { DEX, mon, nameOf, dexStr, evosOf, typeName, hex, TYPE_COLOR } from './dex';
import { TREE, spFree, spTotal, canLearn } from './skills';
import { portrait } from './sprites';
import { sfx } from './audio';
import { G, $, L, player, syncTeam, maxHpOf, toast } from './state';
import { evolveMember } from './combat';
import { stoneName, qTitle, qDesc, npcName } from './npcs';
import { NPCS } from './zones';

const TABS: [string, string, string][] = [['teamScr', 'Team', 'Equipo'], ['skillScr', 'Skills', 'Habilidades'], ['dexScr', 'Pokédex', 'Pokédex'], ['questScr', 'Quests', 'Misiones'], ['mapScr', 'Map', 'Mapa']];
let cur = 'teamScr', inGame = false, sel = 0;
let travelFn: (id: string) => void = () => {}; let closeFn: () => void = () => {};
export const initMenus = (travel: (id: string) => void, onClose: () => void) => { travelFn = travel; closeFn = onClose; };
export const panelOpen = () => !$('#panel').classList.contains('hidden');
export const inCombat = () => G.enemies.some((e) => e.aggro && e.pos.distanceTo(player.pos) < 30);

export function openPanel(id: string, game: boolean) {
  cur = id; inGame = game; if (game) G.mode = 'pause'; $('#panel').classList.remove('hidden'); sfx.ui(); refreshPanel();
}
export function closePanels() { $('#panel').classList.add('hidden'); closeFn(); }
export function refreshPanel() {
  const tabs = TABS.filter((x) => inGame || x[0] !== 'mapScr');
  $('#ptabs').innerHTML = tabs.map(([id, en, es]) => `<button data-tab="${id}" class="${id === cur ? 'on' : ''}">${L(en, es)}</button>`).join('') + `<button class="x" data-close>✕</button>`;
  $('#ptabs').querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => (b.onclick = () => { cur = b.dataset.tab!; sfx.ui(); refreshPanel(); }));
  ($('#ptabs').querySelector('[data-close]') as HTMLElement).onclick = closePanels;
  const body = $('#pbody'); body.scrollTop = 0;
  body.innerHTML = cur === 'teamScr' ? teamHtml() : cur === 'skillScr' ? skillHtml() : cur === 'dexScr' ? dexHtml() : cur === 'questScr' ? questHtml() : '<canvas id="bigmap"></canvas><div id="mapways"></div><p class="hint" id="maphint"></p>';
  body.querySelectorAll<HTMLElement>('[data-act]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); act(b.dataset.act!, b.dataset.v || ''); }));
  if (cur === 'mapScr') drawBigMap();
}
const card = (ms: MonSave, inner: string, cls = '') => `<div class="mc ${cls}" style="--c:${hex(TYPE_COLOR[mon(ms.id).t[0]])}"><img src="${portrait(dexStr(ms.id))}" loading="lazy"><div class="mi"><b>${nameOf(ms.id)}</b> <span>${t('level')}${ms.lv}</span><small>${mon(ms.id).t.map(typeName).join(' / ')} · ${maxHpOf(ms)} PS/HP</small>${inner}</div></div>`;
function teamHtml() {
  let h = `<h3>${L('Party', 'Equipo')} (${save.party.length}/3)</h3><div class="grid">`;
  save.party.forEach((uid, i) => {
    const ms = monByUid(uid); const stones = evosOf(ms.id).filter((e) => e.evo?.stone && save.stones[e.evo.stone]);
    const ev = stones.map((e) => `<button data-act="stone" data-v="${uid}:${e.id}">💎→ ${nameOf(e.id)}</button>`).join('');
    h += card(ms, `<div class="row">${save.party.length > 1 ? `<button data-act="box" data-v="${uid}">→ PC</button>` : ''}${i > 0 ? `<button data-act="up" data-v="${i}">▲</button>` : ''}<button data-act="sk" data-v="${uid}">✦ ${spFree(ms)}</button>${ev}</div>`);
  });
  h += `</div><h3>PC (${save.mons.length - save.party.length})</h3><p class="hint">${L('Tap to add to your party (max 3).', 'Toca para añadir al equipo (máx. 3).')}</p><div class="grid box">`;
  for (const ms of save.mons) if (!save.party.includes(ms.uid)) h += `<div data-act="party" data-v="${ms.uid}">${card(ms, '')}</div>`;
  const st = Object.entries(save.stones).filter(([, n]) => n > 0).map(([s, n]) => `💎 ${stoneName(s)} ×${n}`).join(' · ');
  return h + `</div><p class="hint">${st || L('No evolution stones yet.', 'Aún no tienes piedras evolutivas.')}</p>`;
}
function skillHtml() {
  const party = save.party.map(monByUid); const ms = party[Math.min(sel, party.length - 1)]; if (!ms) return '';
  let h = `<div class="seg">${party.map((m, i) => `<button data-act="sel" data-v="${i}" class="${m === ms ? 'on' : ''}">${nameOf(m.id)}</button>`).join('')}</div>`;
  h += `<p class="sp">${L('Skill points', 'Puntos de habilidad')}: <b>${spFree(ms)}</b> / ${spTotal(ms)} <button data-act="respec" data-v="${ms.uid}">${L('Reset', 'Reiniciar')}</button></p><div class="tree">`;
  for (const b of TREE) {
    h += `<div class="br" style="--c:${b.color}"><h4>${L(b.en, b.es)}</h4>`;
    b.nodes.forEach((n, i) => { const r = ms.sk[n.id] || 0; const ok = canLearn(ms, b, i); h += `<button class="node ${r ? 'has' : ''} ${ok ? 'ok' : ''}" ${ok ? `data-act="learn" data-v="${ms.uid}:${b.id}:${i}"` : 'disabled'}>${L(n.en, n.es)}<i>${r}/${n.max}</i></button>`; });
    h += '</div>';
  }
  return h + '</div>';
}
function dexHtml() {
  let h = `<p class="sp">${L('Seen', 'Vistos')} ${save.seen.length} · ${L('Caught', 'Capturados')} ${save.caught.length} / 151</p><div class="dex">`;
  for (const m of DEX) { const c = save.caught.includes(m.id), s = c || save.seen.includes(m.id);
    h += `<div class="dx ${c ? 'c' : s ? 's' : ''}"><img src="${s ? portrait(dexStr(m.id)) : ''}" loading="lazy" alt=""><small>#${String(m.id).padStart(3, '0')}</small><b>${s ? nameOf(m.id) : '???'}</b></div>`; }
  return h + '</div>';
}
function questHtml() {
  const st = (id: string) => save.quests[id];
  const list = QUESTS.filter((q) => st(q.id)); if (!list.length) return `<p class="hint">${L('Talk to townsfolk marked with ! to get quests.', 'Habla con los aldeanos marcados con ! para recibir misiones.')}</p>`;
  return list.map((q) => { const s = st(q.id); const n = NPCS.find((x) => x.id === q.npc)!;
    return `<div class="q ${s.claimed ? 'cl' : s.done ? 'dn' : ''}"><b>${s.claimed ? '✔' : s.done ? '★' : '•'} ${qTitle(q)}</b><p>${qDesc(q)}</p><small>${s.claimed ? L('Completed', 'Completada') : s.done ? L('Return to ', 'Vuelve con ') + npcName(n) : s.p + ' / ' + q.n}</small></div>`; }).join('');
}
function drawBigMap() {
  const cv = $('#bigmap') as HTMLCanvasElement; const W = mapBase.width, H = mapBase.height; cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!; g.drawImage(mapBase, 0, 0); g.drawImage(mapFog, 0, 0);
  g.fillStyle = '#fff'; g.font = 'bold 9px system-ui'; g.textAlign = 'center';
  ZONES.forEach((z) => { const c = z.circles[0]; if (c) { g.fillStyle = '#fffd'; g.fillText(`${L(z.en, z.es)} ${z.lv[0]}-${z.lv[1]}`, c[0] - BX0, c[1] - BZ0 - c[2] * 0.5); } });
  g.fillStyle = '#ff4060'; g.beginPath(); g.arc(player.pos.x - BX0, player.pos.z - BZ0, 4, 0, 7); g.fill();
  const box = $('#mapways'); const fight = inCombat();
  $('#maphint').textContent = fight ? L('Cannot travel while in combat.', 'No puedes viajar en combate.') : L('Tap an active waystone to fast-travel.', 'Toca un monolito activo para viajar.');
  box.innerHTML = world.ways.map((w) => { const on = save.ways.includes(w.id); const z = ZONES.find((x) => x.id === w.id);
    return `<button class="way ${on ? 'on' : ''}" style="left:${((w.pos.x - BX0) / W) * 100}%;top:${((w.pos.z - BZ0) / H) * 100}%" ${on && !fight ? `data-way="${w.id}"` : 'disabled'} title="${z ? L(z.en, z.es) : w.id}">◆</button>`; }).join('');
  box.querySelectorAll<HTMLElement>('[data-way]').forEach((b) => (b.onclick = () => { closePanels(); travelFn(b.dataset.way!); }));
}
function act(a: string, v: string) {
  sfx.ui();
  if (a === 'box') { save.party = save.party.filter((u) => u !== +v); }
  else if (a === 'party') { if (save.party.length >= 3) { toast(L('Party is full — send one to the PC first.', 'Equipo lleno: envía uno al PC primero.')); return; } save.party.push(+v); }
  else if (a === 'up') { const i = +v; [save.party[i - 1], save.party[i]] = [save.party[i], save.party[i - 1]]; }
  else if (a === 'sk') { sel = save.party.indexOf(+v); cur = 'skillScr'; }
  else if (a === 'sel') sel = +v;
  else if (a === 'stone') { const [uid, to] = v.split(':').map(Number); const ms = monByUid(uid); const s = mon(to).evo!.stone!; save.stones[s]--; persist(); closePanels(); evolveMember(ms, to); return; }
  else if (a === 'learn') { const [uid, bid, i] = v.split(':'); const ms = monByUid(+uid); const b = TREE.find((x) => x.id === bid)!; if (canLearn(ms, b, +i)) { const id = b.nodes[+i].id; ms.sk[id] = (ms.sk[id] || 0) + 1; } }
  else if (a === 'respec') { monByUid(+v).sk = {}; }
  persist(); syncTeam(); refreshPanel();
}
