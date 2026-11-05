// Every tunable number of the game lives here. Pure data, no imports.
// Balance by editing numbers, never by hunting through logic.
// Any value can be overridden from the URL for testing:
//   ?r.START.gold=200&r.NIGHTS_TO_WIN=3

export const RULES = {
  MAP_RADIUS: 4,          // island size in hex rings around the Town Hall
  NIGHTS_TO_WIN: 7,
  START: { gold: 30, wood: 40 },

  // terrain weights for the island generator
  TERRAIN: {
    meadow: { label: 'Meadow', weight: 60, buildable: true },
    forest: { label: 'Forest', weight: 28, buildable: false },
    hills:  { label: 'Hills',  weight: 12, buildable: false },
  },

  // yields are paid at dawn. Each `desc` is a promise to the player,
  // test/promises.test.mjs checks it against the real logic.
  BUILDINGS: {
    townhall: {
      label: 'Town Hall', hp: 300, cost: {},
      yields: { gold: 6, wood: 4 },
      attack: { range: 4.5, dmg: 6, rate: 1.0 },
      desc: 'Your home. If it falls, the game is over.',
    },
    lumbermill: {
      label: 'Lumber Mill', hp: 80, cost: { gold: 10 },
      yields: { wood: 2 }, perAdjacent: { forest: { wood: 2 } },
      desc: '+2 wood, +2 more per adjacent Forest.',
    },
    house: {
      label: 'House', hp: 80, cost: { wood: 10 },
      yields: { gold: 3 },
      desc: '+3 gold every dawn.',
    },
    tower: {
      label: 'Tower', hp: 140, cost: { wood: 15, gold: 10 },
      attack: { range: 5, dmg: 10, rate: 0.8 },
      desc: 'Shoots the nearest enemy within 5 for 10 damage.',
    },
  },

  // night: enemies walk from the shore to the nearest building
  ENEMY: { hp: 18, hpPerNight: 5, speed: 1.3, dps: 4, reach: 0.9 },
  wave: (night) => 3 + night * 2,   // enemies on night N (1-based)
  SPAWN_GAP: 0.8,                   // seconds between spawns
  NIGHT_LIMIT: 180,                 // safety: a night never lasts longer than this (sim seconds)
  STEP: 1 / 20,                     // fixed simulation step in seconds
};

// apply ?r.a.b=value overrides (numbers and booleans are parsed)
export function applyOverrides(search) {
  const params = new URLSearchParams(search);
  for (const [k, raw] of params) {
    if (!k.startsWith('r.')) continue;
    const path = k.slice(2).split('.');
    let o = RULES;
    for (const p of path.slice(0, -1)) { if (o[p] == null) o[p] = {}; o = o[p]; }
    const v = raw === 'true' ? true : raw === 'false' ? false : Number.isFinite(Number(raw)) ? Number(raw) : raw;
    o[path[path.length - 1]] = v;
  }
}
