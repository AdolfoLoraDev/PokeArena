// Bootstrap: load assets, build the world, wire input/UI and start the loop.
import { setGroundFn } from './fx';
import { heightAt, loadWorldAssets } from './world';
import { setupQuality } from './scene';
import { loadSpecies } from './sprites';
import { $, isTouch } from './state';
import { initInput } from './input';
import { initUi, buildAll, frame, showScreen } from './game';
import { save } from './save';
import { dexStr } from './dex';
import { NPCS } from './zones';

async function boot() {
  setGroundFn(heightAt); setupQuality(); initInput(); initUi();
  const first = [...new Set([...save.mons.map((m) => m.id), 1, 4, 7, 25, ...NPCS.map((n) => n.dex)])].map((i) => loadSpecies(dexStr(i)));
  await Promise.all([...first, loadWorldAssets()]).catch((e) => console.warn(e));
  document.body.classList.toggle('touch', isTouch); buildAll(); $('#loading').classList.add('hidden'); showScreen('title'); frame();
}
boot();
