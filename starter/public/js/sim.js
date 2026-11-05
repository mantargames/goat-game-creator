// Pure game logic. No DOM, no three.js: runs the same in the browser and in node.
// The renderer only reads `state` and drains `state.events`.
//
//   day:   build on meadows (canBuild / build), then startNight()
//   night: step(state, dt) until every enemy is dead, then dawn pays income
//   end:   phase 'won' after RULES.NIGHTS_TO_WIN nights, 'lost' if the Town Hall falls

import { key, neighbors, dist, disk, toWorld, rng } from './hex.js';
import { RULES } from './rules.js';

const RES = ['gold', 'wood'];
const fail = (err) => ({ ok: false, err });

function withRng(state, fn) {
  const r = rng(state.rngA);
  const out = fn(r);
  state.rngA = r.state();
  return out;
}

// ───────────────────────────────────────────── setup

export function newGame({ seed = 1 } = {}) {
  const state = {
    seed, rngA: seed * 7919 + 13,
    phase: 'day', night: 0, time: 0,
    res: { ...RULES.START },
    tiles: {}, buildings: {}, nextId: 1,
    enemies: [], spawnLeft: 0, spawnTimer: 0, nightTime: 0,
    events: [],
  };
  const weights = Object.entries(RULES.TERRAIN);
  const total = weights.reduce((n, [, t]) => n + t.weight, 0);
  withRng(state, (r) => {
    for (const h of disk(RULES.MAP_RADIUS)) {
      let roll = r() * total, t = 'meadow';
      for (const [name, def] of weights) { roll -= def.weight; if (roll <= 0) { t = name; break; } }
      if (dist(h, { q: 0, r: 0 }) <= 1) t = 'meadow'; // keep the heart of the island open
      state.tiles[key(h.q, h.r)] = { q: h.q, r: h.r, t, v: Math.floor(r() * 3) };
    }
  });
  place(state, 'townhall', 0, 0);
  return state;
}

// ───────────────────────────────────────────── queries

export const tileAt = (state, q, r) => state.tiles[key(q, r)];
export const buildingAt = (state, q, r) => Object.values(state.buildings).find((b) => b.q === q && b.r === r);
export const hall = (state) => Object.values(state.buildings).find((b) => b.type === 'townhall');
export const canAfford = (state, cost) => RES.every((k) => (state.res[k] || 0) >= (cost[k] || 0));

export function canBuild(state, type, q, r) {
  const def = RULES.BUILDINGS[type];
  if (!def || type === 'townhall') return fail('unknown building');
  if (state.phase !== 'day') return fail('build by day');
  const t = tileAt(state, q, r);
  if (!t) return fail('not on the island');
  if (!RULES.TERRAIN[t.t].buildable) return fail(`cannot build on ${RULES.TERRAIN[t.t].label}`);
  if (buildingAt(state, q, r)) return fail('tile taken');
  if (!canAfford(state, def.cost)) return fail('not enough resources');
  return { ok: true };
}

// what a building of `type` would produce at (q, r), adjacency included
export function yieldOf(state, type, q, r) {
  const def = RULES.BUILDINGS[type];
  const out = { ...(def.yields || {}) };
  for (const [terrain, bonus] of Object.entries(def.perAdjacent || {})) {
    const n = neighbors(q, r).filter((h) => tileAt(state, h.q, h.r)?.t === terrain).length;
    for (const [res, v] of Object.entries(bonus)) out[res] = (out[res] || 0) + v * n;
  }
  return out;
}

export function income(state) {
  const out = { gold: 0, wood: 0 };
  for (const b of Object.values(state.buildings)) {
    for (const [k, v] of Object.entries(yieldOf(state, b.type, b.q, b.r))) out[k] += v;
  }
  return out;
}

export function worldPos(b) { return toWorld(b.q, b.r); }

// ───────────────────────────────────────────── day actions

function place(state, type, q, r) {
  const b = { id: state.nextId++, type, q, r, hp: RULES.BUILDINGS[type].hp, cd: 0 };
  state.buildings[b.id] = b;
  return b;
}

export function build(state, type, q, r) {
  const ok = canBuild(state, type, q, r);
  if (!ok.ok) return ok;
  for (const k of RES) state.res[k] -= RULES.BUILDINGS[type].cost[k] || 0;
  const b = place(state, type, q, r);
  state.events.push({ type: 'built', id: b.id });
  return { ok: true, building: b };
}

export function startNight(state) {
  if (state.phase !== 'day') return fail('not day');
  state.phase = 'night';
  state.spawnLeft = RULES.wave(state.night + 1);
  state.spawnTimer = 0;
  state.nightTime = 0;
  state.events.push({ type: 'night', night: state.night + 1, enemies: state.spawnLeft });
  return { ok: true };
}

