import { chromium } from 'playwright'; import fs from 'fs';
const b = await chromium.launch(); const p = await b.newPage(); p.on('console', m => m.type()==='error' && console.log('E', m.text().slice(0,200)));
await p.goto('http://localhost:5199/tools/convert/index.html'); await p.waitForFunction(() => window.convert);
fs.mkdirSync('public/assets/nature', { recursive: true });
for (const a of process.argv.slice(2)) { const [n, r] = a.split(':'); const res = await p.evaluate(([n, r]) => window.convert(n, r === 'x'), [n, r]);
  fs.writeFileSync(`public/assets/nature/${n}.glb`, Buffer.from(res.b64, 'base64')); console.log(n, res.size.map(v=>v.toFixed(1)).join('x'), fs.statSync(`public/assets/nature/${n}.glb`).size); }
await b.close();
