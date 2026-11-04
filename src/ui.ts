// Ceremony overlays: zone-entry title card, level-up / evolution fanfare, screen flash.
import { $, L } from './state';
import type { Zone } from './zones';

let zt: number | undefined, ft: number | undefined;
export function zoneTitle(z: Zone) {
  const el = $('#zonet'); el.innerHTML = `<small>${L('Entering', 'Entrando en')}</small><h2>${L(z.en, z.es)}</h2><i></i><span>${L('Level', 'Nivel')} ${z.lv[0]}–${z.lv[1]}</span>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(zt); zt = window.setTimeout(() => el.classList.remove('show'), 3200);
}
export function fanfare(title: string, sub: string, color = '#ffd76a') {
  const el = $('#fanfare'); el.style.setProperty('--fc', color); el.innerHTML = `<div class="rays"></div><h2>${title}</h2><p>${sub}</p>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(ft); ft = window.setTimeout(() => el.classList.remove('show'), 2600);
}
export function flash(color = '#fff', a = 0.35) {
  const el = $('#flash'); el.style.background = color; el.style.transition = 'none'; el.style.opacity = String(a); void el.offsetWidth; el.style.transition = 'opacity .35s'; el.style.opacity = '0';
}
