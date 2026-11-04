import type { DawnResult, GameState, NightActionKind, PrivateResult } from './types'
import { EngineError, assertPhase } from './errors'
import { checkWin } from './win'
import { eliminate } from './eliminate'
import { enterPhase } from './phases'
import { toFinale } from './finale'
import { runNight, roleOf, isMafiaKiller, type Action } from './resolve'

// What a player does at night. Roles without a night action make a decoy "suspect" pick,
// so everyone at the table is tapping their phone.
export type NightChoice = NightActionKind | 'suspect'

export function nightChoice(state: GameState, playerId: string): NightChoice | null {
  const player = state.players.find((p) => p.id === playerId)
  if (!player?.alive) return null
  const ability = roleOf(player)?.night
  if (!ability || !abilityReady(state, playerId)) return 'suspect'
  return ability.kind
}

// Can this player use their night ability tonight? (Not before its first night, not when used up.)
function abilityReady(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId)
  const ability = roleOf(player)?.night
  if (!ability) return false
  if (ability.fromNight && state.round < ability.fromNight) return false
  if (ability.maxUses !== undefined && (state.uses?.[playerId] ?? 0) >= ability.maxUses) return false
  return true
}

// Who this player may pick tonight, in seat order.
export function eligibleTargets(state: GameState, playerId: string): string[] {
  const me = state.players.find((p) => p.id === playerId)
  if (!me?.alive) return []
  const living = state.players.filter((p) => p.alive)
  const others = living.filter((p) => p.id !== me.id)
  const ability = roleOf(me)?.night

  // No ability tonight: the decoy pick, anyone else
  if (!ability || !abilityReady(state, playerId)) return others.map((p) => p.id)

  switch (ability.target) {
    case 'none':
      return []
    case 'self':
      return [me.id]
    case 'dead':
      return state.players.filter((p) => !p.alive).map((p) => p.id)
    case 'any': {
      const usedSelf = state.selfTargets[me.id] ?? 0
      const mayPickSelf = usedSelf < (ability.selfUses ?? Infinity)
      return living.filter((p) => p.id !== me.id || mayPickSelf).map((p) => p.id)
    }
    case 'other':
      // The Mafia never aim their abilities at each other
      return (roleOf(me)?.team === 'mafia' ? others.filter((p) => roleOf(p)?.team !== 'mafia') : others).map((p) => p.id)
  }
}

export function submitAction(state: GameState, playerId: string, targetId: string): GameState {
  assertPhase(state, 'night')
  const player = state.players.find((p) => p.id === playerId)
  if (!player) throw new EngineError('unknown-player', `No player with id ${playerId}`)
  if (!player.alive) throw new EngineError('not-alive', `${player.name} is out of the game`)
  if (!eligibleTargets(state, playerId).includes(targetId)) {
    throw new EngineError('invalid-target', `${player.name} can't pick that player tonight`)
  }
  return { ...state, nightPicks: { ...state.nightPicks, [playerId]: targetId } }
}

// Night → Dawn. Works out everything that happened, step by step (see steps.ts),
// without applying any deaths yet.
export function resolveNight(state: GameState): GameState {
  assertPhase(state, 'night')
  const round = state.round
  const alive = state.players.filter((p) => p.alive)

  // Only picks that are still valid count
  const picks: Record<string, string> = {}
  for (const p of alive) {
    const target = state.nightPicks[p.id]
    if (target && eligibleTargets(state, p.id).includes(target)) picks[p.id] = target
  }

  // One action per living player; players with no ability tonight make the decoy pick
  const actions: Action[] = alive.flatMap((p) => {
    const choice = nightChoice(state, p.id)
    return choice && choice !== 'suspect' ? [{ actorId: p.id, kind: choice, targetId: picks[p.id] ?? null }] : []
  })
  const decoys: Record<string, string | null> = {}
  for (const p of alive) if (nightChoice(state, p.id) === 'suspect') decoys[p.id] = picks[p.id] ?? null

  const night = runNight(state, actions, decoys)

  // Self-targets count toward limits such as the Medic's once-per-game self-protect,
  // and limited abilities (the Vigilante's bullets) count each use.
  const selfTargets = { ...state.selfTargets }
  const uses = { ...(state.uses ?? {}) }
  for (const action of actions) {
    if (!action.targetId) continue
    if (action.actorId === action.targetId) selfTargets[action.actorId] = (selfTargets[action.actorId] ?? 0) + 1
    if (roleOf(state.players.find((p) => p.id === action.actorId))?.night?.maxUses !== undefined) {
      uses[action.actorId] = (uses[action.actorId] ?? 0) + 1
    }
  }

  const results: Record<string, PrivateResult[]> = { ...state.results }
  for (const [id, list] of night.messages) results[id] = [...(results[id] ?? []), ...list]

  // Would these deaths end the game? (Shown to the narrator only.)
  const afterDeaths: GameState = {
    ...state,
    players: state.players.map((p) => (night.deaths.includes(p.id) ? { ...p, alive: false } : p)),
  }
  const dawn: DawnResult = { round, deaths: night.deaths, beats: night.beats, picks, endsGame: checkWin(afterDeaths) }

  return { ...enterPhase(state, 'dawn', round), dawn, results, selfTargets, uses }
}

export { isMafiaKiller }

// Dawn → Day: the narrator reveals. Deaths apply together, then the win check runs.
// The day opens straight onto discussion and voting.
export function reveal(state: GameState): GameState {
  assertPhase(state, 'dawn')
  const dawn = state.dawn
  if (!dawn) throw new EngineError('no-dawn', 'There is nothing to reveal yet')

  const afterDeaths = eliminate(state, dawn.deaths, 'night')
  const withSummary: GameState = {
    ...afterDeaths,
    dawn: null,
    lastNight: { round: dawn.round, deaths: dawn.deaths },
    history: [...state.history, { kind: 'night', round: dawn.round, deaths: dawn.deaths }],
  }
  if (withSummary.phase === 'ended') return toFinale(state, withSummary)
  // From Day 2 on, discussion and voting share one phase
  return enterPhase(withSummary, 'vote', state.round + 1)
}
