import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.setDefaultTimeout(120000);
await p.addInitScript(() => localStorage.setItem('pa_save_v2', JSON.stringify({ v: 2, quality: 'low' })));
await p.goto('http://localhost:5199/'); await p.waitForSelector('#loading.hidden', { state: 'attached' });
await p.click('[data-go=play]'); await p.waitForTimeout(500); await p.click('[data-st="4"]'); await p.waitForTimeout(2500);
await p.evaluate(() => window.__game.tp(10, -60)); console.log(await p.evaluate(() => new Promise((r) => { const o = []; let k = 0; const iv = setInterval(() => { const e = document.getElementById('zonet'); o.push(getComputedStyle(e).opacity + '/' + e.getAnimations().map((a) => a.playState + ':' + Math.round(a.currentTime)).join(',')); if (++k > 8) { clearInterval(iv); r(o); } }, 300); })));
console.log(await p.evaluate(() => { const e = document.getElementById('zonet'); const s = getComputedStyle(e); return { cls: e.className, html: e.innerHTML.slice(0, 80), op: s.opacity, disp: s.display, z: window.__game.G.curZone }; }));
await p.screenshot({ path: '/workspace/ui-shots/new-game/aaa/desktop-05b-zone-title.png' }); await b.close();
