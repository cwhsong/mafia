import { PLAYER_COMMANDS, type Command } from '../engine'

// A player may only send their own night pick or vote. Everything else is the narrator's.
export function playerMaySend(command: Command, playerId: string): boolean {
  return (
    (PLAYER_COMMANDS as readonly string[]).includes(command.type) &&
    'playerId' in command &&
    command.playerId === playerId
  )
}

export const NOT_ALLOWED = { code: 'not-allowed', message: 'Only the narrator can do that.' }
