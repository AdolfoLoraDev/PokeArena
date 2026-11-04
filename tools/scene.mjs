// Quick scenery check: town + each zone, desktop, configurable quality.
import { chromium } from 'playwright';
const Q = process.argv[2] || 'low', OUT = process.argv[3] || '/tmp/sc/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); p.setDefaultTimeout(180000); const errs = [];
await p.addInitScript((q) => localStorage.setItem('pa_save_v2', JSON.stringify({ v: 2, quality: q })), Q);
p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:5199/'); await p.waitForSelector('#loading.hidden', { timeout: 60000, state: 'attached' });
await p.click('[data-go=play]'); await p.waitForTimeout(400); await p.click('[data-st="4"]'); await p.waitForTimeout(2500);
const spots = (process.argv[4] || 'town:0:-2,meadow:6:-62,forest:-80:-20,coast:96:6,mountain:-86:-130,volcano:66:-130').split(',');
for (const s of spots) { const [n, x, z] = s.split(':'); await p.evaluate(([x, z]) => window.__game.tp(+x, +z), [x, z]); await p.waitForTimeout(2500); await p.screenshot({ path: OUT + n + '.png', timeout: 180000 }); }
console.log(errs.slice(0, 5)); await b.close();
