// Town NPCs, talking, quest log progression and rewards.
import { t } from './i18n';
import { save, persist } from './save';
import { scene, camera } from './scene';
import { heightAt, addCol } from './world';
import { NPCS, QUESTS, Quest, Npc } from './zones';
import { dexStr, scaleOf } from './dex';
import { sfx } from './audio';
import { flashRing } from './fx';
import { Billboard, loadSpecies } from './sprites';
import { G, V, L, player, plate, modal, closeModal, toast, maxHp } from './state';
import { gainXp } from './combat';
import { openPanel } from './menus';

const STONE_N: Record<string, [string, string]> = { fire: ['Fire Stone', 'Piedra Fuego'], water: ['Water Stone', 'Piedra Agua'], thunder: ['Thunder Stone', 'Piedra Trueno'], leaf: ['Leaf Stone', 'Piedra Hoja'], moon: ['Moon Stone', 'Piedra Lunar'] };
export const stoneName = (s: string) => L(...(STONE_N[s] || [s, s]));
export const qTitle = (q: Quest) => L(q.en[0], q.es[0]);
export const qDesc = (q: Quest) => L(q.en[1], q.es[1]);
export const npcName = (n: Npc) => L(n.en, n.es);
export const available = (q: Quest) => !save.quests[q.id] && (!q.req || !!save.quests[q.req]?.claimed);
export const active = () => QUESTS.filter((q) => save.quests[q.id] && !save.quests[q.id].claimed);

interface NpcObj { n: Npc; bb: Billboard; mark: any; pos: ReturnType<typeof V>; }
export const npcObjs: NpcObj[] = [];
export function buildNpcs() {
  if (npcObjs.length) return;
  for (const n of NPCS) {
    loadSpecies(dexStr(n.dex)); const sc = scaleOf(n.dex); const bb = new Billboard(sc); bb.setSpecies(dexStr(n.dex), sc);
    const pos = V(n.at[0], 0, n.at[1]); bb.group.position.set(pos.x, heightAt(pos.x, pos.z), pos.z); bb.setFacing(0, 1); scene.add(bb.group); addCol(pos.x, pos.z, 0.6);
    const mark = plate(200, 56, 3.6); scene.add(mark); npcObjs.push({ n, bb, mark, pos });
  }
}
function markOf(n: Npc) {
  if (n.kind === 'heal') return '✚'; if (n.kind === 'pc' && !QUESTS.some((q) => q.npc === n.id && (available(q) || (save.quests[q.id]?.done && !save.quests[q.id].claimed)))) return '▣';
  const qs = QUESTS.filter((q) => q.npc === n.id);
  if (qs.some((q) => save.quests[q.id]?.done && !save.quests[q.id].claimed)) return '?';
  if (qs.some(available)) return '!'; return '';
}
export function updateNpcs(dt: number) {
  for (const o of npcObjs) {
    const d = o.pos.distanceTo(player.pos); o.bb.update(dt, camera); o.mark.visible = d < 40; if (!o.mark.visible) continue;
    const g = o.mark.ctx as CanvasRenderingContext2D; g.clearRect(0, 0, 200, 56); g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#000c';
    const m = markOf(o.n); if (m) { g.font = 'bold 26px system-ui'; g.fillStyle = m === '?' ? '#5ae0ff' : m === '!' ? '#ffd23f' : '#8fffb0'; g.strokeText(m, 100, 24); g.fillText(m, 100, 24); }
    g.font = 'bold 15px system-ui'; g.fillStyle = '#bfffcf'; g.strokeText(npcName(o.n), 100, 48); g.fillText(npcName(o.n), 100, 48); o.mark.material.map.needsUpdate = true;
    o.mark.position.set(o.pos.x, heightAt(o.pos.x, o.pos.z) + 1.7 * scaleOf(o.n.dex) + 0.9 + Math.sin(G.runTime * 3) * 0.08, o.pos.z);
  }
}
export function nearNpc() { let b: NpcObj | null = null, bd = 3.2; for (const o of npcObjs) { const d = o.pos.distanceTo(player.pos); if (d < bd) { bd = d; b = o; } } return b; }

