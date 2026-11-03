import type { GameState } from './types'
import { EngineError, assertPhase } from './errors'

// When a reveal decides the game, hold the winner back for one more beat:
// the narrator tells the ending, then reveals the winner.
export function toFinale(before: GameState, after: GameState): GameState {
  if (after.phase !== 'ended' || !after.winner) return after
  const winner = after.winner
  return {
    ...after,
    phase: 'finale',
    winner: null,
    finale: { winner, round: before.round, fromPhase: before.phase },
    log: [
      ...after.log.filter((e) => e.type !== 'game-over'),
      { type: 'phase', phase: 'finale', round: before.round },
    ],
  }
}

export function revealWinner(state: GameState): GameState {
  assertPhase(state, 'finale')
  const finale = state.finale
  if (!finale) throw new EngineError('no-dawn', 'There is no winner to reveal')
  return {
    ...state,
    phase: 'ended',
    winner: finale.winner,
    log: [...state.log, { type: 'game-over', winner: finale.winner }],
  }
}
