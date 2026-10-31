import { chromium, devices } from 'playwright';
const URL = process.argv[2] || 'http://localhost:4173/';
const OUT = process.env.OUT || '/workspace/ui-shots/new-game/';
const pre = process.argv[3] || '';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function drain(p) { for (let k = 0; k < 20; k++) { await p.waitForTimeout(250); if (await p.evaluate(() => window.__game.mode) !== 'modal') return; await p.click('#mbody .picks button').catch(() => {}); } }
async function run(name, ctxOpts, touch) {
  const ctx = await b.newContext(ctxOpts); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(URL); await p.waitForSelector('#loading.hidden', { timeout: 20000, state: 'attached' }); await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + pre + name + '-menu.png' });
  await p.click('[data-go=teamScr]'); await p.waitForTimeout(400); await p.screenshot({ path: OUT + pre + name + '-team.png' }); await p.click('#teamScr [data-go=title]');
  await p.click('[data-go=optScr]'); await p.click('[data-lang=es]'); await p.waitForTimeout(300); await p.screenshot({ path: OUT + pre + name + '-options-es.png' }); await p.click('#optScr [data-go=title]');
  await p.click('[data-go=play]'); await p.waitForTimeout(2500);
  if (!touch) { await p.mouse.move(640, 250); await p.keyboard.down('w'); await p.waitForTimeout(500); await p.keyboard.up('w'); await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up(); await p.keyboard.press('q'); await p.keyboard.press('Tab'); }
  else { await p.locator('[data-a=atk]').dispatchEvent('pointerdown'); await p.waitForTimeout(400); await p.locator('[data-a=q]').dispatchEvent('pointerdown'); }
  await p.waitForTimeout(900); await p.screenshot({ path: OUT + pre + name + '-gameplay.png' });
  await p.keyboard.press('2'); await p.waitForTimeout(300); await p.keyboard.press('e'); await p.waitForTimeout(700); await p.screenshot({ path: OUT + pre + name + '-swap.png' });
  await p.evaluate(() => { const g = window.__game; const c = g.world.camps[0]; g.tp(c.pos.x, c.pos.z + 9); }); await p.waitForTimeout(1500); await p.screenshot({ path: OUT + pre + name + '-camp.png' });
  for (let i = 0; i < 4; i++) { await p.evaluate((i) => { const g = window.__game; const c = g.world.camps[i]; g.tp(c.pos.x, c.pos.z + 6); }, i); await p.waitForTimeout(500); await p.evaluate(() => window.__game.clearCamps()); await p.waitForTimeout(300); while (await p.evaluate(() => window.__game.mode) === 'modal') { await p.click('#mbody .picks button'); await p.waitForTimeout(150); } }
  await drain(p); await p.evaluate(() => { const g = window.__game; const s = g.world.shrine; g.tp(s.x, s.z + 22); }); await p.waitForTimeout(1500); await p.screenshot({ path: OUT + pre + name + '-shrine.png' });
  await p.evaluate(() => { const g = window.__game; const s = g.world.shrine; g.tp(s.x, s.z + 4); }); await p.waitForTimeout(800); await drain(p); await p.waitForTimeout(4500);
  await p.keyboard.press('Tab'); await p.keyboard.press('q'); await p.waitForTimeout(700); await p.screenshot({ path: OUT + pre + name + '-boss.png' });
  const st = await p.evaluate(() => ({ mode: window.__game.mode, enemies: window.__game.enemies.length, hp: window.__game.team.map((m) => Math.round(m.hp)) }));
  console.log(name, JSON.stringify(st), errs.slice(0, 5));
  await ctx.close();
}
await run('desktop', { viewport: { width: 1280, height: 720 } }, false);
await run('mobile', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent }, true);
await b.close();
