// Rule checks + a balance report. Runs in plain node, no browser.
//   node test/sim.test.mjs
import assert from 'node:assert/strict';
import * as S from '../public/js/sim.js';
import { playGame } from '../public/js/bot.js';
import { RULES } from '../public/js/rules.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  ok', name); };
const meadow = (s) => Object.values(s.tiles).find((x) => x.t === 'meadow' && !S.buildingAt(s, x.q, x.r));

console.log('sim');
t('same seed, same island', () => {
  assert.deepEqual(S.newGame({ seed: 5 }).tiles, S.newGame({ seed: 5 }).tiles);
  assert.notDeepEqual(S.newGame({ seed: 5 }).tiles, S.newGame({ seed: 6 }).tiles);
});
t('a new game starts by day with only the Town Hall', () => {
  const s = S.newGame({ seed: 1 });
  assert.equal(s.phase, 'day');
  assert.equal(Object.keys(s.buildings).length, 1);
  assert.equal(S.hall(s).q, 0);
});
t('building costs resources and takes the tile', () => {
  const s = S.newGame({ seed: 1 });
  const m = meadow(s);
  const before = { ...s.res };
  assert.equal(S.build(s, 'house', m.q, m.r).ok, true);
  assert.equal(s.res.wood, before.wood - RULES.BUILDINGS.house.cost.wood);
  assert.equal(S.canBuild(s, 'house', m.q, m.r).ok, false);
});
t('no building on forest, hills, water or without resources', () => {
  const s = S.newGame({ seed: 1 });
  const forest = Object.values(s.tiles).find((x) => x.t === 'forest');
  assert.equal(S.canBuild(s, 'house', forest.q, forest.r).ok, false);
  assert.equal(S.canBuild(s, 'house', 99, 99).ok, false);
  s.res.wood = 0;
  const m = meadow(s);
  assert.equal(S.canBuild(s, 'house', m.q, m.r).err, 'not enough resources');
});
t('no building at night', () => {
  const s = S.newGame({ seed: 1 });
  S.startNight(s);
  const m = meadow(s);
  assert.equal(S.canBuild(s, 'house', m.q, m.r).ok, false);
});
t('every night ends, and dawn pays the income', () => {
  const s = S.newGame({ seed: 2 });
  const inc = S.income(s);
  const before = { ...s.res };
  S.runNight(s);
  assert.equal(s.phase, 'day');
  assert.equal(s.night, 1);
  assert.equal(s.res.gold, before.gold + inc.gold);
});
t('the sim is deterministic (same seed, same bot game)', () => {
  assert.equal(S.summary(playGame({ seed: 9 })), S.summary(playGame({ seed: 9 })));
});
t('an undefended hall falls eventually', () => {
  const s = S.newGame({ seed: 3 });
  RULES.BUILDINGS.townhall.attack.dmg = 0;
  for (let i = 0; i < 20 && s.phase === 'day'; i++) S.runNight(s);
  RULES.BUILDINGS.townhall.attack.dmg = 6;
  assert.equal(s.phase, 'lost');
});

// balance report: the bot is a weak player, so it should win most but not all games
const N = 40;
let wins = 0;
const deaths = {};
for (let seed = 1; seed <= N; seed++) {
  const s = playGame({ seed });
  if (s.phase === 'won') wins++;
  else deaths[s.night + 1] = (deaths[s.night + 1] || 0) + 1;
}
console.log(`\nbalance: bot won ${wins}/${N} games. Lost on night: ${JSON.stringify(deaths)}`);
t('balance: the bot wins between 50% and 95%', () => {
  assert.ok(wins / N >= 0.5, 'too hard');
  assert.ok(wins / N <= 0.95, 'too easy');
});
console.log(`\n${passed} passed`);
