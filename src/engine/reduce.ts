import type { Command, GameState } from './types'
import { EngineError } from './errors'
import { addPlayer, removePlayer, setRoleSlots } from './setup'
import { dealRoles } from './deal'
import { advancePhase } from './phases'
import { eliminate } from './eliminate'
import { submitAction, resolveNight, reveal } from './night'
import { castVote, closeVote, reopenVote, revealVote } from './vote'

// The one way to change a game: give it the current state and a command,
// get back the new state.
export function reduce(state: GameState, command: Command): GameState {
  switch (command.type) {
    case 'addPlayer':
      return addPlayer(state, command.id, command.name)
    case 'removePlayer':
      return removePlayer(state, command.id)
    case 'setRoleSlots':
      return setRoleSlots(state, command.slots)
    case 'deal':
      return dealRoles(state)
    case 'advance':
      return advancePhase(state)
    case 'eliminate': {
      // The narrator removing players by hand goes on the public record too
      const after = eliminate(state, command.playerIds, command.cause)
      const entry = { kind: 'narrator-eliminated', round: state.round, phase: state.phase, playerIds: command.playerIds } as const
      return { ...after, history: [...after.history, entry] }
    }
    case 'submitAction':
      return submitAction(state, command.playerId, command.targetId)
    case 'resolveNight':
      return resolveNight(state)
    case 'reveal':
      return reveal(state)
    case 'castVote':
      return castVote(state, command.playerId, command.targetId)
    case 'closeVote':
      return closeVote(state)
    case 'reopenVote':
      return reopenVote(state)
    case 'revealVote':
      return revealVote(state)
    default: {
      // If every command type is handled above, TypeScript knows this line can't be reached.
      const unhandled: never = command
      throw new EngineError('unknown-command', `Unknown command: ${JSON.stringify(unhandled)}`)
    }
  }
}

// Applies a list of commands in order. Handy for tests and, later, replays.
export function applyCommands(state: GameState, commands: readonly Command[]): GameState {
  return commands.reduce(reduce, state)
}