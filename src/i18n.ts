type Dict = Record<string, string>;
const en: Dict = {
  play: 'Play', team: 'Team & Build', options: 'Options', credits: 'Credits', back: 'Back',
  tagline: 'Aura Showdown · HD-2D action', language: 'Language', music: 'Music', sfx: 'Effects', quality: 'Graphics',
  high: 'High (glow)', low: 'Low (fast)', controls: 'Controls',
  ctrlDesk: 'WASD move · Mouse aim · Left click basic attack · Q / E / R moves · Space dodge · Right click or F parry · Tab lock-on · 1 2 3 swap Pokémon · Esc pause',
  ctrlMob: 'Left stick move · ⚔ attack · Q E R moves · ➤ dodge · 🛡 parry · ◎ lock-on · tap portraits to swap (auto-aim)',
  rotate: 'Rotate your device to landscape', wave: 'Wave {n}', bossIncoming: 'MEWTWO AWAKENS', phase: 'PHASE {n}',
  parry: 'PARRY!', counter: 'COUNTER', stagger: 'BREAK!', levelUp: 'Level up! Choose a talent', evolve: '{a} evolved into {b}!',
  victory: 'VICTORY', defeat: 'DEFEATED', retry: 'Play again', menu: 'Main menu', resume: 'Resume', paused: 'Paused',
  time: 'Time', kills: 'Defeated', level: 'Lv', item: 'Held item', none: 'None', talents: 'Talents', moves: 'Moves',
  reset: 'Reset progress', resetQ: 'Reset all progress?', best: 'Best clear', fainted: 'fainted!', tip: 'Tip: parry right as the red ring flashes',
  creditsBody: 'PokéArena is a free, non-commercial fan game. Pokémon and all related names are © Nintendo, Game Freak, Creatures Inc. and The Pokémon Company. This project is not affiliated with or endorsed by them.',
  spritesBy: 'Pokémon sprites and portraits from the PMDCollab SpriteCollab project (CC BY-NC 4.0), by:',
  techBy: 'Made with Three.js and Vite. Sound effects synthesized in the browser.',
  explore: 'Explore · clear camps to break the seal', camps: 'Camps {n}/{m}', campClear: 'Camp cleared {n}/{m}', sealBroken: 'THE SEAL BREAKS — follow the light', sealed: 'Sealed · clear {n} more camps',
  // upgrades
  u_dmg: 'Power +20%', u_hp: 'Max HP +25', u_cd: 'Cooldowns −15%', u_ls: 'Lifesteal +6%', u_pos: 'Posture damage +35%', u_spd: 'Speed +12%',
  // items
  i_belt: 'Black Belt (+15% damage)', i_claw: 'Quick Claw (−20% cooldowns)', i_bell: 'Shell Bell (8% lifesteal)', i_band: 'Focus Band (+40 max HP)', i_lens: 'Wide Lens (+50% posture dmg)',
};
const es: Dict = {
  play: 'Jugar', team: 'Equipo y build', options: 'Opciones', credits: 'Créditos', back: 'Volver',
  tagline: 'Duelo de Aura · acción HD-2D', language: 'Idioma', music: 'Música', sfx: 'Efectos', quality: 'Gráficos',
  high: 'Alto (brillo)', low: 'Bajo (rápido)', controls: 'Controles',
  ctrlDesk: 'WASD moverse · Ratón apuntar · Clic izquierdo ataque básico · Q / E / R movimientos · Espacio esquivar · Clic derecho o F parada · Tab fijar objetivo · 1 2 3 cambiar Pokémon · Esc pausa',
  ctrlMob: 'Joystick izquierdo moverse · ⚔ atacar · Q E R movimientos · ➤ esquivar · 🛡 parada · ◎ fijar · toca los retratos para cambiar (apuntado automático)',
  rotate: 'Gira el dispositivo en horizontal', wave: 'Oleada {n}', bossIncoming: 'MEWTWO DESPIERTA', phase: 'FASE {n}',
  parry: '¡PARADA!', counter: 'CONTRAATAQUE', stagger: '¡ROTO!', levelUp: '¡Subes de nivel! Elige un talento', evolve: '¡{a} evolucionó a {b}!',
  victory: 'VICTORIA', defeat: 'DERROTA', retry: 'Jugar otra vez', menu: 'Menú principal', resume: 'Continuar', paused: 'Pausa',
  time: 'Tiempo', kills: 'Derrotados', level: 'Nv', item: 'Objeto equipado', none: 'Ninguno', talents: 'Talentos', moves: 'Movimientos',
  reset: 'Borrar progreso', resetQ: '¿Borrar todo el progreso?', best: 'Mejor tiempo', fainted: '¡se debilitó!', tip: 'Consejo: haz la parada justo cuando parpadea el aro rojo',
  creditsBody: 'PokéArena es un juego de fans gratuito y sin ánimo de lucro. Pokémon y todos los nombres relacionados son © Nintendo, Game Freak, Creatures Inc. y The Pokémon Company. Este proyecto no está afiliado ni respaldado por ellos.',
  spritesBy: 'Sprites y retratos de Pokémon del proyecto PMDCollab SpriteCollab (CC BY-NC 4.0), por:',
  techBy: 'Hecho con Three.js y Vite. Efectos de sonido sintetizados en el navegador.',
  explore: 'Explora · limpia campamentos y rompe el sello', camps: 'Campamentos {n}/{m}', campClear: 'Campamento limpio {n}/{m}', sealBroken: 'EL SELLO SE ROMPE — sigue la luz', sealed: 'Sellado · limpia {n} campamentos más',
  u_dmg: 'Poder +20%', u_hp: 'Vida máx. +25', u_cd: 'Recargas −15%', u_ls: 'Robo de vida +6%', u_pos: 'Daño de postura +35%', u_spd: 'Velocidad +12%',
  i_belt: 'Cinturón Negro (+15% daño)', i_claw: 'Garra Rápida (−20% recargas)', i_bell: 'Campana Concha (8% robo de vida)', i_band: 'Cinta Focus (+40 vida máx.)', i_lens: 'Lupa (+50% daño de postura)',
};
const dicts: Record<string, Dict> = { en, es };
let lang = localStorage.getItem('pa_lang') || (navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en');
export const getLang = () => lang;
export function setLang(l: string) { lang = l; localStorage.setItem('pa_lang', l); document.documentElement.lang = l; applyI18n(); }
export function t(k: string, vars: Record<string, string | number> = {}) {
  let s = dicts[lang][k] ?? en[k] ?? k;
  for (const v in vars) s = s.replace('{' + v + '}', String(vars[v]));
  return s;
}
export function applyI18n() { document.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => (el.textContent = t(el.dataset.i!))); }
