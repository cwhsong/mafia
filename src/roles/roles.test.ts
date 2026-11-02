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
    expect(Number.isFinite(night.priority)).toBe(true)
    if (night.maxUses !== undefined) {
      expect(Number.isInteger(night.maxUses)).toBe(true)
      expect(night.maxUses).toBeGreaterThan(0)
    }
  })
})

describe('registry', () => {
  it('makes exactly the base deck available', () => {
    const ids = AVAILABLE_ROLES.map((r) => r.id).sort()
    expect(ids).toEqual(['detective', 'mafioso', 'medic', 'villager'])
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
  it('shows Mafia team roles as mafia', () => {
    expect(detectiveSees(getRole('mafioso'))).toBe('mafia')
  })

  it('shows town and neutral roles as not-mafia', () => {
    expect(detectiveSees(getRole('villager'))).toBe('not-mafia')
    expect(detectiveSees(getRole('jester'))).toBe('not-mafia')
  })

  it('respects appearsAs overrides', () => {
    const fakeGodfather: RoleDef = {
      ...getRole('mafioso'),
      id: 'godfather',
      appearsAs: 'not-mafia',
    }
    expect(detectiveSees(fakeGodfather)).toBe('not-mafia')
  })
})