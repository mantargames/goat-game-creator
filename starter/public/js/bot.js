// A greedy bot that plays through the same sim API the player uses.
// Used by node balance tests and by ?autoplay / ?sim=N in the browser.
// If the bot can't win, ask whether the rules or the bot are the problem.

import { dist } from './hex.js';
import { RULES } from './rules.js';
import * as S from './sim.js';

const count = (state, type) => Object.values(state.buildings).filter((b) => b.type === type).length;
const center = { q: 0, r: 0 };

function freeMeadows(state, type) {
  return Object.values(state.tiles).filter((t) => S.canBuild(state, type, t.q, t.r).ok);
}

function score(state, type, t) {
  if (type === 'tower') return -Math.abs(dist(t, center) - 2) * 2; // a ring around the hall
  const y = S.yieldOf(state, type, t.q, t.r);
  return (y.gold || 0) + (y.wood || 0) - dist(t, center) * 0.3;
}

function bestSpot(state, type) {
  const spots = freeMeadows(state, type);
  if (!spots.length) return null;
  spots.sort((a, b) => score(state, type, b) - score(state, type, a) || a.q - b.q || a.r - b.r);
  return spots[0];
}

// what to build next: keep towers ahead of the waves, economy otherwise
function want(state) {
  const towers = count(state, 'tower');
  if (towers < 1 + Math.floor(state.night * 0.8)) return 'tower';
  if (count(state, 'lumbermill') <= count(state, 'house')) return 'lumbermill';
  return 'house';
}

export function playDay(state) {
  let guard = 50;
  while (state.phase === 'day' && guard--) {
    const type = want(state);
    const spot = bestSpot(state, type);
    if (!spot || !S.build(state, type, spot.q, spot.r).ok) {
      // can't afford the wish: try anything affordable, else stop
      const alt = ['house', 'lumbermill', 'tower'].find((t) => t !== type && bestSpot(state, t));
      if (!alt) return;
      const s = bestSpot(state, alt);
      if (!S.build(state, alt, s.q, s.r).ok) return;
    }
  }
}

export function playGame({ seed = 1, maxNights = RULES.NIGHTS_TO_WIN } = {}) {
  const state = S.newGame({ seed });
  while (state.phase === 'day' && state.night < maxNights) {
    playDay(state);
    S.runNight(state);
    state.events.length = 0;
  }
  return state;
}
