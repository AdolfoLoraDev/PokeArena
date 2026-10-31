import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 1400, height: 500 } }); p.on('console', m => console.log(m.text().slice(0,200)));
await p.goto('http://localhost:5199/tools/convert/preview.html#' + process.argv[2]); await p.waitForFunction(() => window.done, null, { timeout: 30000 }); await p.screenshot({ path: '/tmp/prev2.png' }); await b.close();
