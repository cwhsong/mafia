import { describe, it, expect } from 'vitest'
import type { RoleDef } from '../engine/types'
import { ROLE_LIST, ROLES, AVAILABLE_ROLES, getRole, detectiveSees } from './index'

const TEAMS = ['town', 'mafia', 'neutral']

describe('every role', () => {
  it('has a unique id', () => {
    const ids = ROLE_LIST.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(ROLE_LIST)('$id is filled in correctly', (role) => {
    expect(role.id).toMatch(/^[a-z]+(-[a-z]+)*$/) // lowercase, dashes allowed
    expect(role.name.trim()).not.toBe('')
    expect(role.emoji.trim()).not.toBe('')
    expect(role.category.trim()).not.toBe('')
    expect(role.description.trim()).not.toBe('')
    expect(TEAMS).toContain(role.team)
  })

  it.each(ROLE_LIST.filter((r) => r.night))('$id has a valid night ability', (role) => {
    const night = role.night!
    expect(['other', 'any', 'self', 'dead', 'none']).toContain(night.target)
    for (const players of [5, 9, 15]) {
      const max = typeof night.maxUses === 'function' ? night.maxUses(players) : night.maxUses
      if (max === undefined) continue
      expect(Number.isInteger(max)).toBe(true)
      expect(max).toBeGreaterThan(0)
    }
  })
})

describe('registry', () => {
  it('makes the base deck and wave 1 available', () => {
    const ids = AVAILABLE_ROLES.map((r) => r.id).sort()
    expect(ids).toEqual([
      'amnesiac', 'avenger', 'bartender', 'blackmailer', 'bodyguard', 'consigliere', 'consort', 'coroner',
      'detective', 'framer', 'godfather', 'hypnotist', 'impostor', 'jester', 'lookout', 'mafioso', 'mayor',
      'medic', 'nemesis', 'private-eye', 'psychic', 'serial-killer', 'shadow', 'spy', 'survivor', 'veteran',
      'vigilante', 'villager', 'warden',
    ])
  })

  it('includes at least one available Mafia role', () => {
    expect(AVAILABLE_ROLES.some((r) => r.team === 'mafia')).toBe(true)
  })

  it('looks up roles by id', () => {
    expect(getRole('medic')).toBe(ROLES.medic)
  })

  it('throws on an unknown role id', () => {
    expect(() => getRole('medik')).toThrow('Unknown role: medik')
  })
})

describe('detectiveSees', () => {
  it('reads the Mafia and hostile Neutrals as suspicious', () => {
    expect(detectiveSees(getRole('mafioso'))).toBe('suspicious')
    expect(detectiveSees(getRole('framer'))).toBe('suspicious')
    expect(detectiveSees(getRole('serial-killer'))).toBe('suspicious')
  })

  it('reads the Town, Benign and Evil Neutrals, and the Godfather as not suspicious', () => {
    expect(detectiveSees(getRole('villager'))).toBe('not-suspicious')
    expect(detectiveSees(getRole('jester'))).toBe('not-suspicious')
    expect(detectiveSees(getRole('survivor'))).toBe('not-suspicious')
    expect(detectiveSees(getRole('godfather'))).toBe('not-suspicious')
  })

  it('respects appearsAs overrides', () => {
    const fake: RoleDef = { ...getRole('mafioso'), id: 'fake', appearsAs: 'not-suspicious' }
    expect(detectiveSees(fake)).toBe('not-suspicious')
  })
})