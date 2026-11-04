import type { GameState, NightActionKind, Player, PrivateResult, RoleDef, StoryBeat } from './types'
import { STEPS, STEP_OF, type Step } from './steps'
import { createRng } from './rng'
import { ROLES, detectiveSees } from '../roles'

// ---------- What a night is made of ----------

// One player's action tonight, after checking it's allowed.
export interface Action {
  actorId: string
  kind: NightActionKind
  targetId: string | null
}

// Someone actually arriving at someone else's house (what a Lookout sees).
export interface Visit {
  fromId: string
  toId: string
  kind: NightActionKind
}

export interface Attack {
  attackerId: string       // who actually visited (for the Mafia: the member carrying out the kill)
  targetId: string
  source: 'mafia' | 'role' // the Mafia's team kill, or a role's own kill
  unstoppable?: boolean    // protection can't stop it (execution, revenge)
}

// Everything worked out while a night resolves. Steps read and add to it in order.
export interface Night {
  state: GameState
  round: number
  alive: Player[]
  actions: Action[]
  decoys: Record<string, string | null>         // no ability tonight: who they suspect
  blocked: Set<string>                          // actors whose action fails tonight
  visits: Visit[]
  protectors: Map<string, string[]>             // target → who protected them
  attacks: Attack[]
  deaths: string[]
  saved: Set<string>                            // attacked but survived
  mafia: { killerIds: string[]; targetId: string | null; tieBroken: boolean; shooterId: string | null }
  messages: Map<string, PrivateResult[]>
  beats: StoryBeat[]
}

export function roleOf(player: Player | undefined): RoleDef | undefined {
  return player?.roleId ? ROLES[player.roleId] : undefined
}

export function isMafiaKiller(role: RoleDef | undefined): boolean {
  return role?.team === 'mafia' && role.night?.kind === 'kill' && role.night.sharedWithTeam === true
}

export function tell(night: Night, playerId: string, result: PrivateResult) {
  night.messages.get(playerId)?.push(result)
}

function playerById(night: Night, id: string): Player {
  return night.state.players.find((p) => p.id === id)!
}

// ---------- The Mafia's kill ----------

// The most-marked target wins; a tie is broken at random (reproducibly, from the seed).
// Then one living killer is picked to carry it out.
function chooseMafiaKill(night: Night) {
  const { state } = night
  const killers = night.alive.filter((p) => isMafiaKiller(roleOf(p)))
  const counts = new Map<string, number>()
  for (const k of killers) {
    const target = night.actions.find((a) => a.actorId === k.id)?.targetId
    if (target) counts.set(target, (counts.get(target) ?? 0) + 1)
  }

  let targetId: string | null = null
  let tieBroken = false
  if (counts.size > 0) {
    const most = Math.max(...counts.values())
    const tied = state.players.filter((p) => counts.get(p.id) === most).map((p) => p.id) // seat order
    if (tied.length === 1) targetId = tied[0]
    else {
      const rng = createRng(state.seed + state.round * 7919)
      targetId = tied[Math.floor(rng() * tied.length)]
      tieBroken = true
    }
  }

  const shooterRng = createRng(state.seed + state.round * 7919 + 1)
  const shooterId = targetId && killers.length > 0 ? killers[Math.floor(shooterRng() * killers.length)].id : null
  night.mafia = { killerIds: killers.map((k) => k.id), targetId, tieBroken, shooterId }
}

// ---------- Handlers: what each kind of action does in its step ----------

type Handler = (night: Night, action: Action) => void

const HANDLERS: Partial<Record<NightActionKind, Handler>> = {
  protect(night, { actorId, targetId }) {
    if (!targetId) return
    night.protectors.set(targetId, [...(night.protectors.get(targetId) ?? []), actorId])
    if (targetId !== actorId) night.visits.push({ fromId: actorId, toId: targetId, kind: 'protect' })
    night.beats.push({ kind: 'protected', medicId: actorId, targetId })
  },

  // Mafia killers act as one team, handled in runKills; other killers attack on their own.
  kill(night, { actorId, targetId }) {
    if (!targetId || isMafiaKiller(roleOf(playerById(night, actorId)))) return
    night.visits.push({ fromId: actorId, toId: targetId, kind: 'kill' })
    night.attacks.push({ attackerId: actorId, targetId, source: 'role' })
  },

  investigate(night, { actorId, targetId }) {
    if (!targetId) return
    night.visits.push({ fromId: actorId, toId: targetId, kind: 'investigate' })
    const result = detectiveSees(roleOf(playerById(night, targetId))!)
    night.beats.push({ kind: 'investigated', detectiveId: actorId, targetId, result })
    tell(night, actorId, { kind: 'investigated', round: night.round, targetId, result })
  },
}

