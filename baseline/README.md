# Theme baseline

The safety net for theme packs (phase 1 of [PACKS-PLAN.md](../PACKS-PLAN.md)). It records how every theme in Tree and Ginkgo looks *before* packs arrive, so later phases can prove nothing changed by accident.

Nothing here ships with the apps. Tree never loads these files.

## What's here

| Path | What it is |
|---|---|
| `fixtures/tree/`, `fixtures/ginkgo/` | One file per theme setting a person can have today: exactly what that app saved to `tree-editor-settings`, made by running the app's own settings code (`setTheme`, the switches, `saveSettings`), plus where PACKS-PLAN.md says it must land after the update (`after`) |
| `shots/` | 120 screenshots: 20 settings × 2 apps × (desktop write, desktop preview, phone write). `shots/index.html` shows them all on one page |
| `sample.md` | The text shown in every shot |
| `run.js` | Makes the fixtures, takes the shots, compares two sets |

The 20 settings: nothing saved yet; parchment, paper, ash, sage, dark, moss, slate; custom 1–3 (each with its own colors, name, cursor and readable choice); game boy; moonwalker; terminal with crt off and on; amber crt and doogie journal (entered with their real key codes, since they're never saved); rain with downpour off; downpour with falling rain on and off.

Made from Tree `b0daef2` and Ginkgo `f91c2c9` (each fixture's `madeFrom`).

## Using it

Needs Node and Playwright with Chromium. Ginkgo is expected next to this repo (`../ginkgo`) unless `--ginkgo` says otherwise.

After a change, capture again into a new folder and compare with the baseline:

```bash
node baseline/run.js capture --out baseline/shots-after
```

```bash
node baseline/run.js compare baseline/shots baseline/shots-after
```

The comparison lists every shot that changed and writes `baseline/compare-report/index.html` with before, after and a diff image (changed pixels in red) for each. It exits with 1 if anything changed. Any change Dan hasn't approved is a bug (plan rule 2).

`--only parchment,rain` captures just those settings. `--apps tree` skips Ginkgo.

## Why the shots repeat exactly

Each shot runs in a fresh browser with a paused clock (12 Nov 2026, 09:30, Taipei), seeded randomness, and the falling rain refilled from that seed. Animations are frozen in every frame, Ginkgo's editor included. Three separate runs gave 120 identical shots.

Chromium sometimes moves a few pixels by one level out of 255 between runs, so the comparison ignores differences of 2 levels or less. `--exact` counts every one.

## Remaking the fixtures

Only if today's apps change before packs land:

```bash
node baseline/run.js fixtures
```

Then capture into `baseline/shots` again and commit both.
