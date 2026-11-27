# Theme packs: the plan

The plan for bringing theme packs to Tree, Ginkgo and the Tree Obsidian plugin. It records what's decided, what's still open, and the order of work, so each session picks up where the last one stopped.

The packs themselves, their format and the shelf live in [`uncle-jasper/tree-packs`](https://github.com/uncle-jasper/tree-packs). This file is about the apps.

**Status:** Phases 1 and 2 done. Phase 3 (Tree 2.0) and phase 4 (Ginkgo 2.0) built on branch `claude/peaceful-ride-t07r40` in each repo, awaiting Dan's check. Tree: 55 of 60 baseline shots identical, the rest differ only where typing the old codes changed the tab name or line count. Ginkgo: the same, plus custom themes, whose frame now takes the editor's colors (the planned change, approved by Dan). Judgment Day 1.0.1 (steel mill's glow at 12%) and the shelf's update offer checked by Dan in the Tree preview. Before release, the shelf must be live (see Dan's one-time setup).

## What a pack is

A set of themes grouped by mood, like Rain (overcast, rain, downpour, wet street, wet neon). In each app's quick panel, a **pack** row picks the pack and the **theme** row steps through that pack's themes only, so the list stays short however many packs exist. A theme's switches (falling rain, crt) appear under it.

Packs are installed from a shelf, the `tree-packs` repo published on GitHub, without updating the apps. A pack file holds only data (colors, names, effect settings); the effects are built into each app.

## Decisions

| Decision | Choice |
|---|---|
| Built into every app | **Classic**: parchment, paper, ash, sage, dark, moss, slate, custom 1–3 |
| Also built in, for now | **Retro**: game boy, moonwalker, terminal (crt switch), amber crt, doogie journal. Moves to the shelf once the effects can match it exactly. |
| Installing packs | From the shelf on GitHub (`uncle-jasper/tree-packs`), with pack-file import and export as backup |
| Launch packs on the shelf | **Rain** (5 themes) and **Judgment Day** (4 themes) |
| Rain | Moves from built in to the shelf, as a 5-theme pack |
| Secret codes | Removed: Konami, ABACABB and umbre11a. Amber crt and doogie journal become ordinary Retro themes. |
| Theme row | Steps within the current pack, never into the next one |
| Pack order | Classic, Retro, then installed packs alphabetically. Reordering (move up / move down) waits until there are enough packs to need it |
| Choosing a pack | Opens on its everyday theme the first time; after that, on the theme last used in it |
| Falling rain | A switch any Rain theme can turn on; on by default for downpour and wet neon |
| Custom themes | Stay exactly as they are: three slots in Classic, same `.tree-theme.json` import and export, old files keep working |
| Each app's packs | Tree and Ginkgo share installed packs and the theme in use: they're on the same site, so the browser gives them one storage, as it already did for the theme. Home-screen apps on iPhone each have their own storage, so there each keeps its own. The plugin keeps its packs in the vault. Same files, same IDs, so a pack looks the same everywhere. |
| Pack sizes | Not a concern: a pack is a few KB. Packs are about keeping the list short. |
| Versions | Each app becomes 2.0 when its phase ships: Tree in phase 3, Ginkgo in 4, the plugin in 5 |
| Also in each app's 2.0 | A 12px font size; the plugin's cursor shape (3px rounded bar) in Tree and Ginkgo |
| Rain for people who used it | Tree carries a copy of the Rain pack 1.0.0 and installs it on first launch for anyone who had rain or downpour, so it looks the same even offline; the shelf offers updates after that |
| Ginkgo before phase 4 | Tree and Ginkgo share saved settings (same site). Tree keeps writing the old theme setting alongside the pack, so today's Ginkgo still shows a theme it knows |
| Just Write | Locks the theme as before: the pack row, theme list and Packs screen do nothing while it runs. More to look at later |

## Rules for not breaking anything

1. **Branches only.** Nothing reaches the live apps until it passes every check below.
2. **Screenshots before and after.** Before any change, capture every existing theme in Tree and Ginkgo. After, capture again and compare. Any theme that looks different is a bug unless Dan approved the change.
3. **Old settings always work.** Every saved setting from today's versions maps to the same look after the update (table below), tested with real saved settings.
4. **Remember the colors in use.** The apps save the colors of the current theme, so it keeps showing even if its pack isn't installed (offline, or the shelf can't be reached).
5. **Special themes untouched.** Terminal, the CRT looks, Moonwalker and Game Boy keep their current code until the effects match them exactly.
6. **One app at a time:** Tree, then Ginkgo, then the plugin, each released and used before the next starts.
7. **The plugin waits for Dan.** Each plugin release is checked by Dan in real Obsidian before it goes out; Claude sessions can't run Obsidian.
8. **One engine.** The code that reads packs and runs effects is written once (`packs.js`), loaded by Tree and Ginkgo the way Tree loads `spell.js`, and copied into the plugin's build. Never three hand-kept copies.

## Moving today's settings over

| Saved today | After the update |
|---|---|
| any Classic theme or custom slot | same theme, in Classic |
| game boy, moonwalker | same theme, in Retro |
| terminal, crt off / on | terminal in Retro, crt switch off / on |
| amber crt or doogie journal (session only today) | terminal in Retro, crt on |
| rain, downpour off | Rain pack › rain, falling rain off |
| rain, downpour on, falling rain on / off | Rain pack › downpour, falling rain on / off |

For the two Rain rows, the app installs the Rain pack from the shelf on first launch. Until it can (offline), the saved colors keep the theme looking right; falling rain waits until the pack arrives.

## Phases

| Phase | Work | Dan approves |
|---|---|---|
| **0. Design** | Pack format (`tree-packs/FORMAT.md`), launch packs as real files, shelf index, checker, pack-studio guide (`tree-packs/CLAUDE.md`), this plan, mock-ups of the pack row and Packs screen | Format, lineup, mock-ups |
| 1. Safety net | Baseline screenshots of every theme in Tree and Ginkgo; saved-settings fixtures from today's versions | — |
| 2. Engine | `packs.js`: read and check packs, apply colors, effects (particles, light, overlay, glow, sheen), switches, saved colors. Classic and Retro defined as built-in packs. A pack previewer page in `tree-packs` uses the same engine. | — |
| 3. Tree | Engine in; pack row; Packs screen (shelf, install, uninstall, update, import, export); settings moved over; Rain leaves the built-in themes; codes removed | Screenshot comparison, then release |
| 4. Ginkgo | Same engine; Ginkgo's frame takes all six colors from the editor | Release |
| 5. Plugin | Same engine; Aa panel pack row; packs kept in the vault so they sync to iPad | Dan's check in Obsidian, then release |
| 6. Later, optional | Retro moves to the shelf; "save my custom themes as a pack"; move up / move down for packs on the Packs screen, once there are enough packs to need it | — |

The shelf (`tree-packs` with GitHub Pages) has to be live before phase 3 ships.

## Open questions

None.

Settled in phase 0: mock-ups approved; returning to a pack opens the theme last used in it; Judgment Day's everyday theme is cyberdyne; HUD keeps its original red (`#ff5a48`, 6.5:1). Dan compared it with a brighter `#ff6a56` and chose the original.

## Dan's one-time setup

- Turn on GitHub Pages for `tree-packs` (Settings → Pages → Deploy from branch → `main`, `/ (root)`), so the shelf is at `https://uncle-jasper.github.io/tree-packs/`.
