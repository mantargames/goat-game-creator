# Hex Starter

A small, real hex island game to grow your own game from. Build by day, defend by night, survive 7 nights. Made with [goat-game-creator](https://github.com/goatstarter/goat-game-creator).

```bash
node server.mjs          # http://localhost:<port from game.config.json>
npm test                 # sim rules, promise tests, bot balance report
node scripts/shot.mjs "http://localhost:5151/?seed=7&sim=3" shots/day4.png
```

`game.config.json` sets the name, port and asset folder (`--port`, `--assets`, `PORT` and `ASSETS_DIR` override it). The game finds KayKit Medieval Hexagon anywhere inside the asset folder and uses coloured shapes for anything it cannot find.

| File | What |
|---|---|
| `public/js/rules.js` | every number: costs, yields, HP, waves. Balance here |
| `public/js/sim.js` | pure game logic, no DOM, runs in node. `step(dt)` is the fixed night step |
| `public/js/bot.js` | greedy bot through the sim API: balance tests, `?sim`, `?autoplay` |
| `public/js/assets.js` | model manifest (logical name to file name), scale and tint tables, primitive fallback |
| `public/js/main.js` | three.js scene, input, HUD, effects, debug hooks |
| `public/js/hex.js` | pointy-top axial hex math, seeded RNG |
| `test/sim.test.mjs` | rules + balance report |
| `test/promises.test.mjs` | every building text checked against the rules |
| `scripts/shot.mjs` | headless screenshot, `--log` prints `#debuglog` |

Debug URLs: `?seed=7`, `?sim=3`, `?night=6`, `?autoplay&speed=4`, `?gallery`, `?noassets`, `?r.START.gold=200`. `window.GAME` exposes the state, sim and scene.

Controls: left click build, right drag pan, middle drag rotate, wheel zoom, 1-3 pick a building, Space start the night.
