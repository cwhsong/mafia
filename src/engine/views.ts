import type { GameState, Phase, Team } from './types'
import { ROLES } from '../roles'

// What everyone at the table may know about a player.
export interface PublicPlayer {
  id: string
  name: string
  seat: number
  alive: boolean
}

// A fellow Mafia member, shown only to other Mafia.
export interface Teammate {
  id: string
  name: string
  roleId: string
  alive: boolean
}

// Everything one player's phone is allowed to show.
export interface PlayerView {
  kind: 'player'
  phase: Phase
  round: number
  winner: Team | null
  players: PublicPlayer[]          // no roles in here, ever
  roleSlots: string[]              // the role list is public, as in Town of Salem
  me: (PublicPlayer & { roleId: string | null }) | null  // null if not in this game
  teammates: Teammate[]            // empty unless you are Mafia
  revealedRoles: Record<string, string> | null  // every role, only once the game has ended
}

// The narrator sees the whole game.
export interface NarratorView {
  kind: 'narrator'
  game: GameState
}

export function playerView(state: GameState, playerId: string): PlayerView {
  const players: PublicPlayer[] = state.players.map(({ id, name, seat, alive }) => ({
    id,
    name,
    seat,
    alive,
  }))

  const self = state.players.find((p) => p.id === playerId)
  const myTeam = self?.roleId ? ROLES[self.roleId]?.team : undefined

  const teammates: Teammate[] =
    myTeam === 'mafia'
      ? state.players
          .filter((p) => p.id !== playerId && p.roleId && ROLES[p.roleId]?.team === 'mafia')
          .map((p) => ({ id: p.id, name: p.name, roleId: p.roleId as string, alive: p.alive }))
      : []

  const revealedRoles =
    state.phase === 'ended'
      ? Object.fromEntries(state.players.map((p) => [p.id, p.roleId ?? '']))
      : null

  return {
    kind: 'player',
    phase: state.phase,
    round: state.round,
    winner: state.winner,
    players,
    roleSlots: [...state.roleSlots],
    me: self
      ? { id: self.id, name: self.name, seat: self.seat, alive: self.alive, roleId: self.roleId }
      : null,
    teammates,
    revealedRoles,
  }
}

export function narratorView(state: GameState): NarratorView {
  return { kind: 'narrator', game: state }
}
