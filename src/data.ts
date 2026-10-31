export type MoveKind = 'melee' | 'proj' | 'aoe' | 'dash' | 'cone';
export interface Move { id: string; en: string; es: string; kind: MoveKind; dmg: number; cd: number; range: number; color: number; posture: number; speed?: number; radius?: number; count?: number; burn?: boolean; }
export interface Stage { dex: string; name: string; level: number; scale: number; }
export interface Species { key: string; stages: Stage[]; hp: number; speed: number; moves: Move[]; color: string; }

const M = (m: Move) => m;
export const TEAM: Species[] = [
  { key: 'lucario', color: '#4fa3ff', hp: 120, speed: 7.2, stages: [{ dex: '0448', name: 'Lucario', level: 1, scale: 1.15 }],
    moves: [
      M({ id: 'palm', en: 'Force Palm', es: 'Palmeo', kind: 'melee', dmg: 14, cd: 0.38, range: 2.2, color: 0x6fc3ff, posture: 10 }),
      M({ id: 'aura', en: 'Aura Sphere', es: 'Esfera Aural', kind: 'proj', dmg: 26, cd: 2.2, range: 18, color: 0x3d8bff, posture: 18, speed: 22, radius: 0.55 }),
      M({ id: 'xspeed', en: 'Extreme Speed', es: 'Velocidad Extrema', kind: 'dash', dmg: 22, cd: 4, range: 7, color: 0xffffff, posture: 25 }),
      M({ id: 'cc', en: 'Close Combat', es: 'A Bocajarro', kind: 'aoe', dmg: 48, cd: 9, range: 3.6, color: 0x9fd8ff, posture: 60, count: 4 }),
    ] },
  { key: 'charmander', color: '#ff7a2a', hp: 95, speed: 6.8, stages: [
      { dex: '0004', name: 'Charmander', level: 1, scale: 1 }, { dex: '0005', name: 'Charmeleon', level: 4, scale: 1.15 }, { dex: '0006', name: 'Charizard', level: 8, scale: 1.4 }],
    moves: [
      M({ id: 'scratch', en: 'Scratch', es: 'Arañazo', kind: 'melee', dmg: 11, cd: 0.32, range: 2, color: 0xffb070, posture: 7, burn: false }),
      M({ id: 'ember', en: 'Ember', es: 'Ascuas', kind: 'proj', dmg: 16, cd: 0.9, range: 16, color: 0xff6a1a, posture: 6, speed: 20, radius: 0.4, burn: true }),
      M({ id: 'burst', en: 'Flame Burst', es: 'Pirotecnia', kind: 'aoe', dmg: 30, cd: 4.5, range: 3, color: 0xff4a00, posture: 22, burn: true }),
      M({ id: 'thrower', en: 'Flamethrower', es: 'Lanzallamas', kind: 'cone', dmg: 9, cd: 8, range: 9, color: 0xff8c1a, posture: 6, count: 14, burn: true }),
    ] },
  { key: 'squirtle', color: '#39c6ff', hp: 110, speed: 6.6, stages: [
      { dex: '0007', name: 'Squirtle', level: 1, scale: 1 }, { dex: '0008', name: 'Wartortle', level: 4, scale: 1.15 }, { dex: '0009', name: 'Blastoise', level: 8, scale: 1.4 }],
    moves: [
      M({ id: 'tackle', en: 'Tackle', es: 'Placaje', kind: 'melee', dmg: 12, cd: 0.4, range: 2.1, color: 0xbfe9ff, posture: 12 }),
      M({ id: 'wgun', en: 'Water Gun', es: 'Pistola Agua', kind: 'proj', dmg: 13, cd: 0.6, range: 15, color: 0x3fb8ff, posture: 9, speed: 24, radius: 0.35 }),
      M({ id: 'ajet', en: 'Aqua Jet', es: 'Acua Jet', kind: 'dash', dmg: 18, cd: 3.5, range: 8, color: 0x7fd8ff, posture: 30 }),
      M({ id: 'hydro', en: 'Hydro Pump', es: 'Hidrobomba', kind: 'proj', dmg: 55, cd: 8, range: 20, color: 0x1f7fff, posture: 70, speed: 16, radius: 1.1 }),
    ] },
];
export interface EnemyDef { dex: string; name: string; hp: number; speed: number; dmg: number; ranged: boolean; xp: number; scale: number; color: number; posture: number; }
export const ENEMIES: Record<string, EnemyDef> = {
  rattata: { dex: '0019', name: 'Rattata', hp: 45, speed: 5.2, dmg: 9, ranged: false, xp: 18, scale: 1, color: 0xc070ff, posture: 40 },
  pidgey: { dex: '0016', name: 'Pidgey', hp: 40, speed: 5.8, dmg: 8, ranged: false, xp: 18, scale: 1, color: 0xd0b080, posture: 35 },
  zubat: { dex: '0041', name: 'Zubat', hp: 38, speed: 4.6, dmg: 8, ranged: true, xp: 20, scale: 1, color: 0x8060ff, posture: 30 },
  machop: { dex: '0066', name: 'Machop', hp: 95, speed: 4.4, dmg: 15, ranged: false, xp: 34, scale: 1.1, color: 0x9ab0c0, posture: 90 },
  gastly: { dex: '0092', name: 'Gastly', hp: 60, speed: 4, dmg: 11, ranged: true, xp: 30, scale: 1.1, color: 0xa040ff, posture: 50 },
  mewtwo: { dex: '0150', name: 'Mewtwo', hp: 520, speed: 6, dmg: 16, ranged: true, xp: 200, scale: 1.6, color: 0xc06bff, posture: 260 },
};
export const WAVES: string[][] = [
  ['rattata', 'rattata', 'rattata', 'pidgey'],
  ['zubat', 'zubat', 'pidgey', 'rattata', 'rattata'],
  ['machop', 'gastly', 'machop', 'zubat', 'gastly'],
];
export const UPGRADES = ['u_dmg', 'u_hp', 'u_cd', 'u_ls', 'u_pos', 'u_spd'];
export const ITEMS = ['i_belt', 'i_claw', 'i_bell', 'i_band', 'i_lens'];
export const BOSS_BARS = [0x7f5bff, 0xff3fd2, 0xff2a3c];
export const xpFor = (lvl: number) => 40 + lvl * 25;
