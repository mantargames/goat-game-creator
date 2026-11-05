# Design loop

How to turn "I want a game about X" into a loop that is fun as numbers before it is pretty.

## Contents
- The one-page design
- Core loop patterns that work in the browser
- First numbers
- Making runs different
- Template

## The one-page design

One page, written to `DESIGN.md`, approved by the user before code:

1. **Fantasy** in one line: "Grow a tiny island kingdom and hold it against the dead."
2. **Core loop**: the 2 or 3 phases that repeat.
3. **Verbs**: 3 to 6 things the player does (place, build, upgrade, cast, rally).
4. **Win and lose**: how a run ends.
5. **Variety**: what makes run 5 different from run 1.
6. **Session length**: 5, 15 or 45 minutes.
7. **First numbers**: a small table that goes straight into `rules.js`.

## Core loop patterns that work in the browser

- **Build / defend** (day/night): calm planning, then a tense wave you mostly watch. Very easy to verify with a bot. Hex Kingdom and the starter use this.
- **Expand / exploit**: place a tile each turn (cards), adjacency bonuses reward clever placement.
- **Gather / craft / survive**: resources tick down, the player keeps them up.
- **Run / upgrade**: short runs, pick 1 of 3 upgrades between rounds (roguelite).
- **Puzzle turns**: deterministic turns, perfect for a sim and for undo.

Pick one. Combine at most two.

## First numbers

Start with round numbers that make the first two rounds easy and the last round hard. Make the bot play 40 seeds and aim for a clear curve (losses cluster late, not on round 1). Change one number at a time.

Good first knobs: starting resources, income per building, enemy HP growth per round, enemy count per round, tower damage and range.

## Making runs different

Seeded map generation, a random draft (cards, blessings, upgrades), escalating threats with bosses on fixed rounds, and a choice that costs something (build economy or defence now).

## Template

```markdown
# <Game name>
Fantasy: ...
Loop: day (...) -> night (...) -> dawn (...)
Verbs: ...
Win: ... / Lose: ...
Variety: ...
Session: ... minutes
First numbers:
| thing | value |
|---|---|
```
