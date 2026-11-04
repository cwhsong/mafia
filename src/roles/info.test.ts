import { describe, expect, it } from 'vitest'
import { FACTIONS, INFO, ROLE_INFO, tagLine } from './info'
import { ROLE_LIST } from './index'

describe('role info', () => {
  it('has unique ids and text for every role the engine knows', () => {
    expect(new Set(ROLE_INFO.map((r) => r.id)).size).toBe(ROLE_INFO.length)
    for (const role of ROLE_LIST) expect(INFO[role.id], role.id).toBeDefined()
  })

  it('puts every role in a category its faction lists', () => {
    for (const r of ROLE_INFO) {
      if (r.category === null) continue
      const faction = FACTIONS.find((f) => f.id === r.faction)!
      expect(faction.categories.map((c) => c.name), r.id).toContain(r.category)
    }
  })

  it('writes abilities as one short line', () => {
    for (const r of ROLE_INFO) {
      expect(r.ability.length, r.id).toBeLessThan(150)
      expect(r.ability, r.id).not.toMatch(/each night/i)
    }
  })

  it('builds the tag line', () => {
    expect(tagLine(INFO.medic)).toBe('Town Protective · Beginner')
    expect(tagLine(INFO.villager)).toBe('Town · Beginner · Repeatable')
  })
})
