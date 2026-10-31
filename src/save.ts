export interface MemberSave { level: number; xp: number; upgrades: string[]; item: string | null; }
export interface Save { members: MemberSave[]; best: number | null; music: number; sfx: number; quality: 'high' | 'low'; }
const KEY = 'pa_save_v1';
const fresh = (): Save => ({ members: [0, 1, 2].map(() => ({ level: 1, xp: 0, upgrades: [], item: null })), best: null, music: 0.5, sfx: 0.7, quality: 'high' });
export let save: Save = load();
function load(): Save { try { const s = JSON.parse(localStorage.getItem(KEY)!); if (s && s.members?.length === 3) return { ...fresh(), ...s }; } catch {} return fresh(); }
export function persist() { localStorage.setItem(KEY, JSON.stringify(save)); }
export function resetSave() { const q = save.quality, m = save.music, f = save.sfx; save = fresh(); save.quality = q; save.music = m; save.sfx = f; persist(); }
