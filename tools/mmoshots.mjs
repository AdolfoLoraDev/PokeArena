import { chromium, devices } from 'playwright';
const URL = process.argv[2] || 'http://localhost:5199/';
const OUT = '/workspace/ui-shots/new-game/mmo/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const G = (p, f, a) => p.evaluate(f, a);
async function run(name, opts, touch) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = []; p.setDefaultTimeout(120000);
  await p.addInitScript(() => { if (!localStorage.getItem('pa_save_v2')) localStorage.setItem('pa_save_v2', JSON.stringify({ v: 2, quality: 'low' })); });
  p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const shot = (n) => p.screenshot({ path: OUT + name + '-' + n + '.png', timeout: 120000 });
  await p.goto(URL); await p.waitForSelector('#loading.hidden', { timeout: 30000, state: 'attached' }); await p.waitForTimeout(1500); await shot('01-title');
  await p.click('[data-go=play]'); await p.waitForTimeout(500); await shot('02-starter');
  await p.click('[data-st="4"]'); await p.waitForTimeout(2500); await shot('03-town');
  await G(p, () => { const g = window.__game; g.tp(-6, -7); }); await p.waitForTimeout(800); await shot('04-npc');
  if (touch) await p.locator('#talk').dispatchEvent('pointerdown'); else await p.keyboard.press('t');
  await p.waitForTimeout(500); await shot('05-quest-dialog'); await p.click('#mbody .mbtns button'); await p.waitForTimeout(300);
  await G(p, () => { const g = window.__game; g.tp(10, -60); }); await p.waitForTimeout(3000);
  if (touch) { const vw = opts.viewport.width, vh = opts.viewport.height; await p.locator('[data-a=atk]').dispatchEvent('pointerdown'); await p.waitForTimeout(300);
    const az = p.locator('#aimZone'); await az.dispatchEvent('pointerdown', { pointerId: 7, clientX: vw * 0.7, clientY: vh * 0.6 }); await az.dispatchEvent('pointermove', { pointerId: 7, clientX: vw * 0.7 - 30, clientY: vh * 0.6 - 30 }); await p.waitForTimeout(500); }
  else { await p.mouse.move(500, 250); await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up(); await p.keyboard.press('q'); }
  await p.waitForTimeout(600); await shot('06-meadow-combat');
  await G(p, () => { const g = window.__game; const e = g.G.enemies.sort((a, b) => a.pos.distanceTo(g.player.pos) - b.pos.distanceTo(g.player.pos))[0]; if (e) { e.hp = e.max * 0.2; g.tp(e.pos.x, e.pos.z + 3); } }); await p.waitForTimeout(400); await shot('07-catchable');
  await p.keyboard.press('c'); await p.waitForTimeout(2200); await shot('08-catch');
  await G(p, () => { const g = window.__game; g.addMon(133, 20); g.addMon(25, 22); g.save.stones.fire = 1; }); await p.keyboard.press('p'); await p.waitForTimeout(600); await shot('09-team');
  await p.click('[data-tab=skillScr]'); await p.waitForTimeout(300); await shot('10-skills');
  await p.click('[data-tab=dexScr]'); await p.waitForTimeout(500); await shot('11-dex');
  await p.click('[data-tab=questScr]'); await p.waitForTimeout(300); await shot('12-quests');
  await p.click('[data-tab=mapScr]'); await p.waitForTimeout(500); await shot('13-map'); await p.click('#ptabs .x');
  await G(p, () => { const g = window.__game; g.save.quests.q11 = { p: 1, done: true, claimed: true }; g.tp(0, -205); }); await p.waitForTimeout(1500);
  await G(p, () => window.__game.tp(0, -214)); await p.waitForTimeout(4000); await shot('14-mewtwo');
  console.log(name, JSON.stringify(await G(p, () => ({ mode: window.__game.G.mode, en: window.__game.G.enemies.length, mons: window.__game.save.mons.length, caught: window.__game.save.caught }))), errs.slice(0, 6));
  await ctx.close();
}
const mob = (w, h) => ({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
await run('desktop', { viewport: { width: 1280, height: 720 } }, false);
await run('portrait', mob(390, 844), true);
await run('landscape', mob(844, 390), true);
await b.close();
