import { chromium, devices } from 'playwright';
const URL = process.argv[2] || 'http://localhost:4173/';
const OUT = '/workspace/ui-shots/new-game/';
const pre = process.argv[3] || '';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
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
  await p.evaluate(() => { window.__game.kill(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { window.__game.spawnBoss(); }); await p.waitForTimeout(5500);
  await p.keyboard.press('Tab'); await p.keyboard.press('q'); await p.waitForTimeout(700); await p.screenshot({ path: OUT + pre + name + '-boss.png' });
  const st = await p.evaluate(() => ({ mode: window.__game.mode, enemies: window.__game.enemies.length, hp: window.__game.team.map((m) => Math.round(m.hp)) }));
  console.log(name, JSON.stringify(st), errs.slice(0, 5));
  await ctx.close();
}
await run('desktop', { viewport: { width: 1280, height: 720 } }, false);
await run('mobile', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent }, true);
await b.close();
