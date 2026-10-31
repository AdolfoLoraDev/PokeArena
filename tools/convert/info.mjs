import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage(); p.on('console', m => m.type()==='error' && console.log('E', m.text().slice(0,200)));
await p.goto('http://localhost:5199/tools/convert/index.html'); await p.waitForFunction(() => window.info);
for (const n of process.argv.slice(2)) console.log(n, JSON.stringify(await p.evaluate((n) => window.info(n), n)));
await b.close();
