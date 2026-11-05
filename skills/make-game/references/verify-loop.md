# Verify loop

Run this after every change. A change is not done until each step passed and you looked at the screenshot.

## Contents
- The loop
- Debug hooks to build on day one
- Reading the page from the command line
- What to look for in a screenshot
- Balance testing with a bot
- Headless gotchas

## The loop

```bash
npm test                                              # sim rules, promises, balance report
node server.mjs &                                     # if not already running
goat-game shot "http://localhost:5151/?seed=7&sim=3" shots/r12-day.png
goat-game shot "http://localhost:5151/?seed=7&sim=3&night=6" shots/r12-night.png
goat-game shot "http://localhost:5151/?seed=7&sim=3" --log      # the #debuglog line
```

Then open each PNG (read the image) and write one line about what you saw. Number your shots per round (`r12-...`) so before/after comparisons are easy. If a server was started for the check, stop it afterwards.

## Debug hooks to build on day one

- `?seed=N`: the same seed gives the same map and the same run.
- `?sim=N`: play N rounds synchronously with the bot, then render that state. Print one summary line into `<pre id="debuglog" hidden>`.
- `?autoplay&speed=4`: the bot plays on screen, for watching and for video.
- `?gallery`: every model from the manifest in a grid with labels and a found/missing/failed line. Run it whenever you add assets.
- `?r.START.gold=500`: override any rules value from the URL.
- `?noassets`: force the primitive fallback, to prove the game runs without the pack.
- `window.GAME`: expose `state`, the sim and the scene in the console.

## Reading the page from the command line

`goat-game shot <url> --log` (or `chrome --headless --dump-dom <url> | grep debuglog`) prints the debug line. Use it to assert logic in the real browser build, for example that `?sim=6` reaches night 6 with the hall alive.

Crop a HUD region for detail with Python PIL:
`python3 -c "from PIL import Image; Image.open('s.png').crop((0,720,1440,900)).save('hud.png')"`

## What to look for in a screenshot

- models floating above or sunk into tiles (wrong y offset or pivot)
- wrong scale between packs, giant props, tiny characters
- white untextured meshes (missing gltf texture)
- T-posed or exploded characters (no rig, wrong clone, missing clips)
- z-fighting or flicker on overlapping planes
- UI text overflowing its box, HUD covering the action, unreadable contrast
- everything too dark or washed out (tone mapping, colour space)
- the camera framing: is the interesting part on screen?

## Balance testing with a bot

A greedy bot that plays through the same API as the player is the only honest balance test. Run it over 20 to 60 seeds per difficulty and report: win rate, the round where losses happen (histogram), and resources over time. Target ranges, for example: easy 85-95%, normal 40-60% for a weak bot. When the user says "too hard", change one number in `rules.js`, rerun, and report the before/after rate.

## Headless gotchas

- With `--virtual-time-budget` timers run fast but the live rAF clock barely moves, so anything time-based reads near zero. Put what you need to see into the deterministic `step(dt)` path and pre-run it (`?sim=N`, `?night=6`).
- WebGL in headless Chrome needs a software GL: the shot script passes `--use-angle=swiftshader --enable-unsafe-swiftshader`.
- Fonts and CDN scripts need internet on first load.
- Use `preserveDrawingBuffer: true` on the renderer if a capture comes out black.
