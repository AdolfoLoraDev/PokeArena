import { chromium, devices } from 'playwright';
const URL = process.argv[2] || 'http://localhost:4173/'; const OUT = process.env.OUT || '/workspace/ui-shots/new-game/meadow/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function drain(p) { for (let k = 0; k < 20; k++) { await p.waitForTimeout(200); if (await p.evaluate(() => window.__game.mode) !== 'modal') return; await p.click('#mbody .picks button').catch(() => {}); } }
async function run(name, opts, low) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.addInitScript((low) => { if (low) { const s = JSON.parse(localStorage.getItem('pa_save') || '{}'); } }, low);
  await p.goto(URL); await p.waitForSelector('#loading.hidden', { timeout: 30000, state: 'attached' }); await p.waitForTimeout(800);
  await p.click('[data-go=play]'); await p.waitForTimeout(3500); await p.screenshot({ path: OUT + name + '-town.png' });
  const tp = async (x, z, wait = 1800) => { await p.evaluate(([x, z]) => window.__game.tp(x, z), [x, z]); await p.waitForTimeout(wait); };
  const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
  await tp(0, -26); await p.screenshot({ path: OUT + name + '-route.png' });
  await tp(30, -50); await p.screenshot({ path: OUT + name + '-bigtree-camp.png' });
  await tp(-20, -86); await p.screenshot({ path: OUT + name + '-river-bridge.png' });
  await tp(-26, -100); await p.screenshot({ path: OUT + name + '-ruins.png' });
  for (let i = 0; i < 4; i++) { await p.evaluate(() => window.__game.clearCamps()); await drain(p); }
  await p.evaluate(() => { for (const c of window.__game.world.camps.slice(0, 4)) c.cleared = true; });
  await p.evaluate(() => window.__game.clearCamps()); await drain(p);
  await tp(0, -122); await drain(p); await p.screenshot({ path: OUT + name + '-arena-gate.png' });
  await tp(0, -140, 600); await drain(p); await p.waitForTimeout(4000); await drain(p); await p.keyboard.press('Tab'); await p.keyboard.press('q'); await p.waitForTimeout(600); await p.screenshot({ path: OUT + name + '-boss-arena.png' });
  const st = await p.evaluate(() => ({ mode: window.__game.mode, enemies: window.__game.enemies.length, gates: window.__game.world.gates.map((g) => g.kind + ':' + g.open) }));
  console.log(name, 'fps~', fps, JSON.stringify(st), errs.slice(0, 5)); await ctx.close();
}
await run('desktop', { viewport: { width: 1280, height: 720 } });
if (!process.env.ONLY) await run('mobile', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
await b.close();
