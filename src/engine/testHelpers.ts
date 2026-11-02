import { expect } from 'vitest'
import { EngineError, type EngineErrorCode } from './errors'

import type { GameState } from './types'
import { createGame, addPlayer } from './setup'

// Passes only if fn throws an EngineError with exactly this code.
export function expectEngineError(fn: () => unknown, code: EngineErrorCode): void {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError)
    expect((error as EngineError).code).toBe(code)
    return
  }
  throw new Error(`Expected EngineError "${code}", but nothing was thrown`)
}

// A lobby with players id0/P0, id1/P1, …
export function lobbyWith(count: number, seed = 1): GameState {
  let state = createGame('host', seed)
  for (let i = 0; i < count; i++) {
    state = addPlayer(state, `id${i}`, `P${i}`)
  }
  return state
}

// A dealt game on Day 1 with chosen roles in seat order: id0 gets roles[0], etc.
// Skips validation on purpose, so tests can build any situation.
export function gameWithRoles(roles: string[]): GameState {
  const lobby = lobbyWith(roles.length)
  return {
    ...lobby,
    phase: 'day',
    round: 1,
    roleSlots: [...roles],
    players: lobby.players.map((p, i) => ({ ...p, roleId: roles[i] })),
  }
}