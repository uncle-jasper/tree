#!/usr/bin/env node
// Theme packs safety net (PACKS-PLAN.md, phase 1).
//
//   node baseline/run.js fixtures [--ginkgo DIR]
//       Drive today's Tree and Ginkgo through their own settings code and save
//       exactly what each writes to localStorage, one file per theme setting,
//       in baseline/fixtures/<app>/.
//
//   node baseline/run.js capture [--ginkgo DIR] [--out DIR] [--only ID,ID]
//       Load each fixture into a fresh browser and screenshot the app:
//       desktop write, desktop preview, phone write. Default out:
//       baseline/shots. Clock, randomness and time zone are fixed, so two
//       captures of the same code are identical pixel for pixel.
//
//   node baseline/run.js compare A B [--report DIR] [--exact]
//       Compare two capture folders, ignoring invisible 1–2 level noise. Writes a diff image for every shot that
//       changed and an HTML report. Exit code 1 if anything changed.
//
// --tree defaults to this repo, --ginkgo to ../ginkgo next to it.
// Needs only Playwright with Chromium; nothing here ships with the apps.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const HERE = __dirname;
const args = process.argv.slice(2);
const cmd = args[0];
function opt(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
}
const ROOTS = {
  tree:   path.resolve(opt('tree', path.join(HERE, '..'))),
  ginkgo: path.resolve(opt('ginkgo', path.join(HERE, '..', '..', 'ginkgo'))),
};

// ── What gets captured ────────────────────────────────────────────────
// Each entry is one way a person can have their theme set up today.
// `make` runs inside the editor (Tree's page, Ginkgo's editor iframe) using
// the app's own functions, so the saved settings are the app's real output.
// `session` is an easter egg that is never saved; capture re-enters it with
// the real key sequence. `after` is where PACKS-PLAN.md says it must land.
const FIXTURES = [
  { id: 'first-run',  label: 'nothing saved yet',             make: null,                      after: { pack: 'classic', theme: 'parchment' } },
  { id: 'parchment',  label: 'parchment',                     make: { theme: 'parchment' },    after: { pack: 'classic', theme: 'parchment' } },
  { id: 'paper',      label: 'paper',                         make: { theme: 'paper' },        after: { pack: 'classic', theme: 'paper' } },
  { id: 'ash',        label: 'ash',                           make: { theme: 'ash' },          after: { pack: 'classic', theme: 'ash' } },
  { id: 'sage',       label: 'sage',                          make: { theme: 'sage' },         after: { pack: 'classic', theme: 'sage' } },
  { id: 'dark',       label: 'dark',                          make: { theme: 'dark' },         after: { pack: 'classic', theme: 'dark' } },
  { id: 'moss',       label: 'moss',                          make: { theme: 'moss' },         after: { pack: 'classic', theme: 'moss' } },
  { id: 'slate',      label: 'slate',                         make: { theme: 'slate' },        after: { pack: 'classic', theme: 'slate' } },
  { id: 'custom',     label: 'custom 1 (light, line cursor)', make: { custom: { slot: 'custom', bg: '#efe6d2', text: '#2b2420', accent: '#9a4a2c', name: 'kraft', cursor: 'line' } },
                                                                                               after: { pack: 'classic', theme: 'custom' } },
  { id: 'custom2',    label: 'custom 2 (dark, readable on, block cursor)', make: { custom: { slot: 'custom2', bg: '#101820', text: '#d8e2ea', accent: '#ff4fa3', name: 'night market', cursor: 'block', readable: true } },
                                                                                               after: { pack: 'classic', theme: 'custom2' } },
  { id: 'custom3',    label: 'custom 3 (readable off, underline cursor)', make: { custom: { slot: 'custom3', bg: '#1d2a22', text: '#cfe3c8', accent: '#e0b44c', name: 'tea field', cursor: 'underline', readable: false } },
                                                                                               after: { pack: 'classic', theme: 'custom3' } },
  { id: 'gameboy',    label: 'game boy',                      make: { theme: 'gameboy' },      after: { pack: 'retro', theme: 'gameboy' } },
  { id: 'moonwalker', label: 'moonwalker',                    make: { theme: 'moonwalker' },   after: { pack: 'retro', theme: 'moonwalker' } },
  { id: 'terminal',   label: 'terminal, crt off',             make: { theme: 'terminal' },     after: { pack: 'retro', theme: 'terminal', switches: { crt: false } } },
  { id: 'terminal-crt', label: 'terminal, crt on',            make: { theme: 'terminal', checks: { 'chk-crt': true } },
                                                                                               after: { pack: 'retro', theme: 'terminal', switches: { crt: true } } },
  { id: 'amber-crt',  label: 'amber crt (Konami, session only)', make: { theme: 'terminal', checks: { 'chk-crt': true } }, session: 'amber-crt',
                                                                                               after: { pack: 'retro', theme: 'terminal', switches: { crt: true }, note: 'amber crt becomes an ordinary Retro theme; a saved setting can only ever say terminal + crt' } },
  { id: 'doogie-journal', label: 'doogie journal (ABACABB, session only)', make: { theme: 'terminal', checks: { 'chk-crt': true } }, session: 'doogie-journal',
                                                                                               after: { pack: 'retro', theme: 'terminal', switches: { crt: true }, note: 'doogie journal becomes an ordinary Retro theme; a saved setting can only ever say terminal + crt' } },
  { id: 'rain',       label: 'rain, downpour off',            make: { theme: 'rain' },         after: { pack: 'rain', theme: 'rain', switches: { 'falling rain': false } } },
  { id: 'rain-downpour', label: 'rain, downpour on, falling rain on', make: { theme: 'rain', checks: { 'chk-downpour': true } },
                                                                                               after: { pack: 'rain', theme: 'downpour', switches: { 'falling rain': true } } },
  { id: 'rain-downpour-still', label: 'rain, downpour on, falling rain off', make: { theme: 'rain', checks: { 'chk-downpour': true, 'chk-falling': false } },
                                                                                               after: { pack: 'rain', theme: 'downpour', switches: { 'falling rain': false } } },
];

