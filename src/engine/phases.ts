import type { GameState, Phase } from './types'
import { assertPhase } from './errors'

// Moves the game to its next phase:
// Day 1 → Night 1 → Dawn 1 → Day 2 → Vote 2 → Night 2 → Dawn 2 → Day 3 …
export function advancePhase(state: GameState): GameState {
  assertPhase(state, 'day', 'vote', 'night', 'dawn')

  const next = nextStep(state.phase, state.round)

  return {
    ...state,
    phase: next.phase,
    round: next.round,
    log: [...state.log, { type: 'phase', phase: next.phase, round: next.round }],
  }
}

function nextStep(phase: Phase, round: number): { phase: Phase; round: number } {
  if (phase === 'day') {
    // Day 1 has no vote, as in Town of Salem
    return round === 1 ? { phase: 'night', round } : { phase: 'vote', round }
  }
  if (phase === 'vote') return { phase: 'night', round }
  if (phase === 'night') return { phase: 'dawn', round }
  // Only 'dawn' is left (assertPhase blocked lobby and ended)
  return { phase: 'day', round: round + 1 }
}