import { describe, it, expect } from 'vitest'
import { createRng } from '../engine/rng'
import {
  CODE_LETTERS, CODE_LENGTH, generateRoomCode, normalizeRoomCode, isValidRoomCode, codeFromHash,
} from './roomCode'

describe('generateRoomCode', () => {
  const rng = createRng(2026)
  const codes = Array.from({ length: 1000 }, () => generateRoomCode(rng))

  it('makes valid 6-letter codes', () => {
    for (const code of codes) {
      expect(code).toHaveLength(CODE_LENGTH)
      expect(isValidRoomCode(code)).toBe(true)
    }
  })

  it('never uses look-alike characters', () => {
    for (const code of codes) {
      expect(code).not.toMatch(/[ILO01]/)
    }
  })

  it('produces varied codes', () => {
    expect(new Set(codes).size).toBeGreaterThan(990)
  })

  it('is reproducible with a seeded random source', () => {
    expect(generateRoomCode(createRng(7))).toBe(generateRoomCode(createRng(7)))
  })

  it('can use every allowed letter', () => {
    const used = new Set(codes.join(''))
    expect(used.size).toBe(CODE_LETTERS.length)
  })
})

describe('normalizeRoomCode', () => {
  it('uppercases and removes spaces and dashes', () => {
    expect(normalizeRoomCode(' kxq-rtz ')).toBe('KXQRTZ')
    expect(normalizeRoomCode('kx qr tz')).toBe('KXQRTZ')
  })
})

describe('isValidRoomCode', () => {
  it('accepts a proper code', () => {
    expect(isValidRoomCode('KXQRTZ')).toBe(true)
  })

  it('rejects wrong lengths', () => {
    expect(isValidRoomCode('KXQRT')).toBe(false)
    expect(isValidRoomCode('KXQRTZA')).toBe(false)
  })

  it('rejects look-alikes, digits and lowercase', () => {
    expect(isValidRoomCode('KXQRTO')).toBe(false)
    expect(isValidRoomCode('KXQRT1')).toBe(false)
    expect(isValidRoomCode('kxqrtz')).toBe(false)
  })
})

describe('codeFromHash', () => {
  it('reads a code from a join link', () => {
    expect(codeFromHash('#kxqrtz')).toBe('KXQRTZ')
  })

  it('returns null for an empty or invalid hash', () => {
    expect(codeFromHash('')).toBeNull()
    expect(codeFromHash('#')).toBeNull()
    expect(codeFromHash('#nope')).toBeNull()
  })
})