// ───────────────────────────────────────────── night

function spawnEnemy(state) {
  const shore = disk(RULES.MAP_RADIUS).filter((h) => dist(h, { q: 0, r: 0 }) === RULES.MAP_RADIUS);
  const h = withRng(state, (r) => shore[Math.floor(r() * shore.length)]);
  const w = toWorld(h.q, h.r);
  const e = {
    id: state.nextId++,
    x: w.x * 1.08, z: w.z * 1.08, // start just off the beach
    hp: RULES.ENEMY.hp + RULES.ENEMY.hpPerNight * state.night,
  };
  e.maxHp = e.hp;
  state.enemies.push(e);
  state.events.push({ type: 'spawn', id: e.id });
}

function nearestBuilding(state, e) {
  let best = null, bd = Infinity;
  for (const b of Object.values(state.buildings)) {
    const w = worldPos(b);
    const d = Math.hypot(w.x - e.x, w.z - e.z);
    if (d < bd) { bd = d; best = b; }
  }
  return { b: best, d: bd };
}

// advance the night by dt seconds. Deterministic: same state + same dt = same result.
export function step(state, dt = RULES.STEP) {
  if (state.phase !== 'night') return;
  state.time += dt;
  state.nightTime += dt;

  // spawns
  state.spawnTimer -= dt;
  while (state.spawnLeft > 0 && state.spawnTimer <= 0) {
    spawnEnemy(state);
    state.spawnLeft--;
    state.spawnTimer += RULES.SPAWN_GAP;
  }

  // enemies walk to the nearest building and chew on it
  for (const e of state.enemies) {
    const { b, d } = nearestBuilding(state, e);
    if (!b) continue;
    if (d > RULES.ENEMY.reach) {
      const w = worldPos(b);
      const s = Math.min(d - RULES.ENEMY.reach, RULES.ENEMY.speed * dt);
      e.x += ((w.x - e.x) / d) * s;
      e.z += ((w.z - e.z) / d) * s;
    } else {
      b.hp -= RULES.ENEMY.dps * dt;
      if (b.hp <= 0) {
        delete state.buildings[b.id];
        state.events.push({ type: 'destroyed', id: b.id, building: b.type });
        if (b.type === 'townhall') { state.phase = 'lost'; state.events.push({ type: 'lost' }); return; }
      }
    }
  }

  // towers (and the hall) shoot the nearest enemy in range
  for (const b of Object.values(state.buildings)) {
    const a = RULES.BUILDINGS[b.type].attack;
    if (!a) continue;
    b.cd -= dt;
    if (b.cd > 0) continue;
    const w = worldPos(b);
    let target = null, td = a.range;
    for (const e of state.enemies) {
      const d = Math.hypot(w.x - e.x, w.z - e.z);
      if (d <= td) { td = d; target = e; }
    }
    if (!target) continue;
    b.cd = a.rate;
    target.hp -= a.dmg;
    state.events.push({ type: 'shot', from: b.id, to: target.id });
  }
  for (const e of state.enemies) if (e.hp <= 0) state.events.push({ type: 'killed', id: e.id });
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  const cleared = state.spawnLeft === 0 && state.enemies.length === 0;
  if (cleared || state.nightTime >= RULES.NIGHT_LIMIT) dawn(state);
}

function dawn(state) {
  state.enemies = [];
  state.night++;
  const inc = income(state);
  for (const k of RES) state.res[k] += inc[k];
  for (const b of Object.values(state.buildings)) b.hp = RULES.BUILDINGS[b.type].hp; // repairs overnight
  state.phase = state.night >= RULES.NIGHTS_TO_WIN ? 'won' : 'day';
  state.events.push({ type: 'dawn', night: state.night, income: inc });
  if (state.phase === 'won') state.events.push({ type: 'won' });
}

// run the whole night synchronously (tests, ?sim, bot)
export function runNight(state) {
  if (state.phase === 'day') startNight(state);
  while (state.phase === 'night') step(state, RULES.STEP);
}

// one line that describes the game, for ?sim and test logs
export function summary(state) {
  const counts = {};
  for (const b of Object.values(state.buildings)) counts[b.type] = (counts[b.type] || 0) + 1;
  const h = hall(state);
  return `phase=${state.phase} night=${state.night} gold=${state.res.gold} wood=${state.res.wood} `
    + `hall=${h ? Math.round(h.hp) : 0} buildings=${JSON.stringify(counts)}`;
}
