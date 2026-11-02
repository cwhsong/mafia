import type { GameState } from './types'
import { EngineError, assertPhase } from './errors'
import { validateSetup } from './setup'
import { createRng, shuffle } from './rng'

export function dealRoles(state: GameState): GameState {
  assertPhase(state, 'lobby')

  const problems = validateSetup(state)
  if (problems.length > 0) {
    throw new EngineError('invalid-setup', problems.join(' '))
  }

  const rng = createRng(state.seed)
  const shuffledRoles = shuffle(state.roleSlots, rng)

  const players = state.players.map((player, index) => ({
    ...player,
    roleId: shuffledRoles[index],
  }))

  return {
    ...state,
    players,
    phase: 'night',
    round: 1,
    log: [
      ...state.log,
      { type: 'dealt' },
      { type: 'phase', phase: 'night', round: 1 },
    ],
  }
}