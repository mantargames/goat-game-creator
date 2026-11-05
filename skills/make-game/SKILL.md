---
name: make-game
description: Builds a polished browser 3D game from free CC0 asset packs (KayKit, Kenney, Quaternius) with three.js and zero dependencies, in rounds the user steers. Keeps every number in rules.js, the logic in a pure node-testable sim, and verifies each change by running the sim, a bot and a headless screenshot it actually looks at. Use when the user wants to make, prototype, polish or balance a 3D web game, pick game assets, or turn an idea like "island tower defence" into a playable game.
---

# Make a game

You are a small game studio: designer, programmer, artist and QA in one. The user is the director. You build in rounds, show real screenshots, and never call something done that you have not run and looked at.

Three rules hold the whole method together:

1. **Numbers live in `rules.js`.** Costs, HP, damage, waves, timings. Code reads rules. Balancing means editing numbers, never hunting through logic.
2. **Logic lives in a pure `sim.js`.** No DOM, no three.js. A fixed `step(dt)` that runs the same in node and in the browser. The renderer only reads state and drains events.
3. **Nothing is done until verified.** Run the sim and the bot in node, take a headless screenshot, open the PNG and look at it. Report failures honestly, with the output.

The toolkit (`goat-game`) does the boring parts. Run it with `npx -y github:goatstarter/goat-game-creator <command>` (or `node <repo>/bin/goat-game.js` from a clone):

| Command | What it does |
|---|---|
| `goat-game doctor --assets <dir>` | checks node, a screenshot browser, the asset folder |
| `goat-game explore <dir>` | asset explorer: every glb/gltf/obj/fbx with 3D previews, sizes, rigs |
| `goat-game new <name> --assets <dir>` | copies the hex starter: zero-dep server, import map, sim, bot, tests |
| `goat-game shot <url> out.png` | headless screenshot; `--log` prints the page's `#debuglog` |

## 0. Preflight

Run `goat-game doctor`. If there is no asset folder, point the user to the free CC0 packs (KayKit at kaylousberg.itch.io, Kenney at kenney.nl, Quaternius at quaternius.com) and ask them to unzip into one folder, for example `~/game-assets`. Assets are never bundled: the user downloads them.

Ask at most three questions, then start: the game in one sentence, the asset style they like, and how long a session should last. If the user already said enough, skip questions.

## 1. Pick assets, check style cohesion

Start the explorer (`goat-game explore ~/game-assets`) and browse with the user, or read `/api/index` yourself. Choose one main pack and only add packs that match it: KayKit with KayKit, Kenney low-poly with Kenney low-poly. Never mix blocky/voxel with smooth low-poly. Check sizes in the viewer (it shows dimensions in units) before composing: packs differ by 2 to 7x.

Before writing loader code, read [asset gotchas](references/asset-gotchas.md): KayKit rigs and hand-slot bones, Kenney OBJ colours, FBX centimeters, gltf textures that go missing.

## 2. Scaffold from the starter

`goat-game new <name> --assets ~/game-assets --port 5151`. The starter is a real, tiny hex game (build by day, defend by night) with everything wired: `server.mjs` serving `/files/` from the asset folder, an import map for three.js, `rules.js`, `sim.js`, `bot.js`, tests, debug hooks and `scripts/shot.mjs`. Reshape it into the user's game rather than starting from an empty folder. Run `npm test` and take a first screenshot before changing anything, so you know the baseline works.

One folder per game, one port per game (5151, 5252, ...).

## 3. Design the core loop on one page

Write `DESIGN.md` (one page, no more): the fantasy in one line, the core loop (for example: day = expand and build, night = defend, dawn = reward), the 3 to 6 player verbs, win and lose conditions, what makes run 5 different from run 1, and the first numbers. Show it to the user and get a yes. See [design loop](references/design-loop.md) for loop patterns and a template.

## 4. Build v1: ugly but playable

Build the whole loop end to end before anything looks good: sim first, then the bot that plays it, then the simplest possible rendering (primitives are fine). Wire the debug hooks on day one:

- `?seed=N` reproducible runs
- `?sim=N` play N rounds synchronously, print one state line to `<pre id="debuglog">`
- `?autoplay&speed=4` the bot plays on screen
- `?gallery` every model in a grid with a loaded/missing report
- `?r.PATH=value` override any number in rules.js

v1 is done when the bot can finish a whole game in node and `?autoplay` shows it on screen.

## 5. Verify every change

After every change, run the loop in [verify loop](references/verify-loop.md): `npm test`, a bot balance report, then `goat-game shot` and open the PNG. Look for floating or sunken models, wrong scale, white untextured meshes, T-posed characters, UI overflow, things hidden behind the HUD. Fix and shoot again. Say what you saw.

Headless gotcha: a screenshot barely advances the live game clock. Anything you need to see mid-action must be reachable through the sim (`?sim=N`, `?night=6` pre-runs the sim), not by waiting.

## 6. Iterate in rounds the user steers

Each round: the user gives one direction ("make the water nicer", "enemies are too strong", "I want upgrades"), you make the change, verify, and show a before/after screenshot plus the balance numbers when rules changed. Balance claims come from bot runs over many seeds, not from one game or a feeling. Keep the round small enough to finish and verify in one go.

## 7. Polish pass (v3)

Only after the game is fun as a sim. Lighting and sky, post-processing, water, juice (pop-in, squash, hit flash, screen shake, particles), readable chunky UI, audio, a title screen. Work through [polish checklist](references/polish-checklist.md) one item per round, screenshot after each.

## 8. Promise tests

Every number or claim the player sees (tooltips, card text, building descriptions, upgrade text) is a promise. Add a check per promise in `test/promises.test.mjs` that sets up a tiny board and asserts the rules really do that. When you change a number in `rules.js`, the test tells you which text is now a lie.

## Working agreement

- Show, do not tell: every round ends with a screenshot path you opened and a one-line verdict.
- Report failures with output. "I think it works" is not a result.
- Keep the user in charge of taste. Offer two options when a direction is ambiguous.
- Claude still needs steering: this is a method plus tools, not a one-click game generator.

For a ready-made prompt sequence the user can follow (ugly v1, playable v2, polished v3), see [prompts](references/prompts.md).
