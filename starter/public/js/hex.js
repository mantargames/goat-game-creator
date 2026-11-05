// Hex math for pointy-top tiles, 2.0 units flat-to-flat (KayKit Medieval Hexagon size).
// Axial coordinates (q, r). Pure, no three.js, so the sim runs headless in node.

export const HEX_W = 2.0;
export const HEX_R = HEX_W / Math.sqrt(3); // circumradius

export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const key = (q, r) => `${q},${r}`;

export function toWorld(q, r) {
  return { x: HEX_W * (q + r / 2), z: HEX_R * 1.5 * r };
}

export const dist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
export const neighbors = (q, r) => DIRS.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));

export function disk(radius) {
  const out = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) out.push({ q, r });
  }
  return out;
}

// Seeded PRNG (mulberry32): the same seed always gives the same game.
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = () => a;
  return next;
}
