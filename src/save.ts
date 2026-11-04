export interface MonSave { uid: number; id: number; lv: number; xp: number; sk: Record<string, number>; bsp: number; }
export interface QuestSave { p: number; done: boolean; claimed: boolean; }
export interface Save {
  v: 2; mons: MonSave[]; party: number[]; nextUid: number; seen: number[]; caught: number[];
  quests: Record<string, QuestSave>; ways: string[]; stones: Record<string, number>; pos: [number, number] | null; mewtwo: boolean;
  best: number | null; music: number; sfx: number; quality: 'high' | 'low';
}
const KEY = 'pa_save_v2';
const fresh = (): Save => ({ v: 2, mons: [], party: [], nextUid: 1, seen: [], caught: [], quests: {}, ways: ['town'], stones: {}, pos: null, mewtwo: false, best: null, music: 0.5, sfx: 0.7, quality: 'high' });
export let save: Save = load();
function load(): Save {
  try { const s = JSON.parse(localStorage.getItem(KEY)!); if (s && s.v === 2) return { ...fresh(), ...s }; } catch {}
  const f = fresh(); try { const o = JSON.parse(localStorage.getItem('pa_save_v1')!); if (o) { f.music = o.music ?? f.music; f.sfx = o.sfx ?? f.sfx; f.quality = o.quality ?? f.quality; } } catch {}
  return f;
}
export function persist() { localStorage.setItem(KEY, JSON.stringify(save)); }
export function resetSave() { const q = save.quality, m = save.music, f = save.sfx; save = fresh(); save.quality = q; save.music = m; save.sfx = f; persist(); }
export function addMon(id: number, lv: number): MonSave { const m: MonSave = { uid: save.nextUid++, id, lv, xp: 0, sk: {}, bsp: 0 }; save.mons.push(m); if (save.party.length < 3) save.party.push(m.uid); markCaught(id); persist(); return m; }
export function markSeen(id: number) { if (!save.seen.includes(id)) save.seen.push(id); }
export function markCaught(id: number) { markSeen(id); if (!save.caught.includes(id)) save.caught.push(id); }
export const monByUid = (uid: number) => save.mons.find((m) => m.uid === uid)!;
