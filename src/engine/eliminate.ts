import type { DeathCause, GameEvent, GameState } from './types'
import { EngineError, assertPhase } from './errors'
import { checkWin } from './win'

// Marks one or more players dead at the same moment, then checks for a winner once.
export function eliminate(
  state: GameState,
  playerIds: readonly string[],
  cause: DeathCause,
): GameState {
  assertPhase(state, 'day', 'vote', 'night', 'dawn')

  // Check everything first, so either all deaths apply or none do
  const seen = new Set<string>()
  for (const id of playerIds) {
    const player = state.players.find((p) => p.id === id)
    if (!player) {
      throw new EngineError('unknown-player', `No player with id ${id}`)
    }
    if (!player.alive || seen.has(id)) {
      throw new EngineError('already-dead', `${player.name} is already dead`)
    }
    seen.add(id)
  }

  const players = state.players.map((p) => (seen.has(p.id) ? { ...p, alive: false } : p))
  const deathEvents: GameEvent[] = playerIds.map((playerId) => ({
    type: 'eliminated',
    playerId,
    cause,
  }))

  const afterDeaths: GameState = {
    ...state,
    players,
    log: [...state.log, ...deathEvents],
  }

  const winner = checkWin(afterDeaths)
  if (!winner) return afterDeaths

  return {
    ...afterDeaths,
    phase: 'ended',
    winner,
    log: [...afterDeaths.log, { type: 'game-over', winner }],
  }
}