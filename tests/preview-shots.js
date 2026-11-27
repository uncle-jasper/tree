#!/usr/bin/env node
// Opens the tree-packs previewer with this repo's packs.js and screenshots
// every theme on the shelf, so the effects can be checked by eye.
//
//   node tests/preview-shots.js --out DIR [--packs DIR]
//
// Serves only the two repos, side by side as on GitHub Pages:
// /tree/ is this repo, /tree-packs/ the tree-packs checkout.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes('--' + n) ? args[args.indexOf('--' + n) + 1] : d);
const ROOTS = { tree: path.join(__dirname, '..'), 'tree-packs': path.resolve(opt('packs', path.join(__dirname, '..', '..', 'tree-packs'))) };
const OUT = path.resolve(opt('out', 'preview-shots'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };

const srv = http.createServer((req, res) => {
  const [, top, ...rest] = decodeURIComponent(req.url.split('?')[0]).split('/');
  const base = ROOTS[top];
  const f = base && path.join(base, rest.join('/') || 'index.html');
  if (!f || !f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
  fs.createReadStream(f).pipe(res);
});

srv.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${srv.address().port}/tree-packs/preview.html`;
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let errors = 0;
  const index = JSON.parse(fs.readFileSync(path.join(ROOTS['tree-packs'], 'index.json'), 'utf8'));
  for (const view of [{ id: 'desktop', width: 1280, height: 860 }, { id: 'phone', width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: { width: view.width, height: view.height } });
    page.on('pageerror', e => { errors++; console.log('page error:', e.message); });
    for (const entry of index.packs) {
      const pack = JSON.parse(fs.readFileSync(path.join(ROOTS['tree-packs'], entry.file), 'utf8'));
      for (const t of pack.themes) {
        await page.goto(`${url}?pack=${pack.id}&theme=${t.id}`);
        await page.waitForTimeout(1200);
        const shown = await page.textContent('#theme-name');
        if (shown !== t.name) { errors++; console.log(`expected ${t.name}, page shows ${shown}`); }
        await page.screenshot({ path: path.join(OUT, `${view.id}--${pack.id}--${t.id}.png`) });
        console.log(view.id, pack.id, t.id);
      }
    }
    await page.close();
  }
  await browser.close();
  srv.close();
  console.log(errors ? `${errors} problem(s)` : 'no problems →', OUT);
  process.exitCode = errors ? 1 : 0;
});