const VIEWS = [
  { id: 'desktop', viewport: { width: 1280, height: 800 }, modes: ['write', 'preview'] },
  { id: 'phone',   viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, modes: ['write'] },
];

const NOW = new Date('2026-11-12T09:30:00+08:00');
const SAMPLE = fs.readFileSync(path.join(HERE, 'sample.md'), 'utf8');
const APPS = (opt('apps', 'tree,ginkgo')).split(',');

// ── Tiny static server, one per app ───────────────────────────────────
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
                '.png': 'image/png', '.txt': 'text/plain', '.css': 'text/css', '.woff2': 'font/woff2' };
function serve(root) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' }));
  });
}

// Same seed every run, so every "random" message and raindrop repeats.
// Real-time events (font and iframe loading, IndexedDB) can land between
// fake-clock ticks in a different order each run and use up random numbers
// unevenly, so settle() re-seeds every frame once loading is over.
const SEEDED_RANDOM = `(() => { let s; window.__reseed = () => { s = 0x2f6b1d; }; window.__reseed();
  Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;

// Re-seed, refill the falling rain from the new seed (the apps' own resize
// handler does that), then run long enough for status messages to finish.
async function settle(page) {
  for (const f of page.frames()) await f.evaluate(() => {
    if (window.__reseed) window.__reseed();
    window.dispatchEvent(new Event('resize'));
  }).catch(() => {});
  await page.clock.runFor(6000);
}

// What screenshot({ animations: 'disabled' }) does, but in every frame (it
// misses Ginkgo's editor iframe): finished transitions and one-off
// animations jump to their end, endless ones (crt flicker) to their start.
async function freeze(page) {
  await page.waitForTimeout(400);
  for (const f of page.frames()) await f.evaluate(() => {
    for (const a of document.getAnimations()) {
      const t = a.effect && a.effect.getComputedTiming();
      if (t && t.iterations === Infinity) { a.pause(); a.currentTime = 0; } else a.finish();
    }
  }).catch(() => {});
}

async function newPage(browser, view, storage) {
  const ctx = await browser.newContext({
    viewport: view.viewport, isMobile: !!view.isMobile, hasTouch: !!view.hasTouch, deviceScaleFactor: 1,
    serviceWorkers: 'block', timezoneId: 'Asia/Taipei', locale: 'en-US',
  });
  await ctx.addInitScript(SEEDED_RANDOM);
  await ctx.addInitScript(items => {
    if (window !== window.top) return;           // the Ginkgo iframe shares the origin; set once
    try { for (const k in items) localStorage.setItem(k, items[k]); } catch (e) {}
  }, storage);
  const page = await ctx.newPage();
  // Paused: time moves only when runFor says, never with the wall clock.
  await page.clock.install({ time: new Date(NOW.getTime() - 1000) });
  await page.clock.pauseAt(NOW);
  page.on('dialog', d => d.accept());           // Tree: "restore unsaved draft?" → yes
  page.on('pageerror', e => console.warn('  page error:', e.message));
  return { ctx, page };
}

// The window the editor code runs in.
async function editorFrame(app, page) {
  if (app === 'tree') return page.mainFrame();
  for (let i = 0; i < 50; i++) {
    const f = page.frames().find(fr => fr.url().endsWith('editor.html'));
    if (f && await f.evaluate(() => typeof setTheme === 'function').catch(() => false)) return f;
    await page.clock.runFor(100);
  }
  throw new Error('Ginkgo editor iframe never loaded');
}

async function open(app, browser, view, settings, withSample) {
  const storage = { 'ginkgo-loc-weather-enabled': '0', 'ginkgo-install-hint-dismissed': '1' };
  if (settings) storage['tree-editor-settings'] = JSON.stringify(settings);
  if (withSample && app === 'tree') {
    storage['tree-autosave-content'] = SAMPLE;
    storage['tree-autosave-name'] = 'three-stops.md';
    storage['tree-autosave-savedAt'] = NOW.toISOString();
  }
  const { ctx, page } = await newPage(browser, view, storage);
  const srv = await serve(ROOTS[app]);
  await page.goto(srv.url, { waitUntil: 'load' });
  await page.clock.runFor(3000);
  const frame = await editorFrame(app, page);
  if (withSample && app === 'ginkgo') {
    await page.click('#btn-new-entry');
    for (let i = 0; i < 100 && !(await frame.evaluate(() => view.state.doc.lines > 1)); i++) await page.clock.runFor(100);
    // A new entry is "<date>\n## \n\n": the sample's title goes on the "## " line.
    await frame.evaluate(() => { view.focus(); view.dispatch({ selection: { anchor: view.state.doc.line(2).to } }); });
    await page.keyboard.insertText(SAMPLE.replace(/^# /, ''));
    await page.clock.runFor(1500);
  }
  return { ctx, page, frame, srv };
}

// ── fixtures ──────────────────────────────────────────────────────────
async function makeFixtures() {
  const browser = await chromium.launch();
  for (const app of APPS) {
    const dir = path.join(HERE, 'fixtures', app);
    fs.mkdirSync(dir, { recursive: true });
    const commit = gitHead(ROOTS[app]);
    for (const fx of FIXTURES) {
      const { ctx, frame, page, srv } = await open(app, browser, VIEWS[0], null, false);
      if (fx.make) {
        await frame.evaluate(m => {
          if (m.custom) {
            const c = m.custom, slot = CUSTOM_SLOTS.find(s => s.key === c.slot), sfx = slot.sfx;
            for (const [id, v] of [['color-bg', c.bg], ['color-text', c.text], ['color-accent', c.accent]]) {
              document.getElementById(id + sfx).value = v;
              document.getElementById(id.replace('color', 'hex') + sfx).value = v;
            }
            document.getElementById('custom-name' + sfx).value = c.name;
            document.getElementById('custom-cursor' + sfx).value = c.cursor;
            if (c.readable !== undefined) readableChoice[c.slot] = c.readable;
            setTheme(c.slot);
          } else {
            setTheme(m.theme);
          }
          for (const [id, on] of Object.entries(m.checks || {})) {
            const el = document.getElementById(id);
            el.checked = on;
            el.dispatchEvent(new Event('change'));
          }
          saveSettings();
        }, fx.make);
        await page.clock.runFor(500);
      }
      const raw = await frame.evaluate(() => localStorage.getItem('tree-editor-settings'));
      const out = {
        id: fx.id, label: fx.label, app, madeFrom: commit,
        settings: raw ? JSON.parse(raw) : null,
        session: fx.session || null,
        after: fx.after,
      };
      fs.writeFileSync(path.join(dir, fx.id + '.json'), JSON.stringify(out, null, 2) + '\n');
      console.log(app, fx.id, raw ? 'theme=' + out.settings.theme : '(nothing saved)');
      srv.srv.close(); await ctx.close();
    }
  }
  await browser.close();
}

// ── capture ───────────────────────────────────────────────────────────
async function enterSession(page, frame, session) {
  await frame.click('.cm-content');
  await page.keyboard.press('Control+End');
  if (session === 'amber-crt') {
    for (const k of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'])
      await page.keyboard.press(k);
  } else if (session === 'doogie-journal') {
    await page.keyboard.press('Enter');
    for (const k of 'abacabb') await page.keyboard.press(k);
  }
  await page.clock.runFor(4000);
  const on = await frame.evaluate(c => document.body.classList.contains(c), session);
  if (!on) throw new Error(session + ' did not switch on');
}

async function capture() {
  const out = path.resolve(opt('out', path.join(HERE, 'shots')));
  const only = opt('only') ? opt('only').split(',') : null;
  const browser = await chromium.launch();
  for (const app of APPS) {
    for (const fx of FIXTURES) {
      if (only && !only.includes(fx.id)) continue;
      const file = path.join(HERE, 'fixtures', app, fx.id + '.json');
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const view of VIEWS) {
        const { ctx, page, frame, srv } = await open(app, browser, view, saved.settings, true);
        if (saved.session) await enterSession(page, frame, saved.session);
        // Park the cursor at the top so every shot shows the same lines.
        await frame.evaluate(() => { if (typeof view !== 'undefined' && view) { view.dispatch({ selection: { anchor: 0 } }); view.contentDOM.blur(); } });
        await settle(page);
        for (const mode of view.modes) {
          if (mode !== 'write') {
            await frame.evaluate(m => setMode(m), mode);
            await settle(page);
          }
          const dir = path.join(out, app, view.id);
          fs.mkdirSync(dir, { recursive: true });
          await freeze(page);
          await page.screenshot({ path: path.join(dir, fx.id + '--' + mode + '.png'), animations: 'disabled', caret: 'hide' });
        }
        console.log(app, view.id, fx.id);
        srv.srv.close(); await ctx.close();
      }
    }
  }
  await browser.close();
  if (!only) writeGallery(out);
}

// One page showing every shot, grouped by setting, for looking through by eye.
function writeGallery(out) {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const where = a => [a.pack, a.theme].join(' › ') + Object.entries(a.switches || {}).map(([k, v]) => ', ' + k + ' ' + (v ? 'on' : 'off')).join('');
  const shots = [];
  for (const app of APPS) for (const v of VIEWS) for (const m of v.modes) shots.push({ app, v: v.id, m });
  const sections = FIXTURES.map(fx => `<section id="${fx.id}"><h2>${esc(fx.label)}</h2><p>after the update: ${esc(where(fx.after))}${fx.after.note ? ' — ' + esc(fx.after.note) : ''}</p>
