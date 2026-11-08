import type { GameState, Phase, PrivateResult, PublicEntry, Team } from './types'
import { SKIP } from './types'
import { ROLES } from '../roles'
import { eligibleTargets, nightChoice, nightOptions, type NightChoice } from './night'
import { maxUsesFor } from './resolve'
import { winnersOf } from './win'
import { withDefaults } from './defaults'
import { voteOptions } from './vote'

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

// A living player's night screen.
export interface NightView {
  choice: NightChoice
  targets: string[]          // who they may pick, in seat order
  myPick: string | null
  options: string[]          // extra choices with the pick (Hypnotist's fake message, Warden's 'execute')
  myOption: string | null
  usesLeft: number | null    // bullets, alerts, vests left; null = unlimited
  teamPicks: { playerId: string; name: string; targetId: string }[]  // Mafia only: the killers' kill picks, live
  teamActions: { playerId: string; name: string; roleId: string; targetId: string }[]  // Mafia only: teammates' ability picks
}

// The vote, which is public, as in pointing around the table.
export interface VoteView {
  closed: boolean            // closed: waiting for the narrator to reveal
  options: string[]          // who I may vote for (ends with ABSTAIN); empty if I'm out
  myVote: string | null
  votes: Record<string, string>  // voter id → target id or ABSTAIN
  notVoted: string[]         // living players who haven't voted (they count as Abstain)
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
  night: NightView | null          // only at night, only while alive
  messages: PrivateResult[]        // my private dawn messages, oldest first
  lastNight: { round: number; deaths: string[] } | null
  lastVote: { round: number; eliminatedId: string | null } | null
  vote: VoteView | null            // only during the vote
  history: PublicEntry[]           // the public record (deaths, votes)
  finale: { round: number; fromPhase: Phase } | null  // during the finale; the winner stays hidden
  mayorId: string | null           // the revealed Mayor, shown on every roster
  blackmailed: boolean             // you can't speak today
  nemesisTarget: string | null     // Nemesis only: the Town player to get voted out
  revenge: { kind: 'avenger' | 'jester'; options: string[] } | null  // your last act, while it's pending
  winners: string[] | null         // everyone who won, once the game has ended
}

// The narrator sees the whole game.
export interface NarratorView {
  kind: 'narrator'
  game: GameState
}

export function playerView(saved: GameState, playerId: string): PlayerView {
  const state = withDefaults(saved)
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

  const choice = state.phase === 'night' ? nightChoice(state, playerId) : null
  const ability = self?.roleId ? ROLES[self.roleId]?.night : undefined
  const max = ability && choice === ability.kind ? maxUsesFor(ability, state) : undefined
  const isKiller = (id: string) => {
    const r = ROLES[state.players.find((p) => p.id === id)?.roleId ?? '']
    return r?.night?.kind === 'kill' && r.night.sharedWithTeam === true
  }
  const night: NightView | null = choice
    ? {
        choice,
        targets: eligibleTargets(state, playerId),
        myPick: state.nightPicks[playerId] ?? null,
        options: nightOptions(state, playerId),
        myOption: state.nightOptions[playerId] ?? null,
        usesLeft: max === undefined ? null : max - (state.uses[playerId] ?? 0),
        teamPicks: teammates
          .filter((t) => t.alive && isKiller(t.id) && state.nightPicks[t.id] && state.nightPicks[t.id] !== SKIP)
          .map((t) => ({ playerId: t.id, name: t.name, targetId: state.nightPicks[t.id] })),
        teamActions: teammates
          .filter((t) => t.alive && !isKiller(t.id) && state.nightPicks[t.id] && state.nightPicks[t.id] !== SKIP)
          .map((t) => ({ playerId: t.id, name: t.name, roleId: t.roleId, targetId: state.nightPicks[t.id] })),
      }
    : null
  const revenge = state.pendingRevenge?.playerId === playerId && state.phase !== 'finale' && state.phase !== 'ended'
    ? { kind: state.pendingRevenge.kind, options: state.pendingRevenge.options.filter((id) => state.players.find((p) => p.id === id)?.alive) }
    : null

  const vote: VoteView | null =
    state.phase === 'vote'
      ? {
          closed: state.voteResult !== null,
          options: voteOptions(state, playerId),
          myVote: state.votes[playerId] ?? null,
          votes: { ...state.votes },
          notVoted: state.players.filter((p) => p.alive && !state.votes[p.id]).map((p) => p.id),
        }
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
    night,
    messages: [...(state.results[playerId] ?? [])],
    lastNight: state.lastNight,
    lastVote: state.lastVote,
    vote,
    history: [...state.history],
    finale: state.finale ? { round: state.finale.round, fromPhase: state.finale.fromPhase } : null,
    mayorId: state.mayorId,
    blackmailed: state.blackmailed?.playerId === playerId && state.blackmailed.round === state.round,
    nemesisTarget: self?.roleId === 'nemesis' ? (state.nemesisTargets[playerId] ?? null) : null,
    revenge,
    winners: state.phase === 'ended' ? winnersOf(state) : null,
  }
}

export function narratorView(state: GameState): NarratorView {
  return { kind: 'narrator', game: withDefaults(state) }
}
