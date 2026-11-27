#!/usr/bin/env node
// Tests for packs.js (PACKS-PLAN.md, phase 2).
//
//   node tests/packs-test.js [--packs DIR]
//
// --packs is a tree-packs checkout (default ../tree-packs next to this repo);
// its pack files are the real-world input. Needs Node, and Playwright with
// Chromium for the browser half.

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const PACKS_DIR = path.resolve(args[args.indexOf('--packs') + 1] && args.includes('--packs')
  ? args[args.indexOf('--packs') + 1] : path.join(ROOT, '..', 'tree-packs'));
const TP = require(path.join(ROOT, 'packs.js'));

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.message.split('\n').join('\n      ')); }
}
const shelf = id => JSON.parse(fs.readFileSync(path.join(PACKS_DIR, 'packs', id + '.tree-pack.json'), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));

(async () => {
  console.log('reading packs');
  await test('both launch packs pass, unchanged in substance', () => {
    for (const id of ['rain', 'judgment-day']) {
      const raw = shelf(id), r = TP.check(raw);
      assert.ok(r.ok, r.error);
      assert.strictEqual(r.pack.themes.length, raw.themes.length);
      r.pack.themes.forEach((t, i) => {
        assert.deepStrictEqual(t.colors, raw.themes[i].colors);
        assert.strictEqual(t.effects.length, (raw.themes[i].effects || []).length, t.id + ': an effect was dropped');
      });
    }
  });
  await test('a pack can be given as text', () => assert.ok(TP.check(fs.readFileSync(path.join(PACKS_DIR, 'packs', 'rain.tree-pack.json'), 'utf8')).ok));
  await test('every refusal is one plain line', () => {
    const base = shelf('rain');
    const cases = [
      ['not json {', "isn't readable JSON"],
      [{ hello: 1 }, "isn't a pack file"],
      [Object.assign(clone(base), { treePack: 2 }), 'newer version'],
      [Object.assign(clone(base), { id: 'Rain!' }), 'ID'],
      [Object.assign(clone(base), { name: '' }), 'no name'],
      [Object.assign(clone(base), { version: '1.0' }), 'version'],
      [Object.assign(clone(base), { description: ' ' }), 'no description'],
      [(() => { const p = clone(base); delete p.description; return p; })(), 'no description'],
      [Object.assign(clone(base), { themes: [] }), 'no themes'],
      [Object.assign(clone(base), { everyday: 'sunshine' }), 'everyday'],
      [(() => { const p = clone(base); p.themes[1].id = p.themes[0].id; return p; })(), 'share the ID'],
      [(() => { const p = clone(base); p.themes[0].colors.bg = 'red'; return p; })(), 'bg should be a color'],
      [(() => { const p = clone(base); p.themes = Array(9).fill(p.themes[0]); return p; })(), 'at most 8'],
    ];
    for (const [input, words] of cases) {
      const r = TP.check(input);
      assert.ok(!r.ok, 'accepted: ' + JSON.stringify(input).slice(0, 60));
      assert.ok(r.error.includes(words), `"${r.error}" should mention "${words}"`);
      assert.ok(!r.error.includes('\n'));
    }
  });
  await test('numbers are clamped, text is cut, unknown things are dropped', () => {
    const p = clone(shelf('rain'));
    p.name = 'A very long pack name that keeps going';
    p.themes[0].effects = [
      { type: 'particles', density: 99, speed: -5, slant: 2, color: 'javascript:alert(1)' },
      { type: 'native', className: 'evil' },                // built-in only
      { type: 'shader', code: 'x' },                         // unknown type
      { type: 'glow', target: 'body', strength: 1 },        // unknown target
      { type: 'sheen', colors: ['#fff'] },                   // too few colors
    ];
    p.themes[0].onload = 'alert(1)';
    const r = TP.check(p);
    assert.ok(r.ok, r.error);
    assert.strictEqual(r.pack.name.length, 24);
    const t = r.pack.themes[0];
    assert.strictEqual(t.effects.length, 1);
    assert.deepStrictEqual([t.effects[0].density, t.effects[0].speed, t.effects[0].slant, t.effects[0].color], [3, 0.2, 0.5, null]);
    assert.strictEqual(t.onload, undefined);
    assert.strictEqual(t.native, undefined);
  });
  await test('version comparison', () => {
    assert.ok(TP.newer('1.0.0', '1.0.1')); assert.ok(TP.newer('1.2.0', '1.10.0'));
    assert.ok(!TP.newer('1.0.0', '1.0.0')); assert.ok(!TP.newer('2.0.0', '1.9.9'));
  });

  console.log('built-in packs');
  await test('Classic and Retro hold the themes the plan lists', () => {
    const [classic, retro] = TP.BUILTIN;
    assert.deepStrictEqual(classic.themes.map(t => t.name), ['parchment', 'paper', 'ash', 'sage', 'dark', 'moss', 'slate', 'custom', 'custom 2', 'custom 3']);
    assert.deepStrictEqual(retro.themes.map(t => t.name), ['game boy', 'moonwalker', 'terminal', 'amber terminal', 'doogie journal']);
    assert.deepStrictEqual(TP.switchesOf(TP.findTheme(retro, 'terminal')), [{ label: 'crt', on: false }]);
  });
  await test("built-in colors match today's theme CSS in Tree", () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const t of TP.BUILTIN.flatMap(p => p.themes)) {
      if (t.custom) continue;
      let block;
      if (t.id === 'parchment') block = html.match(/:root\s*{([^}]*)}/)[1];
      else if (t.id === 'amber-crt') block = '--bg:#0a0a0a;--surface:#0f0f0f;' + html.match(/body\[data-theme="terminal"\]\.amber-crt\s*{([^}]*)}/)[1];
      else if (t.id === 'doogie-journal') block = html.match(/body\[data-theme="terminal"\]\.doogie-journal\s*{([^}]*)}/)[1];
      else block = html.match(new RegExp(`body\\[data-theme="${t.id}"\\]\\s*{([^}]*)}`))[1];
      for (const k of ['bg', 'surface', 'text', 'accent', 'muted', 'border']) {
        const m = block.match(new RegExp(`--?${k}:\\s*(#[0-9a-fA-F]{6})`));
        assert.ok(m, `${t.id} ${k} not found`);
        assert.strictEqual(t.colors[k], m[1].toLowerCase(), `${t.id} ${k}`);
      }
    }
  });
  await test('custom slots take the person\'s colors', () => {
    const t = TP.customTheme('custom2', { bg: '#101820', text: '#d8e2ea', accent: '#ff4fa3', name: 'night market' });
    assert.strictEqual(t.name, 'night market'); assert.strictEqual(t.colors.bg, '#101820'); assert.ok(!t.light);
    assert.ok(t.native && t.native.theme === 'custom2');
  });

  console.log('old settings (every phase-1 fixture)');
  for (const app of ['tree', 'ginkgo']) {
    const dir = path.join(ROOT, 'baseline', 'fixtures', app);
    await test(`${app}: all ${fs.readdirSync(dir).length} fixtures land where the plan says`, () => {
      for (const f of fs.readdirSync(dir)) {
        const fx = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const want = { pack: fx.after.pack, theme: fx.after.theme, switches: fx.after.switches || {} };
        assert.deepStrictEqual(TP.fromLegacy(fx.settings), want, f);
      }
    });
  }
  await test('every landing spot exists', () => {
    const packs = [...TP.BUILTIN, TP.check(shelf('rain')).pack];
    for (const s of [null, { theme: 'moss' }, { theme: 'terminal', crtEnabled: true }, { theme: 'rain', downpour: true }, { theme: 'gone' }]) {
      const l = TP.fromLegacy(s), p = packs.find(x => x.id === l.pack), t = TP.findTheme(p, l.theme);
      assert.ok(t, JSON.stringify(s));
      for (const k of Object.keys(l.switches)) assert.ok(TP.switchesOf(t).some(x => x.label === k), `${t.id} has no "${k}" switch`);
    }
  });

  console.log('pack row and theme row');
  const rain = TP.check(shelf('rain')).pack;
  await test('a pack opens on its everyday theme, then on the one last used', () => {
    assert.strictEqual(TP.openingTheme(rain, {}).id, 'rain');
    assert.strictEqual(TP.openingTheme(rain, { rain: 'wet-neon' }).id, 'wet-neon');
    assert.strictEqual(TP.openingTheme(rain, { rain: 'removed-theme' }).id, 'rain');
  });
  await test('the theme row steps within the pack and wraps', () => {
    assert.strictEqual(TP.stepTheme(rain, 'wet-neon', 1).id, 'overcast');
    assert.strictEqual(TP.stepTheme(rain, 'overcast', -1).id, 'wet-neon');
    assert.strictEqual(TP.stepTheme(rain, 'rain', 1).id, 'downpour');
  });
  await test('switches: falling rain on by default for downpour and wet neon only', () => {
    const on = rain.themes.filter(t => TP.switchesOf(t).some(s => s.label === 'falling rain' && s.on)).map(t => t.id);
    assert.deepStrictEqual(on, ['downpour', 'wet-neon']);
    const neon = TP.findTheme(rain, 'wet-neon');
    assert.strictEqual(TP.activeEffects(neon, { 'falling rain': false }).length, 2);
    assert.strictEqual(TP.activeEffects(neon, {}).length, 3);
  });
  await test('saved colors survive without the pack', () => {
    const t = TP.findTheme(rain, 'wet-neon'), m = JSON.parse(JSON.stringify(TP.remember(rain, t)));
    const back = TP.fromMemory(m);
    assert.deepStrictEqual(back.colors, t.colors); assert.strictEqual(back.effects.length, 0);
    assert.strictEqual(TP.fromMemory({ colors: { bg: 'url(x)' } }), null);
  });

  console.log('in the browser');
  await browserTests();

  console.log(failed ? `\n${failed} failed, ${passed} passed.` : `\nAll ${passed} passed.`);
  process.exit(failed ? 1 : 0);
})();