<div class="row">${shots.map(s => { const src = `${s.app}/${s.v}/${fx.id}--${s.m}.png`;
  return `<figure class="${s.v}"><a href="${src}"><img loading="lazy" src="${src}"></a><figcaption>${s.app} · ${s.v} · ${s.m}</figcaption></figure>`; }).join('')}</div></section>`).join('\n');
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Theme baseline</title>
<style>body{font:14px ui-monospace,Menlo,monospace;margin:24px;background:#f5f0e8;color:#2b2420}h1{font-size:18px}h2{font-size:15px;margin:32px 0 4px}p{margin:0 0 10px;color:#7a6a58}
.row{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px}figure{margin:0;flex:none}figure.desktop img{width:320px}figure.phone img{width:100px}img{display:block;border:1px solid #d8cfc0}figcaption{font-size:11px;color:#7a6a58;margin-top:3px}
nav a{color:#9a6a3c;margin-right:10px}</style>
<h1>Theme baseline — Tree and Ginkgo before theme packs</h1>
<p>Captured from the saved-settings fixtures in baseline/fixtures. Click any shot for full size.</p>
<nav>${FIXTURES.map(f => `<a href="#${f.id}">${esc(f.id)}</a>`).join('')}</nav>
${sections}`);
  console.log('gallery →', path.join(out, 'index.html'));
}

