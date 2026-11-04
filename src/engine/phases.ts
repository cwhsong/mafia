import type { GameState, Phase } from './types'
import { assertNoRevenge, assertPhase } from './errors'

// Moves the game to its next phase:
// Day 1 → Night 1 → Dawn 1 → Day 2 → Vote 2 → Night 2 → Dawn 2 → Day 3 …
export function advancePhase(state: GameState): GameState {
  assertPhase(state, 'day', 'vote', 'night', 'dawn')
  assertNoRevenge(state)

  const next = nextStep(state.phase, state.round)
  return enterPhase(state, next.phase, next.round)
}

// Moves to a phase, clearing whatever belonged to the one before it.
export function enterPhase(state: GameState, phase: Phase, round: number): GameState {
  const fresh: Partial<GameState> = {}
  const noPicks = { nightPicks: {}, nightOptions: {}, killMarks: {} }
  if (phase === 'night') Object.assign(fresh, { ...noPicks, votes: {}, voteResult: null })
  if (phase === 'day') Object.assign(fresh, { ...noPicks, dawn: null })
  if (phase === 'vote') Object.assign(fresh, { ...noPicks, votes: {}, voteResult: null, dawn: null })

  return {
    ...state,
    ...fresh,
    phase,
    round,
    log: [...state.log, { type: 'phase', phase, round }],
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