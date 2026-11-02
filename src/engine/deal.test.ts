import { describe, it, expect } from 'vitest'
import type { GameState } from './types'
import { setRoleSlots } from './setup'
import { dealRoles } from './deal'
import { expectEngineError, lobbyWith } from './testHelpers'

const SEVEN = ['mafioso', 'mafioso', 'medic', 'detective', 'villager', 'villager', 'villager']

function readyGame(seed = 1): GameState {
  return setRoleSlots(lobbyWith(7, seed), SEVEN)
}

describe('dealRoles', () => {
  it('gives every player exactly one role', () => {
    const dealt = dealRoles(readyGame())
    for (const player of dealt.players) {
      expect(player.roleId).not.toBeNull()
    }
  })

  it('deals exactly the chosen roles, no more, no less', () => {
    const dealt = dealRoles(readyGame())
    const dealtRoles = dealt.players.map((p) => p.roleId).sort()
    expect(dealtRoles).toEqual([...SEVEN].sort())
  })

  it('keeps names, ids and seats unchanged', () => {
    const before = readyGame()
    const dealt = dealRoles(before)
    expect(dealt.players.map((p) => [p.id, p.name, p.seat]))
      .toEqual(before.players.map((p) => [p.id, p.name, p.seat]))
  })

  it('starts Night 1 and logs it', () => {
    const dealt = dealRoles(readyGame())
    expect(dealt.phase).toBe('night')
    expect(dealt.round).toBe(1)
    expect(dealt.log).toEqual([
      { type: 'dealt' },
      { type: 'phase', phase: 'night', round: 1 },
    ])
  })

  it('does not change the original state', () => {
    const before = readyGame()
    dealRoles(before)
    expect(before.phase).toBe('lobby')
    expect(before.players.every((p) => p.roleId === null)).toBe(true)
  })

  it('gives the same deal for the same seed', () => {
    const a = dealRoles(readyGame(42)).players.map((p) => p.roleId)
    const b = dealRoles(readyGame(42)).players.map((p) => p.roleId)
    expect(a).toEqual(b)
  })

  it('gives different deals for different seeds', () => {
    const a = dealRoles(readyGame(1)).players.map((p) => p.roleId)
    const b = dealRoles(readyGame(2)).players.map((p) => p.roleId)
    expect(a).not.toEqual(b)
  })

  it('is fair: each seat is Mafia about equally often', () => {
    const runs = 3000
    const mafiaCounts = new Array(7).fill(0)
    for (let seed = 1; seed <= runs; seed++) {
      dealRoles(readyGame(seed)).players.forEach((p, seat) => {
        if (p.roleId === 'mafioso') mafiaCounts[seat]++
      })
    }
    // 2 Mafia in 7 seats, so each seat should be Mafia about 2/7 (0.286) of the time
    for (const count of mafiaCounts) {
      expect(count / runs).toBeGreaterThan(0.25)
      expect(count / runs).toBeLessThan(0.32)
    }
  })

  it('refuses an invalid setup and explains why', () => {
    const tooFewRoles = setRoleSlots(lobbyWith(7), ['mafioso', 'medic'])
    expectEngineError(() => dealRoles(tooFewRoles), 'invalid-setup')
    expect(() => dealRoles(tooFewRoles)).toThrow(/Pick 7 roles/)
  })

  it('cannot deal twice', () => {
    const dealt = dealRoles(readyGame())
    expectEngineError(() => dealRoles(dealt), 'wrong-phase')
  })
})