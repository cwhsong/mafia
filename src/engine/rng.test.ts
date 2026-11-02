import { describe, it, expect } from 'vitest'
import { createRng, shuffle, randomSeed } from './rng'

const take = (rng: () => number, n: number) => Array.from({ length: n }, () => rng())

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(createRng(42), 5)).toEqual(take(createRng(42), 5))
  })

  it('gives different sequences for different seeds', () => {
    expect(take(createRng(1), 5)).not.toEqual(take(createRng(2), 5))
  })

  it('returns numbers in [0, 1)', () => {
    for (const n of take(createRng(123), 1000)) {
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })

  it('is roughly even (average near 0.5)', () => {
    const values = take(createRng(99), 10_000)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    expect(avg).toBeGreaterThan(0.48)
    expect(avg).toBeLessThan(0.52)
  })
})

describe('shuffle', () => {
  const deck = ['villager', 'villager', 'mafioso', 'medic', 'detective']

  it('keeps every item exactly once', () => {
    const result = shuffle(deck, createRng(7))
    expect([...result].sort()).toEqual([...deck].sort())
  })

  it('does not modify the input', () => {
    const copy = [...deck]
    shuffle(deck, createRng(7))
    expect(deck).toEqual(copy)
  })

  it('is reproducible with the same seed', () => {
    expect(shuffle(deck, createRng(7))).toEqual(shuffle(deck, createRng(7)))
  })

  it('changes order with a different seed', () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    expect(shuffle(items, createRng(1))).not.toEqual(shuffle(items, createRng(2)))
  })

  it('handles empty and single-item lists', () => {
    expect(shuffle([], createRng(1))).toEqual([])
    expect(shuffle(['solo'], createRng(1))).toEqual(['solo'])
  })

  it('is fair: each item lands first about equally often', () => {
    const rng = createRng(2026)
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 }
    const runs = 6000
    for (let i = 0; i < runs; i++) {
      counts[shuffle(['a', 'b', 'c'], rng)[0]]++
    }
    for (const key of ['a', 'b', 'c']) {
      expect(counts[key] / runs).toBeGreaterThan(0.3) // expected about 0.333
      expect(counts[key] / runs).toBeLessThan(0.37)
    }
  })
})

describe('randomSeed', () => {
  it('returns a whole number in the 32-bit range', () => {
    const seed = randomSeed()
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 32)
  })
})