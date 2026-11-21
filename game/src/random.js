// Solmarina — deterministic seeded random numbers.
// The city, traffic and pedestrians are all built from one seed, so a screenshot
// staged with ?shot=...&seed=N looks the same every time it is taken.

// mulberry32: small, fast, good enough for procedural placement.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random number in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Random integer in [min, max] inclusive.
export function rangeInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

// Pick one element of an array.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// Fisher-Yates shuffle that returns a new array, leaving the input alone.
export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Clamp a value into [min, max].
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

// Linear interpolation.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed angle difference from `from` to `to`, in radians.
export function angleDiff(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Distance between two points.
export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}