// ── Browser half ─────────────────────────────────────────────────────────
// Tree before packs (its own rain code), from git, for comparing rain with.
const PRE_PACKS = 'b0daef2';
let oldTree = null;
function serve(root) {
  if (!oldTree) oldTree = require('child_process').execSync(`git show ${PRE_PACKS}:index.html`, { cwd: ROOT, maxBuffer: 64 << 20 });
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      if (p === '/old/index.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(oldTree); }
      if (p.startsWith('/old/')) p = p.slice(4);
      const f = path.join(root, p);
      if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript' }[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, url: 'http://127.0.0.1:' + srv.address().port + '/' }));
  });
}

async function browserTests() {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  const { srv, url } = await serve(ROOT);
  const SEED = `(() => { let s; window.__reseed = () => { s = 0x2f6b1d; }; window.__reseed();
    Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;
  const downpourFixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'baseline', 'fixtures', 'tree', 'rain-downpour.json'), 'utf8'));

  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await test(`falling rain matches pre-packs Tree's downpour drop for drop (${vp.width}×${vp.height}, 240 frames)`, async () => {
      const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block' });
      await ctx.addInitScript(SEED);
      await ctx.addInitScript(s => localStorage.setItem('tree-editor-settings', s), JSON.stringify(downpourFixture.settings));
      const page = await ctx.newPage();
      await page.clock.install({ time: new Date('2026-11-12T01:29:00Z') }); await page.clock.pauseAt(new Date('2026-11-12T01:30:00Z'));
      await page.goto(url + 'old/', { waitUntil: 'load' });   // Tree before packs, with its own rain
      await page.addScriptTag({ url: url + 'packs.js' });
      const downpour = TP.check(shelf('rain')).pack.themes.find(t => t.id === 'downpour');
      const r = await page.evaluate(async theme => {
        const FRAMES = 240;
        const pixels = c => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        // Tree's own rain, stepped by hand.
        __reseed(); rainSize(); rainFill(true);
        for (let i = 0; i < FRAMES; i++) { rain.running = true; rainStep(); cancelAnimationFrame(rain.frame); }
        const a = pixels(rain.canvas);
        // The engine's, from the same seed.
        const host = document.createElement('div'); document.body.appendChild(host);
        __reseed();
        const stage = TreePacks.createStage({ root: host, layers: host });
        stage.apply(theme, {});
        const drops = stage.rains[0];
        for (let i = 0; i < FRAMES; i++) { drops._internals.step(); cancelAnimationFrame(drops.frame); }
        const b = pixels(drops.canvas);
        let diff = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
        const lit = a.some((v, i) => i % 4 === 3 && v > 0);
        return { diff, lit, len: a.length, same: a.length === b.length };
      }, downpour);
      await ctx.close();
      assert.ok(r.same, 'canvas sizes differ');
      assert.ok(r.lit, 'nothing was drawn');
      assert.strictEqual(r.diff, 0, `${r.diff} pixel values differ`);
    });
  }

  await test('apply and clear leave the page as it was', async () => {
    const page = await browser.newPage();
    await page.goto(url + 'tests/blank.html');
    const r = await page.evaluate(packs => {
      const before = document.body.outerHTML + document.head.innerHTML;
      const stage = TreePacks.createStage();
      for (const p of packs) for (const t of p.themes) stage.apply(t, {});
      stage.apply(TreePacks.BUILTIN[1].themes[2], { crt: true });
      const crt = document.body.dataset.theme === 'terminal' && document.body.classList.contains('crt-on');
      stage.destroy();
      delete document.body.dataset.theme;
      return { crt, same: before === document.body.outerHTML + document.head.innerHTML };
    }, [TP.check(shelf('rain')).pack, TP.check(shelf('judgment-day')).pack]);
    await page.close();
    assert.ok(r.crt, 'terminal with crt on should set data-theme and crt-on');
    assert.ok(r.same, 'something was left behind');
  });

  await test('turning falling rain off lets the drops finish; on again starts from the top', async () => {
    const page = await browser.newPage();
    await page.clock.install({ time: new Date('2026-11-12T01:29:00Z') }); await page.clock.pauseAt(new Date('2026-11-12T01:30:00Z'));
    await page.goto(url + 'tests/blank.html');
    const downpour = TP.check(shelf('rain')).pack.themes.find(t => t.id === 'downpour');
    await page.evaluate(t => { window.stage = TreePacks.createStage(); stage.apply(t, {}); }, downpour);
    await page.clock.runFor(500);
    await page.evaluate(t => stage.apply(t, { 'falling rain': false }), downpour);
    const mid = await page.evaluate(() => stage.rains[0].drops.filter(Boolean).length);
    await page.clock.runFor(5000);
    const after = await page.evaluate(() => ({ n: stage.rains[0].drops.length, running: stage.rains[0].running }));
    await page.evaluate(t => stage.apply(t, { 'falling rain': true }), downpour);
    const restart = await page.evaluate(() => stage.rains[0].drops.every(d => d.y < 0));
    await page.close();
    assert.ok(mid > 50, 'drops should still be falling right after the switch');
    assert.deepStrictEqual(after, { n: 0, running: false });
    assert.ok(restart, 'new drops should start above the top');
  });

  await test('contained: layers fill one element, sized to it (the Obsidian plugin, one per note)', async () => {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto(url + 'tests/blank.html');
    const packs = [TP.check(shelf('rain')).pack, TP.check(shelf('judgment-day')).pack];
    const r = await page.evaluate(([rain, jd]) => {
      const note = document.createElement('div');
      note.style.cssText = 'position:relative;width:400px;height:300px';
      note.innerHTML = '<p>writing</p>';
      document.body.appendChild(note);
      const stage = TreePacks.createStage({ root: note, layers: note, parts: ['layers'], contained: true, themeAttr: false });
      stage.apply(rain.themes.find(t => t.id === 'wet-neon'), {});
      const canvas = note.querySelector('canvas');
      const out = {
        canvas: [canvas.width, canvas.height, getComputedStyle(canvas).position],
        firstIsLayer: note.firstElementChild.classList.contains('tp-behind'),
        writingStill: !!note.querySelector('p'),
        varsOnNote: note.style.getPropertyValue('--bg'),
        style: document.querySelectorAll('style').length,
      };
      stage.apply(jd.themes.find(t => t.id === 'hud'), {});
      out.front = note.lastElementChild.classList.contains('tp-front');
      out.noCanvas = !note.querySelector('canvas');
      stage.destroy();
      out.clean = note.innerHTML === '<p>writing</p>';
      // The window's own stage: colors with a prefix, and css, no layers
      const win = TreePacks.createStage({ parts: ['colors', 'css'], varPrefix: '--tree-', themeAttr: false });
      win.apply(jd.themes.find(t => t.id === 'liquid-metal'), {});
      out.prefixed = document.body.style.getPropertyValue('--tree-bg');
      out.unprefixed = document.body.style.getPropertyValue('--bg');
      out.sheen = /background-clip: text/.test([...document.querySelectorAll('style')].map(x => x.textContent).join(''));
      out.layers = document.querySelectorAll('.tp-layer').length;
      out.dataset = document.body.dataset.theme;
      win.destroy();
      return out;
    }, packs);
    await page.close();
    assert.deepStrictEqual(r.canvas.slice(2), ['absolute']);
    assert.ok(r.canvas[0] >= 400 && r.canvas[1] >= 300, 'canvas sized to the note: ' + r.canvas);
    assert.ok(r.firstIsLayer && r.writingStill && r.front && r.noCanvas && r.clean);
    assert.strictEqual(r.varsOnNote, '');
    assert.strictEqual(r.style, 0, 'a layers-only stage writes no CSS');
    assert.deepStrictEqual([r.prefixed, r.unprefixed, r.sheen, r.layers, r.dataset], ['#15181b', '', true, 0, undefined]);
  });

  await test('reduced motion: rain holds still, light does not flicker', async () => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(url + 'tests/blank.html');
    const neon = TP.check(shelf('rain')).pack.themes.find(t => t.id === 'wet-neon');
    const r = await page.evaluate(t => {
      const stage = TreePacks.createStage(); stage.apply(t, {});
      return { running: stage.rains[0].running, drops: stage.rains[0].drops.length, animations: document.getAnimations().length };
    }, neon);
    await ctx.close();
    assert.ok(!r.running && r.drops > 0, 'rain should be drawn, still');
    assert.strictEqual(r.animations, 0);
  });

  await treeTests(browser, url);
  srv.close();
  await browser.close();
}

