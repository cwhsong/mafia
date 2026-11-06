import type { DawnResult, GameState, NightActionKind, PrivateResult } from './types'
import { EngineError, assertNoRevenge, assertPhase } from './errors'
import { checkWin } from './win'
import { eliminate } from './eliminate'
import { enterPhase } from './phases'
import { toFinale } from './finale'
import { runNight, roleOf, maxUsesFor, type Action } from './resolve'

// What a player does at night. Roles without a night action (or who can't use it tonight)
// make a decoy "suspect" pick, so everyone at the table is tapping their phone.
// A Jester voted out takes 'revenge' the following night.
export type NightChoice = NightActionKind | 'suspect' | 'revenge'

function player(state: GameState, id: string) {
  return state.players.find((p) => p.id === id)
}

// Can this player use their night ability tonight?
function abilityReady(state: GameState, playerId: string): boolean {
  const ability = roleOf(player(state, playerId))?.night
  if (!ability) return false
  if (ability.fromNight && state.round < ability.fromNight) return false
  const max = maxUsesFor(ability, state)
  if (max !== undefined && (state.uses?.[playerId] ?? 0) >= max) return false
  if (state.guilt?.[playerId] === state.round) return false // overcome with guilt
  return true
}

function jesterRevenge(state: GameState, playerId: string) {
  const r = state.pendingRevenge
  return r?.kind === 'jester' && r.playerId === playerId && r.round === state.round ? r : null
}

export function nightChoice(state: GameState, playerId: string): NightChoice | null {
  const me = player(state, playerId)
  if (state.phase === 'night' && jesterRevenge(state, playerId)) return 'revenge'
  if (!me?.alive) return null
  const ability = roleOf(me)?.night
  if (!ability || ability.target === 'none' || !abilityReady(state, playerId)) return 'suspect'
  return ability.kind
}

// Who this player may pick tonight, in seat order.
export function eligibleTargets(state: GameState, playerId: string): string[] {
  const revenge = jesterRevenge(state, playerId)
  if (revenge) return revenge.options.filter((id) => player(state, id)?.alive)

  const me = player(state, playerId)
  if (!me?.alive) return []
  const living = state.players.filter((p) => p.alive)
  const others = living.filter((p) => p.id !== me.id)
  const role = roleOf(me)
  const ability = role?.night

  // No ability tonight: the decoy pick, anyone else
  if (!ability || ability.target === 'none' || !abilityReady(state, playerId)) return others.map((p) => p.id)

  let targets: string[]
  switch (ability.target) {
    case 'self':
      targets = [me.id]
      break
    case 'dead':
      targets = state.players.filter((p) => !p.alive).map((p) => p.id)
      break
    case 'any': {
      const usedSelf = state.selfTargets[me.id] ?? 0
      const mayPickSelf = usedSelf < (ability.selfUses ?? Infinity)
      targets = living.filter((p) => p.id !== me.id || mayPickSelf).map((p) => p.id)
      break
    }
    default:
      targets = others.map((p) => p.id)
  }

  // The Mafia never aim their abilities at each other
  if (role?.team === 'mafia') targets = targets.filter((id) => roleOf(player(state, id))?.team !== 'mafia')
  // Once revealed, the Mayor can't be protected
  if (ability.kind === 'protect' && state.mayorId) targets = targets.filter((id) => id !== state.mayorId)
  // No blackmailing the same person two days in a row
  if (ability.kind === 'blackmail') targets = targets.filter((id) => id !== state.lastBlackmail?.[me.id])
  return targets
}

// Extra choices this player can make with their pick tonight (empty if none).
export function nightOptions(state: GameState, playerId: string): string[] {
  const ability = roleOf(player(state, playerId))?.night
  if (!ability?.options || nightChoice(state, playerId) !== ability.kind) return []
  if (ability.optionUses !== undefined && (state.optionUses?.[playerId] ?? 0) >= ability.optionUses) return []
  return [...ability.options]
}

export function submitAction(state: GameState, playerId: string, targetId: string, option?: string): GameState {
  assertPhase(state, 'night')
  const me = player(state, playerId)
  if (!me) throw new EngineError('unknown-player', `No player with id ${playerId}`)
  if (!me.alive && !jesterRevenge(state, playerId)) throw new EngineError('not-alive', `${me.name} is out of the game`)
  if (!eligibleTargets(state, playerId).includes(targetId)) {
    throw new EngineError('invalid-target', `${me.name} can't pick that player tonight`)
  }
  if (option !== undefined && !nightOptions(state, playerId).includes(option)) {
    throw new EngineError('invalid-option', `${me.name} can't choose that tonight`)
  }
  const nightOpts = { ...(state.nightOptions ?? {}) }
  if (option === undefined) delete nightOpts[playerId]
  else nightOpts[playerId] = option
  return { ...state, nightPicks: { ...state.nightPicks, [playerId]: targetId }, nightOptions: nightOpts }
}

// Takes back tonight's pick (an alert or vest you've changed your mind about, for example).
export function clearAction(state: GameState, playerId: string): GameState {
  assertPhase(state, 'night')
  const nightPicks = { ...state.nightPicks }
  const nightOpts = { ...(state.nightOptions ?? {}) }
  delete nightPicks[playerId]
  delete nightOpts[playerId]
  return { ...state, nightPicks, nightOptions: nightOpts }
}

