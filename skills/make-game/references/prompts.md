# Prompts

A prompt sequence a user can paste into Claude Code, round by round. It follows the three-version journey: ugly v1, playable v2, polished v3. Swap the game idea for your own.

## Contents
- Setup
- v1: ugly but playable
- v2: playable and balanced
- v3: polished
- Steering prompts for any round
- Prompts that go wrong

## Setup

> /make-game I want a cozy island tower defence: build by day, skeletons attack at night. My assets are in ~/game-assets (KayKit). Run doctor first.

> Open the explorer on ~/game-assets and pick a cohesive set: hex tiles, 4 buildings, 2 enemy types, 1 hero. Show me the picks with sizes.

## v1: ugly but playable

> Scaffold the game from the starter on port 5151. Run the tests and show me the first screenshot before you change anything.

> Write DESIGN.md: one page, core loop, verbs, win/lose, first numbers. Wait for my yes.

> Build v1: the full loop in sim.js with every number in rules.js, a bot that plays it, and the simplest rendering. Primitives are fine. Prove the bot finishes a game in node and show ?autoplay on screen.

## v2: playable and balanced

> Run the bot on 40 seeds and give me the win rate and the night where it loses. I want normal to be about 50%.

> Enemies are too strong on night 3. Fix it in rules.js only, rerun the bot, show me before/after.

> Add upgrades: towers and the hall go to level 3. Add promise tests for every new tooltip.

> Swap the primitives for the real models. Run ?gallery first and screenshot it, then the game. Check scale and that nothing floats.

## v3: polished

> Polish round 1: lighting and sky. Soft shadows, ACES, a warm sun, day/night colour blend. Before/after screenshots.

> Polish round 2: make the water nicer. A lighter lagoon around the island and foam on the shore.

> Polish round 3: juice. Buildings pop in, enemies flash when hit, puffs on death, a little camera shake on the hall.

> Polish round 4: UI. Chunky readable buttons, a threat banner before each night, a proper end screen. Check it at 1280x720.

> Polish round 5: audio from Kenney Audio, calm music by day, tense by night.

> Final check: npm test, bot report, and a screenshot set (title, day, night, end). List anything still ugly.

## Steering prompts for any round

- "Show me a screenshot of that, and tell me what you see."
- "That is a feeling, not a number: run the bot."
- "Keep it in rules.js."
- "Give me two options with screenshots, I will pick."
- "Undo that round, it looked better before."
- "Take a ?gallery screenshot, I think the scale is off."

## Prompts that go wrong

- "Make me a complete game" in one prompt: you get a big untested file. Go round by round.
- "Make it look AAA": vague. Name the thing ("the water", "the night lighting").
- Mixing three asset packs at once: style clashes. Pick one main pack.
- Balancing by feel after one game: always ask for the bot report.