// ── Tree 2.0 with packs ──────────────────────────────────────────────────
async function treeTests(browser, url) {
  // A stand-in shelf: the tree-packs checkout, served where Tree looks for it.
  async function open(settings, extra) {
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
    await ctx.route('https://uncle-jasper.github.io/tree-packs/**', route => {
      const f = path.join(PACKS_DIR, new URL(route.request().url()).pathname.replace('/tree-packs/', ''));
      if (fs.existsSync(f)) route.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(f, 'utf8') });
      else route.fulfill({ status: 404, body: '' });
    });
    await ctx.addInitScript(([s, x]) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      if (s) localStorage.setItem('tree-editor-settings', s);
      for (const k in x || {}) localStorage.setItem(k, x[k]);
    }, [settings ? JSON.stringify(settings) : null, extra || {}]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof packs !== 'undefined' && packs.restored);
    return { ctx, page, errors };
  }
  const state = page => page.evaluate(() => {
    const pack = findPack(packs.current.pack), theme = TreePacks.findTheme(pack, packs.current.theme);
    const on = {}; for (const sw of TreePacks.switchesOf(theme)) { const c = themeChoices(pack, theme)[sw.label]; on[sw.label] = typeof c === 'boolean' ? c : sw.on; }
    return { pack: pack.id, theme: theme.id, switches: on, installed: Object.keys(packs.installed),
      saved: JSON.parse(localStorage.getItem('tree-editor-settings') || 'null') };
  });

  await test('Tree: every old saved setting lands where the plan says, and stays readable by Ginkgo', async () => {
    const dir = path.join(ROOT, 'baseline', 'fixtures', 'tree');
    for (const f of fs.readdirSync(dir)) {
      const fx = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const { ctx, page, errors } = await open(fx.settings);
      const st = await state(page);
      await page.evaluate(() => saveSettings());
      const after = await state(page);
      await ctx.close();
      assert.deepStrictEqual(errors, [], f + ': page errors');
      assert.deepStrictEqual({ pack: st.pack, theme: st.theme }, { pack: fx.after.pack, theme: fx.after.theme }, f);
      for (const [k, v] of Object.entries(fx.after.switches || {})) assert.strictEqual(st.switches[k], v, `${f}: ${k}`);
      if (fx.after.pack === 'rain') assert.ok(st.installed.includes('rain'), f + ': Rain pack should be installed');
      if (fx.settings) for (const k of ['theme', 'downpour', 'rainStill', 'crtEnabled'])
        assert.strictEqual(!!after.saved[k] && after.saved[k], !!fx.settings[k] && fx.settings[k], `${f}: saved ${k} changed`);
    }
  });

  await test('Tree: install from the shelf, use it, survive a reload, uninstall back to dark', async () => {
    const { ctx, page, errors } = await open(null);
    await page.click('#theme-label');
    await page.click('#btn-packs');
    await page.waitForSelector('#packs-shelf .pk-btn.go');
    const offered = await page.$$eval('#packs-shelf .pk-name', els => els.map(e => e.firstChild.textContent));
    assert.deepStrictEqual(offered.sort(), ['judgment day', 'rain']);
    await page.click('#packs-shelf .pk:has-text("judgment day") .pk-btn.go');
    await page.waitForFunction(() => packs.installed['judgment-day']);
    assert.match(await page.textContent('#packs-note'), /judgment day installed/);
    await page.click('#btn-packs-close');
    await page.evaluate(() => selectPackTheme('judgment-day', 'liquid-metal'));
    await page.evaluate(() => setSwitch('chrome sheen', false));
    await page.evaluate(() => selectPackTheme('judgment-day', 'hud'));
    assert.strictEqual(await page.evaluate(() => document.body.dataset.theme), 'pack');
    assert.strictEqual(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--text').trim()), '#ff5a48');
    await page.reload(); await page.waitForFunction(() => packs.restored);
    let st = await state(page);
    assert.deepStrictEqual([st.pack, st.theme], ['judgment-day', 'hud']);
    assert.strictEqual(st.saved.theme, 'dark', 'Ginkgo should see a dark theme it knows');
    // Returning to a pack opens the theme last used in it.
    await page.evaluate(() => selectPackTheme('classic', 'sage'));
    await page.evaluate(() => stepPack(1)); await page.evaluate(() => stepPack(1));
    st = await state(page);
    assert.deepStrictEqual([st.pack, st.theme], ['judgment-day', 'hud']);
    await page.click('#theme-label'); await page.click('#btn-packs');
    await page.click('#packs-installed .pk:has-text("judgment day") .pk-btn:has-text("uninstall")');
    assert.match(await page.textContent('#packs-note'), /switched to dark/);
    st = await state(page);
    assert.deepStrictEqual([st.pack, st.theme, st.installed.length], ['classic', 'dark', 0]);
    assert.deepStrictEqual(await page.evaluate(() => [Object.keys(packs.switches).filter(k => k.startsWith('judgment-day/')), packs.last['judgment-day']]), [[], undefined], 'nothing of the pack left behind');
    await ctx.close();
    assert.deepStrictEqual(errors, []);
  });

  await test('Tree: import a pack file; a broken one is refused in one line', async () => {
    const { ctx, page, errors } = await open(null);
    await page.click('#theme-label'); await page.click('#btn-packs');
    await page.setInputFiles('#pack-file', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"treePack":1,"id":"x"}') });
    await page.waitForFunction(() => document.getElementById('packs-note').textContent);
    assert.match(await page.textContent('#packs-note'), /^not installed: /);
    await page.setInputFiles('#pack-file', path.join(PACKS_DIR, 'packs', 'rain.tree-pack.json'));
    await page.waitForFunction(() => packs.installed.rain);
    assert.match(await page.textContent('#packs-note'), /rain installed/);
    await ctx.close();
    assert.deepStrictEqual(errors, []);
  });

  await test('Tree: an older installed pack is offered as an update', async () => {
    const old = JSON.parse(fs.readFileSync(path.join(PACKS_DIR, 'packs', 'rain.tree-pack.json'), 'utf8'));
    old.version = '0.9.0'; old.themes[0].colors.bg = '#000000';
    const { ctx, page } = await open(null, { 'tree-packs': JSON.stringify({ installed: { rain: old }, seen: {} }) });
    await page.click('#theme-label');
    await page.waitForFunction(() => packs.shelfState === 'ok');
    assert.strictEqual(await page.textContent('#packs-new'), '2 new');
    await page.click('#btn-packs');
    await page.click('#packs-installed .pk-btn:has-text("update")');
    await page.waitForFunction(() => packs.installed.rain.version === '1.0.0');
    assert.strictEqual(await page.evaluate(() => packs.installed.rain.themes[0].colors.bg), '#ccd4d6');
    await page.click('#btn-packs-close');
    assert.strictEqual(await page.textContent('#packs-new'), '', 'nothing new once seen and updated');
    await ctx.close();
  });

  await test('Tree: offline, the shelf says so and installed packs still work', async () => {
    const ctx = await browser.newContext({ serviceWorkers: 'block', offline: false });
    await ctx.route('https://uncle-jasper.github.io/**', r => r.abort());
    const rain = fs.readFileSync(path.join(PACKS_DIR, 'packs', 'rain.tree-pack.json'), 'utf8');
    await ctx.addInitScript(r => { if (!localStorage.getItem('tree-packs')) localStorage.setItem('tree-packs', JSON.stringify({ installed: { rain: JSON.parse(r) } })); }, rain);
    const page = await ctx.newPage();
    await page.goto(url); await page.waitForFunction(() => packs.restored);
    await page.evaluate(() => selectPackTheme('rain', 'wet-neon'));
    await page.click('#theme-label'); await page.click('#btn-packs');
    await page.waitForFunction(() => packs.shelfState === 'offline');
    assert.match(await page.textContent('#packs-shelf'), /shelf not reachable/);
    assert.strictEqual(await page.evaluate(() => document.body.dataset.theme), 'pack');
    await ctx.close();
  });

  await test('Tree: amber terminal and doogie journal start with crt on, and can turn it off', async () => {
    const { ctx, page, errors } = await open(null);
    const look = () => page.evaluate(() => ({ crt: document.body.classList.contains('crt-on'),
      amber: document.body.classList.contains('amber-crt'), doogie: document.body.classList.contains('doogie-journal'), shape: cursorShape() }));
    await page.evaluate(() => selectPackTheme('retro', 'amber-crt'));
    assert.deepStrictEqual(await look(), { crt: true, amber: true, doogie: false, shape: 'block' });
    await page.evaluate(() => setSwitch('crt', false));
    assert.deepStrictEqual(await look(), { crt: false, amber: true, doogie: false, shape: 'line' });
    await page.evaluate(() => selectPackTheme('retro', 'doogie-journal'));
    assert.deepStrictEqual(await look(), { crt: true, amber: false, doogie: true, shape: 'underline' });
    await page.evaluate(() => setSwitch('crt', false));
    assert.deepStrictEqual(await look(), { crt: false, amber: false, doogie: true, shape: 'line' });
    // Each theme keeps its own choice.
    await page.evaluate(() => selectPackTheme('retro', 'amber-crt'));
    assert.strictEqual((await look()).crt, false);
    await page.evaluate(() => selectPackTheme('retro', 'terminal'));
    assert.strictEqual((await look()).crt, false);
    await ctx.close();
    assert.deepStrictEqual(errors, []);
  });

  await test("Tree: Just Write keeps the theme fixed", async () => {
    const { ctx, page } = await open(null);
    await page.evaluate(() => { justWriteActive = true; selectPackTheme('retro', 'gameboy'); stepPack(1); openPacks(); });
    const st = await state(page);
    const packsShown = await page.evaluate(() => packsOpen());
    await ctx.close();
    assert.deepStrictEqual([st.pack, st.theme, packsShown], ['classic', 'parchment', false]);
  });
}