// ── compare ───────────────────────────────────────────────────────────
function listPngs(dir) {
  const res = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.png')) res.push(path.relative(dir, p));
    }
  })(dir);
  return res.sort();
}

// Chromium's GPU compositing can move a few pixels by one level out of 255
// between identical runs (seen only in Ginkgo's iframe). Ignore differences
// of 2 levels or less; --exact counts every one.
const TOLERANCE = args.includes('--exact') ? 0 : 2;

async function compare() {
  const [a, b] = [path.resolve(args[1]), path.resolve(args[2])];
  const report = path.resolve(opt('report', path.join(b, '..', 'compare-report')));
  fs.mkdirSync(report, { recursive: true });
  const names = [...new Set([...listPngs(a), ...listPngs(b)])].sort();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const rows = [];
  for (const n of names) {
    const fa = path.join(a, n), fb = path.join(b, n);
    if (!fs.existsSync(fa) || !fs.existsSync(fb)) { rows.push({ n, status: fs.existsSync(fa) ? 'missing after' : 'new' }); continue; }
    const r = await page.evaluate(async ([da, db, tol]) => {
      const load = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(da), load(db)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { sizeChanged: true };
      const w = ia.width, h = ia.height, cv = document.createElement('canvas');
      cv.width = w; cv.height = h; const cx = cv.getContext('2d');
      cx.drawImage(ia, 0, 0); const pa = cx.getImageData(0, 0, w, h).data;
      cx.drawImage(ib, 0, 0); const img = cx.getImageData(0, 0, w, h), pb = img.data;
      let diff = 0;
      for (let i = 0; i < pa.length; i += 4) {
        const d = Math.max(Math.abs(pa[i] - pb[i]), Math.abs(pa[i + 1] - pb[i + 1]), Math.abs(pa[i + 2] - pb[i + 2]));
        if (d > tol) { diff++; pb[i] = 255; pb[i + 1] = 0; pb[i + 2] = 64; pb[i + 3] = 255; }
        else { pb[i] = pb[i + 1] = pb[i + 2] = (pa[i] + pa[i + 1] + pa[i + 2]) / 3 * 0.35 + 160; }
      }
      if (!diff) return { diff: 0 };
      cx.putImageData(img, 0, 0);
      return { diff, pct: diff / (w * h) * 100, png: cv.toDataURL('image/png') };
    }, [dataUrl(fa), dataUrl(fb), TOLERANCE]);
    if (r.sizeChanged) rows.push({ n, status: 'size changed' });
    else if (!r.diff) rows.push({ n, status: 'same' });
    else {
      const out = path.join(report, n.replace(/[\\/]/g, '__'));
      fs.writeFileSync(out, Buffer.from(r.png.split(',')[1], 'base64'));
      rows.push({ n, status: 'changed', pct: r.pct, diffImg: path.basename(out) });
    }
  }
  await browser.close();
  const changed = rows.filter(r => r.status !== 'same');
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  fs.writeFileSync(path.join(report, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Theme comparison</title>
<style>body{font:14px system-ui;margin:24px;background:#f5f0e8;color:#2b2420}img{max-width:32%;border:1px solid #ccc;vertical-align:top}h2{font-size:15px;margin-top:28px}</style>
<h1>${changed.length ? changed.length + ' of ' + rows.length + ' shots differ' : 'All ' + rows.length + ' shots identical'}</h1>
<p>before: ${esc(a)}<br>after: ${esc(b)}</p>
${changed.map(r => `<h2>${esc(r.n)} — ${r.status}${r.pct ? ' (' + r.pct.toFixed(2) + '% of pixels)' : ''}</h2>
${r.status === 'changed' ? `<img src="${dataUrl(path.join(a, r.n))}"><img src="${dataUrl(path.join(b, r.n))}"><img src="${r.diffImg}">` : ''}`).join('\n')}`);
  for (const r of changed) console.log(r.status.padEnd(14), r.n, r.pct ? r.pct.toFixed(3) + '%' : '');
  console.log(changed.length ? `${changed.length} of ${rows.length} differ` : `all ${rows.length} identical`, '→', path.join(report, 'index.html'));
  process.exitCode = changed.length ? 1 : 0;
}

function dataUrl(f) { return 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'); }
function gitHead(dir) {
  try { return execSync('git rev-parse --short HEAD', { cwd: dir }).toString().trim(); } catch (e) { return 'unknown'; }
}

({ fixtures: makeFixtures, capture, compare }[cmd] || (() => { console.log('usage: run.js fixtures | capture | compare A B'); }))()
  .catch(e => { console.error(e); process.exit(2); });
