import type {
  DawnResult,
  GameState,
  NightActionKind,
  Player,
  PrivateResult,
  RoleDef,
  StoryBeat,
} from './types'
import { EngineError, assertPhase } from './errors'
import { createRng } from './rng'
import { checkWin } from './win'
import { eliminate } from './eliminate'
import { enterPhase } from './phases'
import { ROLES, detectiveSees } from '../roles'

// What a player does at night. Roles without a night action make a decoy "suspect" pick,
// so everyone at the table is tapping their phone.
export type NightChoice = NightActionKind | 'suspect'

function roleOf(player: Player): RoleDef | undefined {
  return player.roleId ? ROLES[player.roleId] : undefined
}

function isMafiaKiller(role: RoleDef | undefined): boolean {
  return role?.team === 'mafia' && role.night?.kind === 'kill' && role.night.sharedWithTeam === true
}

export function nightChoice(state: GameState, playerId: string): NightChoice | null {
  const player = state.players.find((p) => p.id === playerId)
  if (!player?.alive) return null
  return roleOf(player)?.night?.kind ?? 'suspect'
}

// Who this player may pick tonight, in seat order.
export function eligibleTargets(state: GameState, playerId: string): string[] {
  const me = state.players.find((p) => p.id === playerId)
  if (!me?.alive) return []
  const role = roleOf(me)
  const others = state.players.filter((p) => p.alive && p.id !== me.id)

  switch (nightChoice(state, playerId)) {
    case 'kill':
      return (isMafiaKiller(role) ? others.filter((p) => roleOf(p)?.team !== 'mafia') : others).map((p) => p.id)
    case 'protect': {
      const night = role?.night
      const usedSelf = state.selfTargets[me.id] ?? 0
      const mayPickSelf = night?.canTargetSelf && usedSelf < (night.selfUses ?? Infinity)
      return state.players.filter((p) => p.alive && (p.id !== me.id || mayPickSelf)).map((p) => p.id)
    }
    default:
      return others.map((p) => p.id)
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

// The Mafia's kill: the most-picked target; a tie is broken at random (reproducibly, from the seed).
function mafiaTarget(state: GameState, mafia: Player[], picks: Record<string, string>) {
  const counts = new Map<string, number>()
  for (const m of mafia) {
    const target = picks[m.id]
    if (target) counts.set(target, (counts.get(target) ?? 0) + 1)
  }
  if (counts.size === 0) return { targetId: null, tieBroken: false }

  const most = Math.max(...counts.values())
  const tied = state.players.filter((p) => counts.get(p.id) === most).map((p) => p.id) // seat order
  if (tied.length === 1) return { targetId: tied[0], tieBroken: false }

  const rng = createRng(state.seed + state.round * 7919)
  return { targetId: tied[Math.floor(rng() * tied.length)], tieBroken: true }
}

// Night → Dawn. Works out everything that happened, in Town of Salem's order
// (protect, then kill, then investigate), without applying any deaths yet.
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

  const beats: StoryBeat[] = []
  const messages = new Map<string, PrivateResult[]>(alive.map((p) => [p.id, []]))
  const tell = (id: string, result: PrivateResult) => messages.get(id)?.push(result)

  // 1. Mafia choose
  const mafia = alive.filter((p) => isMafiaKiller(roleOf(p)))
  const { targetId: attacked, tieBroken } = mafiaTarget(state, mafia, picks)
  if (mafia.length > 0) {
    beats.push({ kind: 'mafia-targeted', mafiaIds: mafia.map((m) => m.id), targetId: attacked, tieBroken })
  }

  // 2. Protection
  const medics = alive.filter((p) => roleOf(p)?.night?.kind === 'protect' && picks[p.id])
  const protectedIds = new Set(medics.map((m) => picks[m.id]))
  for (const medic of medics) beats.push({ kind: 'protected', medicId: medic.id, targetId: picks[medic.id] })

  // 3. The attack
  const saved = attacked !== null && protectedIds.has(attacked)
  const deaths = attacked && !saved ? [attacked] : []
  if (attacked) beats.push(saved ? { kind: 'saved', targetId: attacked } : { kind: 'killed', targetId: attacked })

  // 4. Investigations, decoy picks, and everyone's private message
  for (const player of alive) {
    const pick = picks[player.id] ?? null
    const choice = nightChoice(state, player.id)

    if (choice === 'investigate') {
      if (pick) {
        const target = state.players.find((p) => p.id === pick)!
        const result = detectiveSees(roleOf(target)!)
        beats.push({ kind: 'investigated', detectiveId: player.id, targetId: pick, result })
        tell(player.id, { kind: 'investigated', round, targetId: pick, result })
      } else {
        tell(player.id, { kind: 'no-pick', round, action: 'investigate' })
      }
    } else if (choice === 'protect') {
      if (pick) {
        tell(player.id, pick === attacked
          ? { kind: 'patient-saved', round, targetId: pick }
          : { kind: 'protected', round, targetId: pick })
      } else {
        tell(player.id, { kind: 'no-pick', round, action: 'protect' })
      }
    } else if (isMafiaKiller(roleOf(player))) {
      tell(player.id, { kind: 'mafia-chose', round, targetId: attacked })
    } else {
      // Villagers (and, for now, roles whose night actions arrive in Phase 5)
      if (pick) beats.push({ kind: 'suspects', playerId: player.id, targetId: pick })
      tell(player.id, { kind: 'slept', round, suspectedId: pick })
    }

    if (!pick) beats.push({ kind: 'no-pick', playerId: player.id })
    if (saved && player.id === attacked) tell(player.id, { kind: 'was-saved', round })
  }

  // Self-targets count toward limits such as the Medic's once-per-game self-protect
  const selfTargets = { ...state.selfTargets }
  for (const [id, target] of Object.entries(picks)) {
    if (id === target) selfTargets[id] = (selfTargets[id] ?? 0) + 1
  }

  const results = { ...state.results }
  for (const [id, list] of messages) results[id] = [...(results[id] ?? []), ...list]

  // Would these deaths end the game? (Shown to the narrator only.)
  const afterDeaths: GameState = {
    ...state,
    players: state.players.map((p) => (deaths.includes(p.id) ? { ...p, alive: false } : p)),
  }
  const dawn: DawnResult = { round, deaths, beats, picks, endsGame: checkWin(afterDeaths) }

  return { ...enterPhase(state, 'dawn', round), dawn, results, selfTargets }
}

// Dawn → Day: the narrator reveals. Deaths apply together, then the win check runs.
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
  if (withSummary.phase === 'ended') return withSummary
  return enterPhase(withSummary, 'day', state.round + 1)
}
