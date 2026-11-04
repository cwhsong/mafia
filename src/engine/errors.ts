import type { GameState, Phase } from './types'

export type EngineErrorCode =
  | 'wrong-phase'
  | 'empty-name'
  | 'duplicate-id'
  | 'duplicate-name'
  | 'too-many-players'
  | 'unknown-player'
  | 'unknown-role'
  | 'role-unavailable'
  | 'invalid-setup'
  | 'already-dead'
  | 'unknown-command'
  | 'not-alive'
  | 'invalid-target'
  | 'no-dawn'
  | 'vote-closed'
  | 'vote-not-closed'
  | 'revenge-pending'
  | 'invalid-option'
  | 'not-allowed'

export class EngineError extends Error {
  code: EngineErrorCode

  constructor(code: EngineErrorCode, message: string) {
    super(message)
    this.name = 'EngineError'
    this.code = code
  }
}

// Throws unless the game is in one of the allowed phases.
export function assertPhase(state: GameState, ...allowed: Phase[]): void {
  if (!allowed.includes(state.phase)) {
    throw new EngineError(
      'wrong-phase',
      `Not allowed during ${state.phase} (needs ${allowed.join(' or ')})`,
    )
  }
}
// Throws while an Avenger is choosing who to take with them; the game waits for them.
export function assertNoRevenge(state: GameState): void {
  if (state.pendingRevenge?.kind === 'avenger') {
    throw new EngineError('revenge-pending', 'Waiting for the Avenger to choose')
  }
}
