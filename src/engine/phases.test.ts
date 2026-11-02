import { describe, it, expect } from 'vitest'
import type { GameState } from './types'
import { setRoleSlots } from './setup'
import { dealRoles } from './deal'
import { advancePhase } from './phases'
import { expectEngineError, lobbyWith } from './testHelpers'

function startedGame(): GameState {
  return dealRoles(
    setRoleSlots(lobbyWith(5), ['mafioso', 'medic', 'detective', 'villager', 'villager']),
  )
}

// Advances n times and records [phase, round] after each step
function walk(state: GameState, steps: number): [string, number][] {
  const seen: [string, number][] = []
  for (let i = 0; i < steps; i++) {
    state = advancePhase(state)
    seen.push([state.phase, state.round])
  }
  return seen
}

describe('advancePhase', () => {
  it('goes from Day 1 straight to Night 1 (no vote on Day 1)', () => {
    const next = advancePhase(startedGame())
    expect(next.phase).toBe('night')
    expect(next.round).toBe(1)
  })

  it('follows the full cycle with correct round numbers', () => {
    expect(walk(startedGame(), 9)).toEqual([
      ['night', 1],
      ['dawn', 1],
      ['day', 2],
      ['vote', 2],
      ['night', 2],
      ['dawn', 2],
      ['day', 3],
      ['vote', 3],
      ['night', 3],
    ])
  })

  it('logs every phase change', () => {
    const state = advancePhase(advancePhase(startedGame()))
    expect(state.log.slice(-2)).toEqual([
      { type: 'phase', phase: 'night', round: 1 },
      { type: 'phase', phase: 'dawn', round: 1 },
    ])
  })

  it('does not change the original state', () => {
    const before = startedGame()
    advancePhase(before)
    expect(before.phase).toBe('day')
    expect(before.round).toBe(1)
  })

  it('cannot advance from the lobby', () => {
    expectEngineError(() => advancePhase(lobbyWith(5)), 'wrong-phase')
  })

  it('cannot advance after the game has ended', () => {
    const ended: GameState = { ...startedGame(), phase: 'ended' }
    expectEngineError(() => advancePhase(ended), 'wrong-phase')
  })
})