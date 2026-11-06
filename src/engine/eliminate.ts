import type { DeathCause, GameEvent, GameState, PrivateResult } from './types'
import { EngineError, assertPhase } from './errors'
import { checkWin } from './win'
import { createRng } from './rng'
import { ROLES } from '../roles'

// Marks one or more players dead at the same moment, then checks for a winner once.
// Deaths can set off other roles: a Nemesis whose target dies another way becomes a
// Jester, a Jester voted out wins and gets revenge, an Avenger takes someone with them.
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

  const deathEvents: GameEvent[] = playerIds.map((playerId) => ({ type: 'eliminated', playerId, cause }))
  let next: GameState = {
    ...state,
    players: state.players.map((p) => (seen.has(p.id) ? { ...p, alive: false } : p)),
    log: [...state.log, ...deathEvents],
  }
  next = afterDeaths(next, [...seen], cause)

  const winner = checkWin(next)
  if (!winner) return next

  return {
    ...next,
    phase: 'ended',
    winner,
    pendingRevenge: null,
    log: [...next.log, { type: 'game-over', winner }],
  }
}

function afterDeaths(state: GameState, dead: string[], cause: DeathCause): GameState {
  const round = state.round
  const neutralWins = [...(state.neutralWins ?? [])]
  const results = { ...state.results }
  const tellPlayer = (id: string, result: PrivateResult) => (results[id] = [...(results[id] ?? []), result])
  let players = state.players
  let pendingRevenge = state.pendingRevenge ?? null

  for (const id of dead) {
    const roleId = state.players.find((p) => p.id === id)?.roleId

    // A Jester voted out wins, and takes one of their voters with them the next night
    if (roleId === 'jester' && cause === 'vote') {
      if (!neutralWins.includes(id)) neutralWins.push(id)
      const voters = state.players.filter((p) => p.alive && p.id !== id && state.votes[p.id] === id).map((p) => p.id)
      if (voters.length > 0) pendingRevenge = { kind: 'jester', playerId: id, options: voters, round }
    }

    // An Avenger chooses someone to take down with them (or lets it go)
    if (roleId === 'avenger') {
      const options = players.filter((p) => p.alive && p.id !== id).map((p) => p.id)
      if (options.length > 0) pendingRevenge = { kind: 'avenger', playerId: id, options, round }
    }

    // A Nemesis's target is gone: voted out is a win; any other death turns them into a Jester
    for (const [nemesisId, targetId] of Object.entries(state.nemesisTargets ?? {})) {
      const nemesis = players.find((p) => p.id === nemesisId)
      if (targetId !== id || nemesis?.roleId !== 'nemesis') continue
      if (cause === 'vote') {
        if (!neutralWins.includes(nemesisId)) neutralWins.push(nemesisId)
      } else if (nemesis.alive) {
        players = players.map((p) => (p.id === nemesisId ? { ...p, roleId: 'jester' } : p))
        tellPlayer(nemesisId, { kind: 'became-jester', round })
      }
    }
  }

  // With every Mafia killer gone, a random living member becomes a Mafioso and loses their old ability
  const isKiller = (roleId: string | null) => {
    const role = roleId ? ROLES[roleId] : undefined
    return role?.team === 'mafia' && role.night?.kind === 'kill' && role.night.sharedWithTeam === true
  }
  const family = players.filter((p) => p.alive && p.roleId && ROLES[p.roleId]?.team === 'mafia')
  if (family.length > 0 && !family.some((p) => isKiller(p.roleId))) {
    let h = state.seed
    for (const ch of `promote|${round}|${dead.join(',')}`) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
    const chosen = family[Math.floor(createRng(h)() * family.length)]
    players = players.map((p) => (p.id === chosen.id ? { ...p, roleId: 'mafioso' } : p))
    tellPlayer(chosen.id, { kind: 'became-mafioso', round })
  }

  return { ...state, players, neutralWins, results, pendingRevenge }
}
