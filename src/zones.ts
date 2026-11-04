// World layout: x west(-)/east(+), z south(+)/north(-). Town hub at the origin.
export type Circ = [number, number, number]; export type Cap = [number, number, number, number, number];
export interface Theme { grass: number; grass2: number; hill: number; path: number; fog: number; trees: string[]; density: number; deco: string[]; particle: number; }
export interface Zone { id: string; en: string; es: string; lv: [number, number]; circles: Circ[]; paths: Cap[]; way: [number, number]; spawns: number[]; alpha?: { id: number; lv: number; at: [number, number] }; theme: Theme; height: number; }
export const ZONES: Zone[] = [
  { id: 'town', en: 'Pallet Hub', es: 'Pueblo Origen', lv: [1, 1], height: 0, way: [6, -6],
    circles: [[0, 0, 21]], paths: [], spawns: [],
    theme: { grass: 0x76b04e, grass2: 0x8cc45a, hill: 0x4f8a3c, path: 0xbfa27a, fog: 0xd6e2d6, trees: ['NormalTree_5', 'MapleTree_1'], density: 0.5, deco: ['Flower_3_Clump', 'Flower_4_Clump', 'Bush_Large_Flowers'], particle: 0xfff0b0 } },
  { id: 'meadow', en: 'Sunny Meadow', es: 'Pradera Soleada', lv: [2, 8], height: 0, way: [0, -52],
    circles: [[0, -50, 13], [-24, -74, 12], [22, -78, 13], [0, -104, 13], [-34, -50, 9]],
    paths: [[0, -20, 0, -38, 4.5], [-8, -58, -18, -66, 4], [8, -58, 16, -68, 4], [-18, -84, -6, -96, 4], [16, -88, 6, -96, 4], [-12, -50, -26, -50, 3.5]],
    spawns: [16, 19, 21, 29, 32, 10, 13, 25, 39, 35, 52, 56, 83, 84, 43, 69, 1, 133, 113, 115, 128, 108, 46, 48],
    alpha: { id: 17, lv: 10, at: [22, -78] },
    theme: { grass: 0x6fae4a, grass2: 0x98cc5a, hill: 0x4f8a3c, path: 0xc9a46a, fog: 0xd6e2d6, trees: ['NormalTree_5', 'MapleTree_1', 'PineTree_2'], density: 0.7, deco: ['Flower_3_Clump', 'Flower_4_Clump', 'Grass_Large', 'Bush_Large_Flowers'], particle: 0xe8a040 } },
  { id: 'forest', en: 'Viridian Woods', es: 'Bosque Verde', lv: [6, 13], height: 0, way: [-62, -8],
    circles: [[-62, -8, 11], [-88, -28, 12], [-114, -4, 13], [-96, 26, 11], [-132, -38, 12]],
    paths: [[-19, -4, -52, -8, 4], [-70, -16, -80, -22, 3.5], [-98, -22, -106, -12, 3.5], [-108, 6, -100, 18, 3.5], [-122, -14, -128, -28, 3.5], [-84, 24, -66, 4, 3]],
    spawns: [11, 14, 12, 15, 17, 20, 46, 47, 48, 49, 123, 127, 102, 103, 114, 2, 44, 70, 22, 30, 33, 143, 151, 10, 13, 101, 100],
    alpha: { id: 15, lv: 15, at: [-114, -4] },
    theme: { grass: 0x3f7a34, grass2: 0x5a9a3c, hill: 0x2c5a28, path: 0x8a7050, fog: 0xa8c4a0, trees: ['PineTree_2', 'PineTree_4', 'NormalTree_5', 'PineTree_4'], density: 1.25, deco: ['Bush', 'Bush_Large', 'Grass_Large', 'Grass_Large'], particle: 0xc8ff70 } },
  { id: 'coast', en: 'Azure Coast', es: 'Costa Azul', lv: [10, 18], height: 0, way: [62, 6],
    circles: [[62, 6, 12], [92, -12, 14], [122, 16, 13], [100, 46, 12], [140, -24, 11]],
    paths: [[19, 2, 52, 4, 4], [72, -2, 82, -6, 4], [104, -2, 112, 6, 4], [118, 28, 108, 36, 3.5], [132, 4, 138, -12, 3.5]],
    spawns: [7, 8, 54, 55, 60, 61, 72, 73, 79, 80, 86, 87, 90, 91, 98, 99, 116, 117, 118, 119, 120, 121, 129, 131, 138, 139, 140, 141, 147, 62, 81, 82],
    alpha: { id: 130, lv: 21, at: [122, 16] },
    theme: { grass: 0x8cba5a, grass2: 0xa8c870, hill: 0x6a9a48, path: 0xe2d29a, fog: 0xcfe6ee, trees: ['PalmTree_1', 'PalmTree_3', 'PalmTree_1'], density: 0.45, deco: ['Grass_Large', 'Bush', 'Rock_2'], particle: 0xffffff } },
  { id: 'mountain', en: 'Granite Peaks', es: 'Picos de Granito', lv: [16, 26], height: 3.2, way: [-58, -112],
    circles: [[-58, -112, 12], [-86, -136, 13], [-116, -116, 12], [-100, -166, 14], [-130, -150, 10]],
    paths: [[-12, -104, -46, -110, 4], [-66, -122, -76, -128, 3.5], [-98, -126, -106, -120, 3.5], [-90, -148, -96, -152, 3.5], [-114, -158, -124, -152, 3], [-126, -38, -116, -104, 3.5]],
    spawns: [41, 42, 50, 51, 74, 75, 66, 67, 27, 28, 95, 104, 105, 96, 97, 63, 64, 111, 112, 124, 106, 107, 142, 144, 76, 68, 57, 35, 36, 39],
    alpha: { id: 95, lv: 28, at: [-100, -166] },
    theme: { grass: 0x8a9a7a, grass2: 0xa8b098, hill: 0x6f6a64, path: 0xb0a490, fog: 0xc8d0dc, trees: ['PineTree_4', 'PineTree_2'], density: 0.6, deco: ['Rock_1', 'Rock_3', 'Rock_4', 'Grass_Large'], particle: 0xffffff } },
  { id: 'volcano', en: 'Cinder Ruins', es: 'Ruinas Ceniza', lv: [26, 40], height: 2.4, way: [58, -120],
    circles: [[58, -120, 12], [88, -146, 13], [68, -176, 12], [36, -200, 13], [0, -224, 18]],
    paths: [[12, -106, 46, -116, 4], [66, -128, 78, -138, 3.5], [82, -158, 74, -166, 3.5], [58, -184, 46, -192, 3.5], [26, -208, 12, -216, 4.5], [140, -34, 96, -134, 3.5]],
    spawns: [4, 5, 37, 38, 58, 59, 77, 78, 126, 88, 89, 109, 110, 92, 93, 94, 125, 135, 136, 134, 132, 23, 24, 149, 3, 6, 9, 18, 26, 31, 34, 40, 45, 53, 65, 71, 85, 145, 146, 148, 137, 122],
    alpha: { id: 126, lv: 38, at: [68, -176] },
    theme: { grass: 0x6a5a4e, grass2: 0x7e6a58, hill: 0x3a302c, path: 0x9a7a5a, fog: 0xc8b0a0, trees: ['DeadTree_2', 'DeadTree_6'], density: 0.35, deco: ['Rock_1', 'Rock_5', 'Rock_2'], particle: 0xff8a3a } },
];
export const ARENA: [number, number] = [0, -224];
export const SEAL: [number, number, number] = [10, -212, 5];
/** NPCs: friendly Pokémon townsfolk. kind: quest giver, healer, storage */
export interface Npc { id: string; dex: number; at: [number, number]; kind: 'quest' | 'heal' | 'pc'; en: string; es: string; }
export const NPCS: Npc[] = [
  { id: 'elder', dex: 115, at: [-6, -10], kind: 'quest', en: 'Elder Kangaskhan', es: 'Anciana Kangaskhan' },
  { id: 'nurse', dex: 113, at: [9, 4], kind: 'heal', en: 'Nurse Chansey', es: 'Enfermera Chansey' },
  { id: 'pc', dex: 137, at: [-10, 4], kind: 'pc', en: 'Porygon PC', es: 'PC Porygon' },
  { id: 'farf', dex: 83, at: [-30, -48], kind: 'quest', en: 'Farfetch\'d the Scout', es: 'Farfetch\'d Explorador' },
  { id: 'bfree', dex: 12, at: [-90, 22], kind: 'quest', en: 'Ranger Butterfree', es: 'Guarda Butterfree' },
  { id: 'slow', dex: 79, at: [96, 50], kind: 'quest', en: 'Old Slowpoke', es: 'Viejo Slowpoke' },
  { id: 'machoke', dex: 67, at: [-126, -146], kind: 'quest', en: 'Miner Machoke', es: 'Minero Machoke' },
  { id: 'kadabra', dex: 64, at: [62, -112], kind: 'quest', en: 'Seer Kadabra', es: 'Vidente Kadabra' },
];
export type QType = 'defeat' | 'defeatType' | 'catch' | 'visit' | 'alpha' | 'boss' | 'dex';
export interface Quest { id: string; npc: string; type: QType; n: number; arg?: string; req?: string; en: [string, string]; es: [string, string]; xp: number; sp: number; stone?: string; }
export const QUESTS: Quest[] = [
  { id: 'q1', npc: 'elder', type: 'defeat', arg: 'meadow', n: 5, en: ['Meadow Trouble', 'Defeat 5 wild Pokémon in Sunny Meadow (north).'], es: ['Problemas en la pradera', 'Derrota 5 Pokémon salvajes en Pradera Soleada (norte).'], xp: 120, sp: 1 },
  { id: 'q2', npc: 'elder', type: 'catch', n: 2, req: 'q1', en: ['New Friends', 'Weaken wild Pokémon and catch 2 of them.'], es: ['Nuevos amigos', 'Debilita Pokémon salvajes y captura 2.'], xp: 150, sp: 0, stone: 'moon' },
  { id: 'q3', npc: 'farf', type: 'visit', arg: 'forest', n: 1, en: ['Into the Woods', 'Activate the waystone of Viridian Woods (west of town).'], es: ['Hacia el bosque', 'Activa el monolito del Bosque Verde (oeste del pueblo).'], xp: 150, sp: 0, stone: 'leaf' },
  { id: 'q4', npc: 'farf', type: 'alpha', arg: 'meadow', n: 1, en: ['Sky Tyrant', 'Defeat the Alpha Pidgeotto of the meadow.'], es: ['Tirano del cielo', 'Derrota al Pidgeotto Alfa de la pradera.'], xp: 250, sp: 1 },
  { id: 'q5', npc: 'bfree', type: 'defeatType', arg: 'bug', n: 8, en: ['Swarm Control', 'Defeat 8 Bug-type Pokémon.'], es: ['Control de plagas', 'Derrota 8 Pokémon de tipo Bicho.'], xp: 300, sp: 1 },
  { id: 'q6', npc: 'bfree', type: 'alpha', arg: 'forest', n: 1, req: 'q5', en: ['Queen of Stingers', 'Defeat the Alpha Beedrill deep in the woods.'], es: ['Reina del aguijón', 'Derrota al Beedrill Alfa en lo profundo del bosque.'], xp: 450, sp: 1, stone: 'thunder' },
  { id: 'q7', npc: 'slow', type: 'catch', arg: 'water', n: 1, en: ['Tide Pool', 'Catch a Water-type Pokémon.'], es: ['Charca de marea', 'Captura un Pokémon de tipo Agua.'], xp: 400, sp: 1, stone: 'water' },
  { id: 'q8', npc: 'slow', type: 'alpha', arg: 'coast', n: 1, req: 'q7', en: ['Wrath of the Sea', 'Defeat the Alpha Gyarados on the reef.'], es: ['Furia del mar', 'Derrota al Gyarados Alfa del arrecife.'], xp: 700, sp: 1, stone: 'fire' },
  { id: 'q9', npc: 'machoke', type: 'defeatType', arg: 'rock', n: 10, en: ['Rockfall', 'Defeat 10 Rock-type Pokémon.'], es: ['Desprendimiento', 'Derrota 10 Pokémon de tipo Roca.'], xp: 900, sp: 1 },
  { id: 'q10', npc: 'machoke', type: 'alpha', arg: 'mountain', n: 1, req: 'q9', en: ['Iron Serpent', 'Defeat the Alpha Onix at the summit.'], es: ['Serpiente de hierro', 'Derrota al Onix Alfa en la cima.'], xp: 1200, sp: 2, stone: 'moon' },
  { id: 'q11', npc: 'kadabra', type: 'alpha', arg: 'volcano', n: 1, en: ['The Seal Keeper', 'Defeat the Alpha Magmar to weaken the arena seal.'], es: ['Guardián del sello', 'Derrota al Magmar Alfa para debilitar el sello.'], xp: 1800, sp: 2 },
  { id: 'q12', npc: 'kadabra', type: 'boss', n: 1, req: 'q11', en: ['Genetic Nightmare', 'Enter the sealed arena and defeat Mewtwo.'], es: ['Pesadilla genética', 'Entra en la arena sellada y derrota a Mewtwo.'], xp: 4000, sp: 3 },
  { id: 'q13', npc: 'pc', type: 'dex', n: 15, en: ['Data Collector', 'Register 15 caught species in the Pokédex.'], es: ['Coleccionista', 'Registra 15 especies capturadas en la Pokédex.'], xp: 800, sp: 2, stone: 'fire' },
  { id: 'q14', npc: 'pc', type: 'dex', n: 50, req: 'q13', en: ['Master Archivist', 'Register 50 caught species.'], es: ['Archivista maestro', 'Registra 50 especies capturadas.'], xp: 3000, sp: 3, stone: 'thunder' },
];
