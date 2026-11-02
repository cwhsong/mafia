import type { GameState, Team } from './types'
import { ROLES } from '../roles'

// Who has won right now, if anyone? Never changes the state.
export function checkWin(state: GameState): Team | null {
  const alive = state.players.filter((p) => p.alive)
  const mafiaAlive = alive.filter((p) => ROLES[p.roleId ?? '']?.team === 'mafia').length
  const othersAlive = alive.length - mafiaAlive

  if (mafiaAlive === 0) return 'town'
  if (mafiaAlive >= othersAlive) return 'mafia'
  return null
}

// town wins when no mafia alive
// mafia win at parity or greater
// add win conditions for neutral here