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