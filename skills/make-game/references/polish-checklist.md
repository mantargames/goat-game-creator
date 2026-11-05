# Polish checklist

Work through this only after the game is fun as a sim. One item per round, screenshot after each, keep what looks better, revert what does not.

## Contents
- Lighting and sky
- Post-processing
- Water and ground
- Juice
- UI
- Audio
- Feel and onboarding
- Performance

## Lighting and sky

- `renderer.toneMapping = THREE.ACESFilmicToneMapping`, output in sRGB, exposure around 1.
- A warm key light with soft shadows (`PCFSoftShadowMap`, a tight shadow camera around the play area, 2048 or 4096 map), plus a hemisphere light for sky/ground fill.
- Image-based lighting: a `PMREMGenerator` environment (RoomEnvironment or a sky) makes materials read correctly.
- Day/night: lerp sky colour, sun intensity and colour, fog colour. Snap instantly when pre-running for screenshots.

## Post-processing

`EffectComposer` with, in order: render pass, ambient occlusion (`GTAOPass`), soft bloom (`UnrealBloomPass`, low strength, high threshold), a colour grade shader (saturation, contrast, lift, vignette), `OutputPass`. Hide sprites and particles during the AO pass or they cast dark halos. Boost bloom at night so lights glow.

## Water and ground

- Sea: three.js `Water` from the addons, or a simple animated material; a lighter lagoon ring around the land reads instantly as shallow water.
- Shoreline foam that follows the coast (a blurred land mask is enough).
- Ground cover: scatter small grass tufts, pebbles and bushes deterministically per tile so open land never looks flat.

## Juice

- Pop-in with overshoot when something is built, squash and stretch on hits.
- Hit flash (tint red for 100 ms), floating damage or income numbers.
- Particles: dust on build, puffs on death, sparks on hits, smoke from chimneys.
- Small camera shake on big impacts, never on every hit.
- Life: villagers strolling by day, flags waving, clouds drifting.

## UI

- Chunky, readable type (an outlined display font), high contrast, big hit targets.
- Every number shown is backed by a promise test.
- Tooltips on everything, a threat banner before each wave, a clear end screen.
- Check UI at 1280x720 and 1920x1080 in screenshots.

## Audio

Procedural first (WebAudio blips), then real samples: Kenney Audio packs are CC0. Separate music for calm and tense phases, short UI clicks, impact sounds with slight random pitch.

## Feel and onboarding

Title screen, continue/save (localStorage), undo for planning actions, a first-run hint line per phase, speed toggle (x2), pause.

## Performance

Share geometries and materials, clone models instead of reloading, use `InstancedMesh` for many identical props, cap pixel ratio at 2, check frame time with a large late-game state (`?sim=12`).