export function questEvent(type: string, arg?: string, types?: string[]) {
  for (const q of QUESTS) {
    const s = save.quests[q.id]; if (!s || s.done || q.type !== type) continue;
    if (type === 'defeat' && q.arg && q.arg !== arg) continue;
    if ((type === 'defeatType' || type === 'catch') && q.arg && !types?.includes(q.arg)) continue;
    if ((type === 'alpha' || type === 'visit') && q.arg && q.arg !== arg) continue;
    s.p = Math.min(q.n, s.p + 1); if (s.p >= q.n) finishQ(q);
  }
  persist();
}
export function checkPassiveQuests() {
  for (const q of QUESTS) { const s = save.quests[q.id]; if (!s || s.done) continue;
    if (q.type === 'dex') { s.p = Math.min(q.n, save.caught.length); if (s.p >= q.n) finishQ(q); }
    if (q.type === 'visit' && save.ways.includes(q.arg!)) { s.p = 1; finishQ(q); } }
  persist();
}
function finishQ(q: Quest) { save.quests[q.id].done = true; sfx.level(); toast(`✔ ${qTitle(q)} — ${L('return to', 'vuelve con')} ${npcName(NPCS.find((n) => n.id === q.npc)!)}`); }
function claim(q: Quest) {
  const s = save.quests[q.id]; s.claimed = true; const ms = G.team[G.active].ms; ms.bsp += q.sp;
  G.team.forEach((_, i) => gainXp(i, i === G.active ? q.xp : q.xp * 0.5));
  if (q.stone) save.stones[q.stone] = (save.stones[q.stone] || 0) + 1;
  toast(`🎁 +${q.xp} XP${q.sp ? ` · +${q.sp} ${L('skill pt', 'pt habilidad')}` : ''}${q.stone ? ' · 💎 ' + stoneName(q.stone) : ''}`);
  flashRing(player.pos, 2.5, 0xffe35a); persist();
}
export function talk(o: NpcObj) {
  sfx.ui(); G.mode = 'modal'; const n = o.n; o.bb.setFacing(player.pos.x - o.pos.x, player.pos.z - o.pos.z);
  if (n.kind === 'heal') { G.team.forEach((m) => { m.hp = maxHp(m); m.endured = false; }); flashRing(player.pos, 2.5, 0x8fffb0);
    modal(npcName(n), `<p>${L('Your Pokémon are fully healed! Come back any time.', '¡Tus Pokémon están totalmente curados! Vuelve cuando quieras.')}</p>`, [[t('back'), () => closeModal()]]); return; }
  const qs = QUESTS.filter((q) => q.npc === n.id);
  const ready = qs.find((q) => save.quests[q.id]?.done && !save.quests[q.id].claimed);
  const avail = qs.find(available); const cur = qs.find((q) => save.quests[q.id] && !save.quests[q.id].done);
  const btns: [string, () => void][] = [];
  let html = '';
  if (ready) { html = `<p class="qt">✔ ${qTitle(ready)}</p><p>${L('Wonderful work! Here is your reward.', '¡Gran trabajo! Aquí tienes tu recompensa.')}</p>`; btns.push([L('Claim reward', 'Recoger premio'), () => { claim(ready); closeModal(); }]); }
  else if (cur) html = `<p class="qt">${qTitle(cur)}</p><p>${qDesc(cur)}</p><p class="qp">${save.quests[cur.id].p} / ${cur.n}</p>`;
  else if (avail) { html = `<p class="qt">! ${qTitle(avail)}</p><p>${qDesc(avail)}</p><p class="qr">${L('Reward', 'Premio')}: ${avail.xp} XP${avail.sp ? ` · +${avail.sp} ${L('skill pt', 'pt')}` : ''}${avail.stone ? ' · 💎 ' + stoneName(avail.stone) : ''}</p>`;
    btns.push([L('Accept', 'Aceptar'), () => { save.quests[avail.id] = { p: 0, done: false, claimed: false }; checkPassiveQuests(); persist(); toast('＋ ' + qTitle(avail)); closeModal(); }]); }
  else html = `<p>${L('Nothing for you right now. Keep exploring!', 'Nada por ahora. ¡Sigue explorando!')}</p>`;
  if (n.kind === 'pc') btns.push([L('Open PC storage', 'Abrir PC'), () => { closeModal(true); openPanel('teamScr', true); }]);
  btns.push([t('back'), () => closeModal()]);
  modal(npcName(n), html, btns);
}
