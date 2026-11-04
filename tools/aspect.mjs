import { chromium, devices } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
const p = await ctx.newPage(); p.setDefaultTimeout(120000);
await p.addInitScript(() => localStorage.setItem('pa_save_v2', JSON.stringify({ v: 2, quality: 'low' })));
await p.goto('http://localhost:5199/'); await p.waitForSelector('#loading.hidden', { state: 'attached' });
const m = () => p.evaluate(() => { const c = document.getElementById('gl'); return { css: [c.clientWidth, c.clientHeight], buf: [c.width, c.height], bufAsp: +(c.width / c.height).toFixed(3), camAsp: +window.__game.camera.aspect.toFixed(3) }; });
for (const [w, h] of [[390, 844], [844, 390], [390, 844], [1280, 720]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(800); console.log(w, h, JSON.stringify(await m())); }
await b.close();
