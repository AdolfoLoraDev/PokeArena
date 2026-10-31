import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.goto(process.argv[2]); await p.waitForSelector('#loading.hidden', { state: 'attached' }); await p.waitForTimeout(1000);
await p.click('[data-go=play]'); await p.waitForTimeout(1000);
await p.evaluate(() => { window.__game.kill(); window.__game.spawnBoss(); });
for (let i = 0; i < 4; i++) { await p.waitForTimeout(1200); await p.screenshot({ path: '/workspace/ui-shots/new-game/probe' + i + '.png' });
  console.log(JSON.stringify(await p.evaluate(() => { const e = window.__game.enemies[0]; let f = 0; const t0 = performance.now(); return e && { st: e.state, vis: e.bb.group.visible, pos: e.pos.toArray().map(Math.round), y: e.bb.group.position.y.toFixed(2), mesh: e.bb.mesh.position.toArray().map(v=>v.toFixed(2)), sc: e.bb.mesh.scale.toArray().map(v=>v.toFixed(2)), anim: e.bb.anim, hasMap: !!e.bb.mat.map, inv: e.inv.toFixed(2) }; }))); }
await p.screenshot({ path: '/workspace/ui-shots/new-game/probe.png' });
await b.close();