// Night → Dawn. Works out everything that happened, step by step (see steps.ts),
// without applying any deaths yet.
export function resolveNight(state: GameState): GameState {
  assertPhase(state, 'night')
  assertNoRevenge(state)
  const round = state.round
  const alive = state.players.filter((p) => p.alive)

  // Only picks that are still valid count
  const picks: Record<string, string> = {}
  for (const p of alive) {
    const target = state.nightPicks[p.id]
    if (target && eligibleTargets(state, p.id).includes(target)) picks[p.id] = target
  }
  const options = (id: string) => {
    const option = state.nightOptions?.[id]
    return option && nightOptions(state, id).includes(option) ? option : undefined
  }

  // One action per living player with an ability tonight; everyone else makes the decoy pick
  const actions: Action[] = []
  const decoys: Record<string, string | null> = {}
  for (const p of alive) {
    const choice = nightChoice(state, p.id)
    const ability = roleOf(p)?.night
    if (choice && choice !== 'suspect' && choice !== 'revenge') {
      const option = options(p.id)
      actions.push({ actorId: p.id, kind: choice, targetId: picks[p.id] ?? null, ...(option ? { option } : {}) })
    } else {
      decoys[p.id] = picks[p.id] ?? null
      // Passive abilities (Spy, Psychic) work on their own, alongside the decoy pick
      if (ability?.target === 'none' && abilityReady(state, p.id)) actions.push({ actorId: p.id, kind: ability.kind, targetId: null })
    }
  }

  const night = runNight(state, actions, decoys)

  // Counting: self-targets (the Medic's once-per-game self-protect), limited uses, options
  const selfTargets = { ...state.selfTargets }
  const uses = { ...(state.uses ?? {}) }
  const optionUses = { ...(state.optionUses ?? {}) }
  for (const a of actions) {
    if (!a.targetId) continue
    if (a.actorId === a.targetId) selfTargets[a.actorId] = (selfTargets[a.actorId] ?? 0) + 1
    const ability = roleOf(player(state, a.actorId))?.night
    if (ability && maxUsesFor(ability, state) !== undefined) uses[a.actorId] = (uses[a.actorId] ?? 0) + 1
    if (a.option && ability?.optionUses !== undefined) optionUses[a.actorId] = (optionUses[a.actorId] ?? 0) + 1
  }

  // A Vigilante who killed a Town member dies of guilt the next night
  const guilt = { ...(state.guilt ?? {}) }
  for (const a of actions) {
    if (a.kind !== 'kill' || roleOf(player(state, a.actorId))?.id !== 'vigilante') continue
    const hit = night.attacks.find((x) => x.attackerId === a.actorId && x.source === 'role')
    if (hit && night.deaths.includes(hit.targetId) && roleOf(player(state, hit.targetId))?.team === 'town') {
      guilt[a.actorId] = round + 1
    }
  }

  // Blackmail lasts the next day; remember who, so it can't repeat on the next night
  const lastBlackmail: Record<string, string> = {}
  for (const a of actions) if (a.kind === 'blackmail' && a.targetId && night.blackmailedId === a.targetId) lastBlackmail[a.actorId] = a.targetId

  const results: Record<string, PrivateResult[]> = { ...state.results }
  for (const [id, list] of night.messages) results[id] = [...(results[id] ?? []), ...list]

  // Would these deaths end the game? (Shown to the narrator only.)
  const afterDeaths: GameState = {
    ...state,
    players: state.players.map((p) => (night.deaths.includes(p.id) ? { ...p, alive: false } : p)),
  }
  const dawn: DawnResult = {
    round,
    deaths: night.deaths,
    beats: night.beats,
    picks,
    endsGame: checkWin(afterDeaths),
    roleChanges: night.roleChanges,
  }

  return {
    ...enterPhase(state, 'dawn', round),
    dawn,
    results,
    selfTargets,
    uses,
    optionUses,
    guilt,
    lastBlackmail,
    blackmailed: night.blackmailedId ? { playerId: night.blackmailedId, round: round + 1 } : null,
    pendingRevenge: state.pendingRevenge?.kind === 'jester' ? null : state.pendingRevenge,
  }
}

// Dawn → Day: the narrator reveals. Remembered roles take hold, deaths apply together,
// then the win check runs. The day opens straight onto discussion and voting.
export function reveal(state: GameState): GameState {
  assertPhase(state, 'dawn')
  const dawn = state.dawn
  if (!dawn) throw new EngineError('no-dawn', 'There is nothing to reveal yet')

  const changes = dawn.roleChanges ?? {}
  const remembered = Object.entries(changes).map(([, roleId]) => ({ kind: 'remembered', round: dawn.round, roleId }) as const)
  let withRoles: GameState = {
    ...state,
    players: state.players.map((p) => (changes[p.id] ? { ...p, roleId: changes[p.id] } : p)),
  }
  withRoles = assignNemesisTargets(withRoles)

  const afterDeaths = eliminate(withRoles, dawn.deaths, 'night')
  const withSummary: GameState = {
    ...afterDeaths,
    dawn: null,
    lastNight: { round: dawn.round, deaths: dawn.deaths },
    history: [...state.history, { kind: 'night', round: dawn.round, deaths: dawn.deaths }, ...remembered],
  }
  if (withSummary.phase === 'ended') return toFinale(state, withSummary)
  // From Day 2 on, discussion and voting share one phase
  return enterPhase(withSummary, 'vote', state.round + 1)
}

// Every Nemesis gets a random living Town player as their target (at the deal, or when an
// Amnesiac remembers being a Nemesis).
export function assignNemesisTargets(state: GameState): GameState {
  const nemesisTargets = { ...(state.nemesisTargets ?? {}) }
  let changed = false
  for (const p of state.players) {
    if (p.roleId !== 'nemesis' || nemesisTargets[p.id]) continue
    const town = state.players.filter((t) => t.alive && t.id !== p.id && roleOf(t)?.team === 'town')
    if (town.length === 0) continue
    let h = state.seed
    for (const ch of `nemesis|${p.id}`) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
    nemesisTargets[p.id] = town[Math.abs(h) % town.length].id
    changed = true
  }
  return changed ? { ...state, nemesisTargets } : state
}
