import type { GameState } from './types'
import { EngineError, assertPhase } from './errors'
import { eliminate } from './eliminate'
import { submitAction } from './night'
import { toFinale } from './finale'

// An Avenger who just died picks who to take with them (or lets it go); it happens at once.
// A Jester voted out picks one of their voters during the following night; that death
// lands at dawn with the rest.
export function takeRevenge(state: GameState, playerId: string, targetId: string | null): GameState {
  const pending = state.pendingRevenge
  if (!pending || pending.playerId !== playerId) throw new EngineError('not-allowed', 'There is no revenge to take')

  if (pending.kind === 'jester') {
    if (targetId === null) throw new EngineError('invalid-target', 'Choose one of your voters')
    return submitAction(state, playerId, targetId)
  }

  assertPhase(state, 'day', 'vote', 'night', 'dawn')
  const cleared: GameState = { ...state, pendingRevenge: null }
  if (targetId === null) return cleared
  if (!pending.options.includes(targetId) || !state.players.find((p) => p.id === targetId)?.alive) {
    throw new EngineError('invalid-target', 'You can’t take that player with you')
  }
  const after = eliminate(cleared, [targetId], 'revenge')
  const withEntry: GameState = {
    ...after,
    history: [...after.history, { kind: 'revenge', round: state.round, byId: playerId, targetId }],
  }
  return toFinale(state, withEntry)
}
