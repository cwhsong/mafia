export type Rng = () => number

// Seeded random number generator (the "mulberry32" algorithm).
// Same seed -> same sequence of numbers in [0, 1), forever.
export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Fisher–Yates shuffle. Returns a NEW array; never changes the input.
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) // random index from 0 to i
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// A fresh random seed for real games.
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]
}