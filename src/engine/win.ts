import type { GameState, Player, RoleDef, Team } from './types'
import { ROLES } from '../roles'

function roleOf(p: Player): RoleDef | undefined {
  return p.roleId ? ROLES[p.roleId] : undefined
}

// Neutral Killing and Chaos roles stand between the Town and its win; Benign and Evil don't.
export function isHostileNeutral(role: RoleDef | undefined): boolean {
  return role?.team === 'neutral' && (role.category === 'Neutral Killing' || role.category === 'Neutral Chaos')
}

// Who has won right now, if anyone? Never changes the state.
//   Town:    no Mafia and no hostile Neutrals left
//   Mafia:   match or outnumber everyone else, with no hostile Neutral alive
//   Neutral: a lone killer is the last threat standing (alone, or facing one other player)
// Benign and Evil Neutrals (Survivor, Jester…) never decide the game; they win alongside.
export function checkWin(state: GameState): Team | null {
  const alive = state.players.filter((p) => p.alive)
  const mafia = alive.filter((p) => roleOf(p)?.team === 'mafia').length
  const hostile = alive.filter((p) => isHostileNeutral(roleOf(p))).length
  const bystanders = alive.filter((p) => roleOf(p)?.team === 'neutral' && !isHostileNeutral(roleOf(p))).length
  const contenders = alive.length - bystanders

  if (mafia === 0 && hostile === 0) return 'town'
  if (hostile === 0 && mafia >= alive.length - mafia) return 'mafia'
  if (hostile === 1 && contenders <= 2) return 'neutral'
  return null
}
