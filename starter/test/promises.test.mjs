// Every number the game shows the player must be what the rules actually do.
// When you add or change a `desc` in rules.js, add or change a check here.
//   node test/promises.test.mjs
import assert from 'node:assert/strict';
import * as S from '../public/js/sim.js';
import { RULES } from '../public/js/rules.js';
import { key } from '../public/js/hex.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  ok', name); };

// a hand-made board: hall at 0,0 plus whatever terrain the check needs
function board(extra = {}) {
  const s = S.newGame({ seed: 1 });
  s.tiles = { '0,0': { q: 0, r: 0, t: 'meadow', v: 0 } };
  for (const [k, terrain] of Object.entries(extra)) {
    const [q, r] = k.split(',').map(Number);
    s.tiles[key(q, r)] = { q, r, t: terrain, v: 0 };
  }
  s.res = { gold: 999, wood: 999 };
  return s;
}

console.log('promises');
const B = RULES.BUILDINGS;
t(`Lumber Mill: "${B.lumbermill.desc}"`, () => {
  const s = board({ '2,0': 'meadow', '3,0': 'forest', '3,-1': 'forest', '2,1': 'meadow' });
  assert.equal(S.yieldOf(s, 'lumbermill', 2, 0).wood, 2 + 2 * 2);
  assert.equal(S.yieldOf(s, 'lumbermill', 2, 1).wood, 2 + 2 * 1); // touches only 3,0
});
t(`House: "${B.house.desc}"`, () => {
  const s = board({ '2,0': 'meadow' });
  const before = S.income(s).gold;
  S.build(s, 'house', 2, 0);
  assert.equal(S.income(s).gold - before, 3);
});
t(`Tower: "${B.tower.desc}"`, () => {
  const s = board({ '2,0': 'meadow' });
  const tower = S.build(s, 'tower', 2, 0).building;
  RULES.BUILDINGS.townhall.attack.dmg = 0; // isolate the tower
  S.startNight(s);
  s.spawnLeft = 0;
  s.enemies = [
    { id: 900, x: 2 + 5.0, z: 0, hp: 100, maxHp: 100 },  // exactly at range 5
    { id: 901, x: 2 + 5.3, z: 0, hp: 100, maxHp: 100 },  // just outside
  ];
  RULES.ENEMY.speed = 0;
  S.step(s, 0.01);
  RULES.ENEMY.speed = 1.3;
  RULES.BUILDINGS.townhall.attack.dmg = 6;
  assert.equal(s.enemies.find((e) => e.id === 900).hp, 100 - 10);
  assert.equal(s.enemies.find((e) => e.id === 901).hp, 100);
  assert.ok(tower);
});
t(`Town Hall: "${B.townhall.desc}"`, () => {
  const s = board();
  S.startNight(s);
  S.hall(s).hp = 0.001;
  s.spawnLeft = 0;
  s.enemies = [{ id: 900, x: 0.5, z: 0, hp: 1000, maxHp: 1000 }];
  S.step(s, 0.1);
  assert.equal(s.phase, 'lost');
});
console.log(`\n${passed} passed`);
