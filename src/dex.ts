import G from './gen1.json';
import TC from './typechart.json';
import type { Move } from './data';
import { getLang } from './i18n';

export interface Mon { id: number; en: string; es: string; t: string[]; b: number[]; cr: number; from: number | null; evo: { lv: number; stone?: string; trade?: number } | null; leg: number; }
export const DEX: Mon[] = G as Mon[];
export const mon = (id: number) => DEX[id - 1];
export const dexStr = (id: number) => String(id).padStart(4, '0');
export const nameOf = (id: number) => (getLang() === 'es' ? mon(id).es : mon(id).en);
export const evosOf = (id: number) => DEX.filter((m) => m.from === id);
export const stageOf = (id: number) => { let s = 0, m = mon(id); while (m.from) { s++; m = mon(m.from); } return s; };
export const BIG = new Set([95, 130, 143, 149, 131, 6, 9, 3, 59, 68, 76, 112, 115, 142, 150, 144, 145, 146]);
export const scaleOf = (id: number) => (BIG.has(id) ? 1.5 : mon(id).leg ? 1.45 : 1 + stageOf(id) * 0.15);
export const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
export const TYPE_COLOR: Record<string, number> = { normal: 0xc8c0a8, fire: 0xff6a1a, water: 0x3fa8ff, grass: 0x5ad04a, electric: 0xffd83a, ice: 0x8fe8ff, fighting: 0xd0503a, poison: 0xb050d0, ground: 0xd8b060, flying: 0xa0b8ff, psychic: 0xff5aa8, bug: 0xa8c030, rock: 0xb8a060, ghost: 0x7a5ad0, dragon: 0x7a4aff, dark: 0x705848, steel: 0xb8c0d0, fairy: 0xff9ad8 };
export const TYPE_ES: Record<string, string> = { normal: 'Normal', fire: 'Fuego', water: 'Agua', grass: 'Planta', electric: 'Eléctrico', ice: 'Hielo', fighting: 'Lucha', poison: 'Veneno', ground: 'Tierra', flying: 'Volador', psychic: 'Psíquico', bug: 'Bicho', rock: 'Roca', ghost: 'Fantasma', dragon: 'Dragón', dark: 'Siniestro', steel: 'Acero', fairy: 'Hada' };
export const typeName = (t: string) => (getLang() === 'es' ? TYPE_ES[t] : t[0].toUpperCase() + t.slice(1));
export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
export function eff(moveType: string, def: string[]) { let m = 1; const row = (TC as any)[moveType] || {}; for (const t of def) m *= row[t] ?? 1; return m; }
/** ranged-leaning types fight from distance */
const RANGED = new Set(['fire', 'water', 'electric', 'psychic', 'ghost', 'ice', 'poison', 'fairy', 'dragon']);
export const isRanged = (id: number) => { const m = mon(id); return RANGED.has(m.t[0]) && m.b[3] >= m.b[1] - 10; };