// Step 6: the Mafia's kill, then every attack lands or is stopped.
function runKills(night: Night) {
  const { mafia } = night
  if (mafia.targetId && mafia.shooterId && !night.blocked.has(mafia.shooterId)) {
    night.visits.push({ fromId: mafia.shooterId, toId: mafia.targetId, kind: 'kill' })
    night.attacks.unshift({ attackerId: mafia.shooterId, targetId: mafia.targetId, source: 'mafia' })
  }

  for (const attack of night.attacks) {
    if (night.deaths.includes(attack.targetId)) continue
    const stopped = !attack.unstoppable && (night.protectors.get(attack.targetId)?.length ?? 0) > 0
    if (stopped) {
      night.saved.add(attack.targetId)
      night.beats.push({ kind: 'saved', targetId: attack.targetId })
    } else {
      night.deaths.push(attack.targetId)
      night.beats.push({ kind: 'killed', targetId: attack.targetId })
    }
  }
}

// Steps whose work isn't a simple per-action handler.
const STEP_RUNNERS: Partial<Record<Step, (night: Night) => void>> = {
  kill: runKills,
}

// ---------- Dawn messages ----------

// Every living player gets at least one private message. Investigations told theirs
// as they happened; everyone else hears about their night here.
function writeMessages(night: Night) {
  const { round } = night
  for (const player of night.alive) {
    const action = night.actions.find((a) => a.actorId === player.id)
    const pick = action ? action.targetId : (night.decoys[player.id] ?? null)
    const role = roleOf(player)
    const kind = action?.kind

    if (isMafiaKiller(role)) {
      tell(night, player.id, { kind: 'mafia-chose', round, targetId: night.mafia.targetId })
    } else if (kind === 'protect') {
      tell(night, player.id, !pick
        ? { kind: 'no-pick', round, action: 'protect' }
        : night.saved.has(pick)
          ? { kind: 'patient-saved', round, targetId: pick }
          : { kind: 'protected', round, targetId: pick })
    } else if (kind === 'investigate') {
      if (!pick) tell(night, player.id, { kind: 'no-pick', round, action: 'investigate' })
    } else if (action) {
      if (!pick) tell(night, player.id, { kind: 'no-pick', round, action: action.kind })
    } else {
      // No night power: the decoy "who do you suspect?" pick goes to the narrator only
      if (pick) night.beats.push({ kind: 'suspects', playerId: player.id, targetId: pick })
      tell(night, player.id, { kind: 'slept', round, suspectedId: pick })
    }

    if (!pick) night.beats.push({ kind: 'no-pick', playerId: player.id })
    if (night.saved.has(player.id)) tell(night, player.id, { kind: 'was-saved', round })
  }
}

// ---------- The whole night ----------

// Runs every step in order. Pure: takes the state and tonight's valid actions,
// returns what happened without changing anything.
export function runNight(state: GameState, actions: Action[], decoys: Record<string, string | null> = {}): Night {
  const alive = state.players.filter((p) => p.alive)
  const night: Night = {
    state,
    round: state.round,
    alive,
    actions,
    decoys,
    blocked: new Set(),
    visits: [],
    protectors: new Map(),
    attacks: [],
    deaths: [],
    saved: new Set(),
    mafia: { killerIds: [], targetId: null, tieBroken: false, shooterId: null },
    messages: new Map(alive.map((p) => [p.id, []])),
    beats: [],
  }

  // The Mafia's choice is settled first (it's just counting marks); it opens the story
  chooseMafiaKill(night)
  const { mafia } = night
  if (mafia.killerIds.length > 0) {
    night.beats.push({ kind: 'mafia-targeted', mafiaIds: mafia.killerIds, targetId: mafia.targetId, tieBroken: mafia.tieBroken })
  }

  for (const step of STEPS) {
    for (const action of actions) {
      if (STEP_OF[action.kind] !== step || night.blocked.has(action.actorId)) continue
      HANDLERS[action.kind]?.(night, action)
    }
    STEP_RUNNERS[step]?.(night)
  }

  writeMessages(night)
  return night
}
