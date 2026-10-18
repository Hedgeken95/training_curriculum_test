// usage: node render.mjs <outDir> <shot> <fps> [startFrame] [endFrame] | node render.mjs <outDir> stills shot:t,shot:t...
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
}).listen(0);
const port = server.address().port;
const [outDir, shot, a3, a4, a5] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html?shot=over&t=0`);
await page.waitForFunction(() => window.sceneReady === true, null, { timeout: 300000 });
page.setDefaultTimeout(0);
const snap = async (s, t, file) => {
  const t0 = Date.now();
  await page.evaluate(([s, t]) => window.renderAt(s, t), [s, t]);
  await page.screenshot({ path: file, type: 'jpeg', quality: 94, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  return Date.now() - t0;
};
if (shot === 'stills') {
  for (const item of a3.split(',')) {
    const [s, t] = item.split(':');
    const ms = await snap(s, parseFloat(t), path.join(outDir, `${s}_${t}.jpg`));
    console.log(item, ms + 'ms');
  }
} else {
  const fps = parseInt(a3), dur = await page.evaluate(s => window.durations[s], shot);
  const n = Math.round(dur * fps), s0 = parseInt(a4 ?? 0), s1 = Math.min(n, parseInt(a5 ?? n));
  for (let i = s0; i < s1; i++) {
    if (fs.existsSync(path.join(outDir, `${String(i).padStart(5, '0')}.jpg`))) continue;
    const ms = await snap(shot, i / fps, path.join(outDir, `${String(i).padStart(5, '0')}.jpg`));
    if (i % 50 === 0) console.log(shot, i, '/', n, ms + 'ms');
  }
}
await browser.close(); server.close();