// ---------- moves by type: [basic L1, special L5, mobility L12, ultimate L22] ----------
type MT = [string, string, string, string]; // en names
const N: Record<string, { en: MT; es: MT; k: Move['kind'][] }> = {
  normal: { en: ['Tackle', 'Swift', 'Quick Attack', 'Hyper Beam'], es: ['Placaje', 'Rapidez', 'Ataque Rápido', 'Hiperrayo'], k: ['melee', 'proj', 'dash', 'proj'] },
  fire: { en: ['Ember', 'Flame Burst', 'Flame Charge', 'Flamethrower'], es: ['Ascuas', 'Pirotecnia', 'Nitrocarga', 'Lanzallamas'], k: ['proj', 'aoe', 'dash', 'cone'] },
  water: { en: ['Water Gun', 'Bubble Beam', 'Aqua Jet', 'Hydro Pump'], es: ['Pistola Agua', 'Rayo Burbuja', 'Acua Jet', 'Hidrobomba'], k: ['proj', 'cone', 'dash', 'proj'] },
  grass: { en: ['Vine Whip', 'Razor Leaf', 'Leaf Blade Rush', 'Petal Dance'], es: ['Látigo Cepa', 'Hoja Afilada', 'Hoja Aguda', 'Danza Pétalo'], k: ['melee', 'cone', 'dash', 'aoe'] },
  electric: { en: ['Thunder Shock', 'Spark', 'Volt Tackle', 'Thunder'], es: ['Impactrueno', 'Chispa', 'Placaje Eléc.', 'Trueno'], k: ['proj', 'aoe', 'dash', 'aoe'] },
  ice: { en: ['Powder Snow', 'Icy Wind', 'Ice Slide', 'Blizzard'], es: ['Nieve Polvo', 'Viento Hielo', 'Deslizhielo', 'Ventisca'], k: ['proj', 'cone', 'dash', 'aoe'] },
  fighting: { en: ['Karate Chop', 'Rolling Kick', 'Jump Kick', 'Close Combat'], es: ['Golpe Kárate', 'Patada Giro', 'Patada Salto', 'A Bocajarro'], k: ['melee', 'aoe', 'dash', 'aoe'] },
  poison: { en: ['Poison Sting', 'Acid Spray', 'Poison Jab Rush', 'Sludge Bomb'], es: ['Picotazo Ven.', 'Bomba Ácida', 'Puya Nociva', 'Bomba Lodo'], k: ['proj', 'cone', 'dash', 'proj'] },
  ground: { en: ['Mud Slap', 'Bulldoze', 'Dig', 'Earthquake'], es: ['Bofetón Lodo', 'Terratemblor', 'Excavar', 'Terremoto'], k: ['melee', 'aoe', 'dash', 'aoe'] },
  flying: { en: ['Peck', 'Gust', 'Aerial Ace', 'Hurricane'], es: ['Picotazo', 'Tornado', 'Golpe Aéreo', 'Vendaval'], k: ['melee', 'proj', 'dash', 'cone'] },
  psychic: { en: ['Confusion', 'Psybeam', 'Teleport', 'Psychic'], es: ['Confusión', 'Psicorrayo', 'Teletransporte', 'Psíquico'], k: ['proj', 'cone', 'dash', 'aoe'] },
  bug: { en: ['Bug Bite', 'Pin Missile', 'U-turn', 'Bug Buzz'], es: ['Picadura', 'Pin Misil', 'Ida y Vuelta', 'Zumbido'], k: ['melee', 'cone', 'dash', 'aoe'] },
  rock: { en: ['Rock Throw', 'Rock Tomb', 'Rollout', 'Rock Slide'], es: ['Lanzarrocas', 'Tumba Rocas', 'Rodar', 'Avalancha'], k: ['proj', 'aoe', 'dash', 'cone'] },
  ghost: { en: ['Lick', 'Shadow Ball', 'Shadow Sneak', 'Night Shade'], es: ['Lengüetazo', 'Bola Sombra', 'Sombra Vil', 'Tinieblas'], k: ['melee', 'proj', 'dash', 'aoe'] },
  dragon: { en: ['Dragon Breath', 'Twister', 'Dragon Rush', 'Outrage'], es: ['Dragoaliento', 'Ciclón', 'Carga Dragón', 'Enfado'], k: ['proj', 'cone', 'dash', 'aoe'] },
  dark: { en: ['Bite', 'Snarl', 'Sucker Punch', 'Crunch'], es: ['Mordisco', 'Alarido', 'Golpe Bajo', 'Triturar'], k: ['melee', 'cone', 'dash', 'aoe'] },
  steel: { en: ['Metal Claw', 'Mirror Shot', 'Bullet Punch', 'Flash Cannon'], es: ['Garra Metal', 'Disparo Espejo', 'Puño Bala', 'Foco Resplandor'], k: ['melee', 'proj', 'dash', 'proj'] },
  fairy: { en: ['Fairy Wind', 'Disarming Voice', 'Play Rough', 'Moonblast'], es: ['Viento Feérico', 'Voz Cautivadora', 'Carantoña', 'Fuerza Lunar'], k: ['proj', 'aoe', 'dash', 'proj'] },
};
export const LEARN = [1, 5, 12, 22];
const BASE: Record<Move['kind'], Partial<Move>[]> = {
  melee: [{ dmg: 13, cd: 0.38, range: 2.2, posture: 10 }], proj: [{ dmg: 14, cd: 0.7, range: 16, posture: 8, speed: 21, radius: 0.4 }, { dmg: 24, cd: 2.4, range: 18, posture: 18, speed: 20, radius: 0.55 }, {}, { dmg: 58, cd: 9, range: 20, posture: 70, speed: 17, radius: 1.1 }],
  aoe: [{}, { dmg: 30, cd: 4.5, range: 3.2, posture: 22 }, {}, { dmg: 52, cd: 9, range: 4, posture: 60, count: 4 }],
  cone: [{}, { dmg: 7, cd: 4, range: 9, posture: 4, count: 8 }, {}, { dmg: 9, cd: 8.5, range: 9, posture: 6, count: 14 }],
  dash: [{}, {}, { dmg: 22, cd: 4, range: 7.5, posture: 25 }],
};
const cache = new Map<string, Move>();
export function typeMove(type: string, slot: number): Move {
  const k = type + slot; if (cache.has(k)) return cache.get(k)!;
  const d = N[type] || N.normal, kind = d.k[slot]; const b = BASE[kind][slot] && Object.keys(BASE[kind][slot]).length ? BASE[kind][slot] : BASE[kind][0] && Object.keys(BASE[kind][0]).length ? BASE[kind][0] : BASE[kind].find((x) => Object.keys(x).length)!;
  const m: Move = { id: type + '_' + slot, en: d.en[slot], es: d.es[slot], kind, color: TYPE_COLOR[type], dmg: 10, cd: 1, range: 2, posture: 8, ...b, type, burn: type === 'fire' && slot > 0 } as Move;
  cache.set(k, m); return m;
}
/** a Pokémon's 4 move slots (basic, Q, E, R); slot 1 uses its secondary type when it has one */
export function movesOf(id: number): Move[] { const t = mon(id).t; return [typeMove(t[0], 0), typeMove(t[1] || t[0], 1), typeMove(t[0], 2), typeMove(t[0], 3)]; }

// ---------- stats ----------
export const atkOf = (id: number) => Math.max(mon(id).b[1], mon(id).b[3]);
export const defOf = (id: number) => (mon(id).b[2] + mon(id).b[4]) / 2;
export const hpOf = (id: number, lv: number) => Math.round((50 + mon(id).b[0] * 0.9) * (1 + 0.08 * (lv - 1)));
export const powOf = (id: number, lv: number) => (atkOf(id) / 75) * (1 + 0.045 * (lv - 1));
export const spdOf = (id: number) => 5.4 + mon(id).b[5] / 55;
export const wildHp = (id: number, lv: number) => Math.round((20 + mon(id).b[0] * 0.6) * (1 + 0.09 * (lv - 1)));
export const wildDmg = (id: number, lv: number) => (3 + atkOf(id) / 14) * (1 + 0.07 * (lv - 1));
export const wildXp = (id: number, lv: number) => Math.round((8 + mon(id).b.reduce((a, b) => a + b, 0) / 30) * lv * 0.6);
export const xpFor = (l: number) => 30 + l * l * 3 + l * 15;
export const STONES = ['fire', 'water', 'thunder', 'leaf', 'moon'];
