import { describe, it, expect } from 'vitest'
import type { GameState } from './types'
import { checkWin } from './win'
import { gameWithRoles } from './testHelpers'

// Marks the given seats dead without going through eliminate
function withDead(state: GameState, ...ids: string[]): GameState {
  return {
    ...state,
    players: state.players.map((p) => (ids.includes(p.id) ? { ...p, alive: false } : p)),
  }
}

describe('checkWin', () => {
  const seven = ['mafioso', 'mafioso', 'medic', 'detective', 'villager', 'villager', 'villager']

  it('has no winner at the start', () => {
    expect(checkWin(gameWithRoles(seven))).toBeNull()
  })

  it('gives Town the win when no Mafia are alive', () => {
    expect(checkWin(withDead(gameWithRoles(seven), 'id0', 'id1'))).toBe('town')
  })

  it('gives Mafia the win at parity', () => {
    // 2 Mafia alive vs 2 others alive
    const state = withDead(gameWithRoles(seven), 'id2', 'id3', 'id4')
    expect(checkWin(state)).toBe('mafia')
  })

  it('gives Mafia the win when they outnumber everyone else', () => {
    const state = withDead(gameWithRoles(seven), 'id2', 'id3', 'id4', 'id5')
    expect(checkWin(state)).toBe('mafia')
  })

  it('has no winner when Mafia are one short of parity', () => {
    // 2 Mafia vs 3 others
    const state = withDead(gameWithRoles(seven), 'id2', 'id3')
    expect(checkWin(state)).toBeNull()
  })

  it('ignores dead players', () => {
    // One Mafioso dead, 1 Mafia vs 5 others
    expect(checkWin(withDead(gameWithRoles(seven), 'id0'))).toBeNull()
  })
})