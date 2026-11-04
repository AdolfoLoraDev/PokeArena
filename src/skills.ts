import type { MonSave } from './save';
export interface SkillNode { id: string; en: string; es: string; max: number; }
export interface Branch { id: string; en: string; es: string; color: string; nodes: SkillNode[]; }
const S = (id: string, en: string, es: string, max: number): SkillNode => ({ id, en, es, max });
export const TREE: Branch[] = [
  { id: 'off', en: 'Offense', es: 'Ataque', color: '#ff5a4a', nodes: [
    S('pow', 'Power: +8% damage per rank', 'Poder: +8% de daño por rango', 3),
    S('crit', 'Critical: +7% crit chance (×1.6)', 'Crítico: +7% prob. crítico (×1,6)', 3),
    S('brk', 'Breaker: +20% posture damage', 'Rompeguardia: +20% daño a postura', 2),
    S('ult', 'Ultimate: R move +25% dmg, −15% cooldown', 'Definitivo: mov. R +25% daño, −15% recarga', 2),
    S('exec', 'Finisher: +40% dmg to foes under 30% HP', 'Remate: +40% daño a enemigos con <30% PS', 1)] },
  { id: 'def', en: 'Defense', es: 'Defensa', color: '#4fa3ff', nodes: [
    S('hp', 'Vitality: +10% max HP per rank', 'Vitalidad: +10% PS máx. por rango', 3),
    S('arm', 'Armor: −6% damage taken per rank', 'Coraza: −6% daño recibido por rango', 3),
    S('parry', 'Riposte: perfect parry heals 8% HP', 'Réplica: el bloqueo perfecto cura 8% PS', 2),
    S('dash', 'Evasion: dodge cooldown −20%', 'Evasión: esquiva −20% recarga', 2),
    S('endure', 'Endure: survive a fatal hit once per fight', 'Aguante: sobrevive a un golpe letal por combate', 1)] },
  { id: 'utl', en: 'Utility', es: 'Utilidad', color: '#5ad04a', nodes: [
    S('spd', 'Swift: +6% move speed per rank', 'Agilidad: +6% velocidad por rango', 3),
    S('cd', 'Focus: −6% cooldowns per rank', 'Concentración: −6% recargas por rango', 3),
    S('ls', 'Drain: +3% lifesteal per rank', 'Drenaje: +3% robo de vida por rango', 2),
    S('catch', 'Trainer: +15% catch rate per rank', 'Entrenador: +15% captura por rango', 2),
    S('xp', 'Scholar: +15% XP per rank', 'Erudito: +15% EXP por rango', 2)] },
];
export const spTotal = (m: MonSave) => Math.max(0, m.lv - 1) + m.bsp;
export const spUsed = (m: MonSave) => Object.values(m.sk).reduce((a, b) => a + b, 0);
export const spFree = (m: MonSave) => spTotal(m) - spUsed(m);
export function canLearn(m: MonSave, b: Branch, i: number) { const n = b.nodes[i]; if ((m.sk[n.id] || 0) >= n.max || spFree(m) <= 0) return false; return i === 0 || (m.sk[b.nodes[i - 1].id] || 0) > 0; }
export const rk = (m: MonSave, id: string) => m.sk[id] || 0;
