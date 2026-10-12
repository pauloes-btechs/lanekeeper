// Usage: node shoot.mjs <page.html> <out.jpg> <width> <height>
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [, , page, out, w = '1920', h = '1080'] = process.argv;
const root = path.resolve('.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto(`http://127.0.0.1:${port}/${page}`);
await pg.waitForFunction(() => window.__done === true, null, { timeout: 300000 });
const mode = await pg.evaluate(() => document.querySelector('canvas') ? 'canvas' : 'dom');
if (mode === 'canvas') {
  const url = await pg.evaluate(() => document.querySelector('canvas').toDataURL('image/jpeg', 0.93));
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
} else {
  await pg.screenshot({ path: out, type: 'jpeg', quality: 93, timeout: 120000 });
}
if (errs.length) console.log('page messages:\n' + errs.slice(0, 10).join('\n'));
await browser.close(); server.close();
console.log('saved', out);
