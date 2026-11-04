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

// Everyone who won, once the game is over: the winning side, plus Neutrals who got what
// they wanted (a Survivor or Amnesiac still alive, a Jester or Nemesis whose plan worked).
export function winnersOf(state: GameState): string[] {
  if (!state.winner) return []
  const winner = state.winner
  return state.players
    .filter((p) => {
      const role = roleOf(p)
      if ((state.neutralWins ?? []).includes(p.id)) return true
      if (role?.team === 'neutral') {
        if (isHostileNeutral(role)) return winner === 'neutral' && p.alive
        return role.category === 'Neutral Benign' && p.alive
      }
      return role?.team === winner
    })
    .map((p) => p.id)
}
