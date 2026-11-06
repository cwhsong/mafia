import type {
  BeatAbility,
  FakeMessage,
  GameState,
  NightAbility,
  NightDeathCause,
  NightActionKind,
  Player,
  PrivateResult,
  RoleDef,
  StoryBeat,
} from './types'
import { SKIP } from './types'
import { NOT_A_VISIT, STEPS } from './steps'
import { createRng, shuffle } from './rng'
import { ROLES, ROLE_LIST, detectiveSees } from '../roles'

// ---------- What a night is made of ----------

// One player's action tonight, after checking it's allowed.
export interface Action {
  actorId: string
  kind: NightActionKind
  targetId: string | null
  option?: string           // the Hypnotist's fake message, the Warden's 'execute'
}

// Someone actually arriving at someone else's house (what a Lookout sees).
export interface Visit {
  fromId: string
  toId: string
  kind: NightActionKind
}

export interface Attack {
  attackerId: string        // who actually visited (for the Mafia: the member carrying out the kill)
  targetId: string
  source: 'mafia' | 'role' | 'veteran' | 'execute'
  unstoppable?: boolean     // protection can't stop it
}

// Everything worked out while a night resolves. Steps read and add to it in order.
export interface Night {
  state: GameState
  round: number
  alive: Player[]
  actions: Action[]
  decoys: Record<string, string | null>         // no ability tonight: who they suspect
  jailed: Set<string>
  distracted: Set<string>
  alerting: Set<string>                         // Veterans on alert
  redirects: Map<string, string>                // Serial Killer → the distractor they kill instead
  visits: Visit[]
  protectors: Map<string, string[]>             // target → who (or what) protects them
  guards: Map<string, string[]>                 // target → Bodyguards
  readAs: Map<string, string>                   // player → the role they read as tonight
  attacks: Attack[]
  deaths: string[]
  causes: Record<string, NightDeathCause>
  saved: Set<string>                            // attacked but survived
  fought: Set<string>                           // Bodyguards who stepped in
  mafia: { killerIds: string[]; targetId: string | null; tieBroken: boolean; shooterId: string | null }
  blackmailedId: string | null
  roleChanges: Record<string, string>
  messages: Map<string, PrivateResult[]>
  beats: StoryBeat[]
}

export function roleOf(player: Player | undefined): RoleDef | undefined {
  return player?.roleId ? ROLES[player.roleId] : undefined
}

export function isMafiaKiller(role: RoleDef | undefined): boolean {
  return role?.team === 'mafia' && role.night?.kind === 'kill' && role.night.sharedWithTeam === true
}

// How many times this ability may be used in this game (undefined = no limit).
export function maxUsesFor(ability: NightAbility, state: GameState): number | undefined {
  const max = ability.maxUses
  return typeof max === 'function' ? max(state.players.length) : max
}

export function tell(night: Night, playerId: string, result: PrivateResult) {
  if (!night.messages.has(playerId)) night.messages.set(playerId, [])
  night.messages.get(playerId)!.push(result)
}

function beat(night: Night, actorId: string, ability: BeatAbility, targetIds: string[], detail?: string) {
  night.beats.push(
    detail === undefined
      ? { kind: 'ability', actorId, ability, targetIds }
      : { kind: 'ability', actorId, ability, targetIds, detail },
  )
}

function playerById(night: Night, id: string): Player {
  return night.state.players.find((p) => p.id === id)!
}

const isBlocked = (night: Night, id: string) => night.jailed.has(id) || night.distracted.has(id)
const isMafia = (night: Night, id: string) => roleOf(playerById(night, id))?.team === 'mafia'

// The role someone reads as tonight (framed, disguised, or their own).
function readAs(night: Night, id: string): string {
  return night.readAs.get(id) ?? playerById(night, id).roleId!
}

function suspicious(roleId: string): boolean {
  return detectiveSees(ROLES[roleId]) === 'suspicious'
}

// A small reproducible random source for one purpose, so results never depend on
// the order things happen to be computed in.
function rngFor(state: GameState, ...parts: (string | number)[]) {
  let h = state.seed
  for (const ch of parts.join('|')) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
  return createRng(h)
}

// "Town Protective", from a role id
export function categoryOf(roleId: string): string {
  return ROLES[roleId]?.category ?? 'Town'
}

// ---------- The Mafia's kill ----------

// Only the killers (Godfather, Mafiosos) pick a kill. The Godfather's pick is final; otherwise
// the most-picked target wins, with a tie broken at random (reproducibly, from the seed).
// Then one living Mafioso is picked to carry it out.
function chooseMafiaKill(night: Night) {
  const { state } = night
  const mafia = night.alive.filter((p) => roleOf(p)?.team === 'mafia')
  const killers = mafia.filter((p) => isMafiaKiller(roleOf(p)))
  const markOf = (p: Player): string | null => night.actions.find((a) => a.actorId === p.id)?.targetId ?? null

  const godfather = mafia.find((p) => p.roleId === 'godfather')
  let targetId: string | null = godfather ? markOf(godfather) : null
  let tieBroken = false

  if (!targetId) {
    const counts = new Map<string, number>()
    for (const m of killers) {
      const target = markOf(m)
      if (target) counts.set(target, (counts.get(target) ?? 0) + 1)
    }
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
  }

  const mafiosos = killers.filter((p) => p.roleId !== 'godfather')
  const pool = mafiosos.length > 0 ? mafiosos : killers
  const shooterRng = createRng(state.seed + state.round * 7919 + 1)
  const shooterId = targetId && pool.length > 0 ? pool[Math.floor(shooterRng() * pool.length)].id : null
  night.mafia = { killerIds: killers.map((k) => k.id), targetId, tieBroken, shooterId }
}

// The member who actually carries out the kill tonight: the chosen Mafioso, or the
// Godfather if the Mafioso was stopped. Null if nobody can.
function mafiaShooter(night: Night): string | null {
  const { shooterId } = night.mafia
  if (!shooterId) return null
  if (!isBlocked(night, shooterId)) return shooterId
  const godfather = night.alive.find((p) => p.roleId === 'godfather' && p.id !== shooterId)
  return godfather && !isBlocked(night, godfather.id) ? godfather.id : null
}

// ---------- Investigation results ----------

// The Private Eye's three roles: the one the target reads as, plus two others from the deck.
// The same target (reading as the same role) always gives the same three.
function shortlist(night: Night, targetId: string): string[] {
  const truth = readAs(night, targetId)
  const others = [...new Set(night.state.roleSlots)].filter((id) => id !== truth)
  const fakes = shuffle(others, rngFor(night.state, 'shortlist', targetId, truth)).slice(0, 2)
  const order = ROLE_LIST.map((r) => r.id)
  return [truth, ...fakes].sort((a, b) => order.indexOf(a) - order.indexOf(b))
}

// The Psychic's vision: odd nights include someone suspicious, even nights someone who isn't.
function vision(night: Night, psychicId: string): { playerIds: string[]; evil: boolean } | null {
  const evil = night.round % 2 === 1
  const size = night.state.players.length < 9 ? 2 : 3
  const others = night.alive.filter((p) => p.id !== psychicId).map((p) => p.id)
  const rng = rngFor(night.state, 'vision', psychicId, night.round)
  const matching = shuffle(others.filter((id) => suspicious(readAs(night, id)) === evil), rng)
  if (matching.length === 0) return null
  const rest = shuffle(others.filter((id) => id !== matching[0]), rng).slice(0, size - 1)
  return { playerIds: shuffle([matching[0], ...rest], rng), evil }
}

// A random Mafia role from this game's deck for the Framer (never the Godfather,
// who reads as not suspicious anyway).
function frameRole(night: Night, targetId: string): string {
  const mafiaRoles = [...new Set(night.state.roleSlots)].filter((id) => ROLES[id]?.team === 'mafia' && id !== 'godfather')
  if (mafiaRoles.length === 0) return 'mafioso'
  return mafiaRoles[Math.floor(rngFor(night.state, 'frame', targetId, night.round)() * mafiaRoles.length)]
}

// ---------- Steps ----------

function addProtector(night: Night, targetId: string, byId: string) {
  night.protectors.set(targetId, [...(night.protectors.get(targetId) ?? []), byId])
}

// 1. The Warden locks someone up (and may execute them); Veterans go on alert.
function stepJail(night: Night) {
  for (const a of night.actions) {
    if (a.kind !== 'jail' || !a.targetId) continue
    night.jailed.add(a.targetId)
    addProtector(night, a.targetId, a.actorId)
    beat(night, a.actorId, 'jail', [a.targetId])
    if (a.option === 'execute') {
      night.attacks.push({ attackerId: a.actorId, targetId: a.targetId, source: 'execute', unstoppable: true })
      beat(night, a.actorId, 'execute', [a.targetId])
    }
  }
  for (const a of night.actions) {
    if (a.kind !== 'alert' || !a.targetId || night.jailed.has(a.actorId)) continue
    night.alerting.add(a.actorId)
    addProtector(night, a.actorId, a.actorId)
    beat(night, a.actorId, 'alert', [])
  }
}

// 2. Distractions land all at once, so two distractors can't cancel each other out.
function stepDistract(night: Night) {
  const landed = night.actions.filter((a) => a.kind === 'distract' && a.targetId && !night.jailed.has(a.actorId))
  for (const { actorId, targetId } of landed) {
    const target = targetId!
    tell(night, actorId, { kind: 'distracted-them', round: night.round, targetId: target })
    if (night.alerting.has(target)) {
      beat(night, actorId, 'distract', [target], 'alert')        // can't distract a Veteran on alert
    } else if (playerById(night, target).roleId === 'serial-killer') {
      night.redirects.set(target, actorId)                       // the Serial Killer kills them instead
      beat(night, actorId, 'distract', [target], 'killer')
    } else {
      night.distracted.add(target)
      beat(night, actorId, 'distract', [target])
    }
  }
}

// After jail and distractions we know who actually leaves their house tonight.
function recordVisits(night: Night) {
  const shooter = mafiaShooter(night)
  for (const a of night.actions) {
    if (!a.targetId || a.targetId === a.actorId || NOT_A_VISIT.has(a.kind) || isBlocked(night, a.actorId)) continue
    if (a.kind === 'kill' && isMafiaKiller(roleOf(playerById(night, a.actorId)))) continue
    const toId = a.kind === 'kill' ? (night.redirects.get(a.actorId) ?? a.targetId) : a.targetId
    night.visits.push({ fromId: a.actorId, toId, kind: a.kind })
  }
  if (shooter && night.mafia.targetId) night.visits.push({ fromId: shooter, toId: night.mafia.targetId, kind: 'kill' })
}

// 4. Medic, Bodyguard, vests.
function stepProtect(night: Night) {
  for (const a of night.actions) {
    if (!a.targetId || isBlocked(night, a.actorId)) continue
    if (a.kind === 'protect') {
      addProtector(night, a.targetId, a.actorId)
      night.beats.push({ kind: 'protected', medicId: a.actorId, targetId: a.targetId })
    } else if (a.kind === 'guard') {
      night.guards.set(a.targetId, [...(night.guards.get(a.targetId) ?? []), a.actorId])
      beat(night, a.actorId, 'guard', [a.targetId])
    } else if (a.kind === 'vest') {
      addProtector(night, a.actorId, a.actorId)
      beat(night, a.actorId, 'vest', [])
    }
  }
}

// 5. Framer and Impostor change how someone reads tonight.
function stepDisguise(night: Night) {
  for (const a of night.actions) {
    if (!a.targetId || isBlocked(night, a.actorId)) continue
    if (a.kind === 'frame') {
      night.readAs.set(a.targetId, frameRole(night, a.targetId))
      tell(night, a.actorId, { kind: 'framed', round: night.round, targetId: a.targetId })
      beat(night, a.actorId, 'frame', [a.targetId])
    } else if (a.kind === 'disguise') {
      const roleId = playerById(night, a.targetId).roleId!
      night.readAs.set(a.actorId, roleId)
      tell(night, a.actorId, { kind: 'disguised', round: night.round, targetId: a.targetId, roleId })
      beat(night, a.actorId, 'disguise', [a.targetId], roleId)
    }
  }
}

// 6. Every attack lands, or is stopped by a Bodyguard or protection.
function stepKill(night: Night) {
  const { round } = night
  const shooter = mafiaShooter(night)
  if (shooter && night.mafia.targetId) {
    night.attacks.push({ attackerId: shooter, targetId: night.mafia.targetId, source: 'mafia' })
    beat(night, shooter, 'kill', [night.mafia.targetId]) // who actually went (a Lookout sees them)
  } else if (night.mafia.targetId && night.mafia.shooterId) {
    beat(night, night.mafia.shooterId, 'blocked', [night.mafia.targetId]) // stopped, and nobody could go instead
  }
  // Killers acting alone (Vigilante, Serial Killer)
  for (const a of night.actions) {
    if (a.kind !== 'kill' || !a.targetId || isBlocked(night, a.actorId)) continue
    if (isMafiaKiller(roleOf(playerById(night, a.actorId)))) continue
    const targetId = night.redirects.get(a.actorId) ?? a.targetId
    if (targetId !== a.targetId) beat(night, a.actorId, 'redirect', [targetId])
    night.attacks.push({ attackerId: a.actorId, targetId, source: 'role' })
    tell(night, a.actorId, { kind: 'shot', round, targetId })
  }
  // A Veteran on alert shoots everyone who visits
  const shotBy = new Map<string, string[]>()
  for (const vet of night.alerting) {
    const visitors = [...new Set(night.visits.filter((v) => v.toId === vet && v.fromId !== vet).map((v) => v.fromId))]
    shotBy.set(vet, visitors)
    for (const id of visitors) night.attacks.push({ attackerId: vet, targetId: id, source: 'veteran' })
  }

  const usedGuards = new Set<string>()
  const isProtected = (id: string) => (night.protectors.get(id)?.length ?? 0) > 0
  const die = (id: string, cause: NightDeathCause) => {
    if (!night.deaths.includes(id)) {
      night.deaths.push(id)
      night.causes[id] = cause
    }
  }

  for (const attack of night.attacks) {
    const { targetId, attackerId } = attack
    if (night.deaths.includes(targetId)) continue
    const cause: NightDeathCause = { kind: attack.source, byId: attackerId }

    if (!attack.unstoppable) {
      // A Bodyguard steps in first
      const bodyguard =
        attack.source === 'mafia' || attack.source === 'role'
          ? night.guards.get(targetId)?.find((g) => !usedGuards.has(g) && g !== attackerId && !night.deaths.includes(g))
          : undefined
      if (bodyguard) {
        usedGuards.add(bodyguard)
        night.fought.add(bodyguard)
        night.saved.add(targetId)
        beat(night, bodyguard, 'intercept', [targetId, attackerId])
        if (isProtected(bodyguard)) night.saved.add(bodyguard)
        else die(bodyguard, { kind: 'guarding', byId: targetId })
        die(attackerId, { kind: 'bodyguard', byId: bodyguard })
        continue
      }
      if (isProtected(targetId)) {
        night.saved.add(targetId)
        night.beats.push({ kind: 'saved', targetId, cause })
        continue
      }
    }
    die(targetId, cause)
    night.beats.push({ kind: 'killed', targetId, cause })
  }

  for (const [vet, shot] of shotBy) tell(night, vet, { kind: 'alerted', round, shotIds: shot })
}

// 7. Investigations read everything that happened above.
function stepInvestigate(night: Night) {
  const { round } = night
  for (const a of night.actions) {
    if (isBlocked(night, a.actorId)) continue
    const t = a.targetId
    switch (a.kind) {
      case 'investigate': {
        if (!t) break
        const result = detectiveSees(ROLES[readAs(night, t)])
        night.beats.push({ kind: 'investigated', detectiveId: a.actorId, targetId: t, result })
        tell(night, a.actorId, { kind: 'investigated', round, targetId: t, result })
        break
      }
      case 'shortlist': {
        if (!t) break
        const roleIds = shortlist(night, t)
        tell(night, a.actorId, { kind: 'shortlist', round, targetId: t, roleIds })
        beat(night, a.actorId, 'shortlist', [t], roleIds.map((id) => ROLES[id]?.name).join(', '))
        break
      }
      case 'watch': {
        if (!t) break
        const visitorIds = [...new Set(night.visits.filter((v) => v.toId === t && v.fromId !== a.actorId).map((v) => v.fromId))]
        tell(night, a.actorId, { kind: 'watched', round, targetId: t, visitorIds })
        beat(night, a.actorId, 'watch', [t, ...visitorIds])
        break
      }
      case 'follow': {
        if (!t) break
        const visitedIds = [...new Set(night.visits.filter((v) => v.fromId === t).map((v) => v.toId))]
        tell(night, a.actorId, { kind: 'followed', round, targetId: t, visitedIds })
        beat(night, a.actorId, 'follow', [t, ...visitedIds])
        break
      }
      case 'examine': {
        if (!t) break
        const roleId = playerById(night, t).roleId!
        tell(night, a.actorId, { kind: 'examined', round, targetId: t, roleId })
        beat(night, a.actorId, 'examine', [t], roleId)
        break
      }
      case 'spy': {
        const targetIds = [...new Set(night.visits.filter((v) => isMafia(night, v.fromId)).map((v) => v.toId))]
        tell(night, a.actorId, { kind: 'spied', round, targetIds })
        beat(night, a.actorId, 'spy', targetIds)
        break
      }
      case 'vision': {
        const seen = vision(night, a.actorId)
        if (seen) {
          tell(night, a.actorId, { kind: 'vision', round, ...seen })
          beat(night, a.actorId, 'vision', seen.playerIds, seen.evil ? 'evil' : 'good')
        }
        break
      }
      case 'categorize': {
        if (!t) break
        const category = categoryOf(readAs(night, t))
        // No team chat in person, so every Mafia phone gets the result
        for (const m of night.alive.filter((p) => roleOf(p)?.team === 'mafia')) {
          tell(night, m.id, { kind: 'categorized', round, targetId: t, category, byId: a.actorId })
        }
        beat(night, a.actorId, 'categorize', [t], category)
        break
      }
      case 'blackmail': {
        if (!t) break
        night.blackmailedId = t
        tell(night, a.actorId, { kind: 'blackmailed-them', round, targetId: t })
        tell(night, t, { kind: 'blackmailed', round })
        beat(night, a.actorId, 'blackmail', [t])
        break
      }
      default:
        break
    }
  }
}

// 9. Guilt, the Jester's revenge, and the Amnesiac remembering.
function stepAftermath(night: Night) {
  const { state, round } = night
  for (const p of night.alive) {
    if (state.guilt?.[p.id] === round && !night.deaths.includes(p.id)) {
      night.deaths.push(p.id)
      night.causes[p.id] = { kind: 'guilt', byId: null }
      tell(night, p.id, { kind: 'guilt', round })
      beat(night, p.id, 'guilt', [])
    }
  }

  const revenge = state.pendingRevenge
  if (revenge?.kind === 'jester' && revenge.round === round) {
    const living = revenge.options.filter((id) => night.alive.some((p) => p.id === id) && !night.deaths.includes(id))
    const chosen = state.nightPicks[revenge.playerId]
    const targetId = living.includes(chosen)
      ? chosen
      : living.length > 0
        ? living[Math.floor(rngFor(state, 'jester', round)() * living.length)]
        : null
    if (targetId) {
      night.deaths.push(targetId)
      night.causes[targetId] = { kind: 'revenge', byId: revenge.playerId }
      tell(night, revenge.playerId, { kind: 'revenge', round, targetId })
      beat(night, revenge.playerId, 'revenge', [targetId])
    }
  }

  for (const a of night.actions) {
    if (a.kind !== 'remember' || !a.targetId || isBlocked(night, a.actorId)) continue
    const roleId = playerById(night, a.targetId).roleId!
    night.roleChanges[a.actorId] = roleId
    tell(night, a.actorId, { kind: 'remembered', round, roleId })
    beat(night, a.actorId, 'remember', [a.targetId], roleId)
  }
}

// ---------- Dawn messages ----------

// Every living player gets at least one private message. Steps already told players
// most results; this adds the rest, and puts each player's messages in reading order.
function writeMessages(night: Night) {
  const { round } = night
  for (const player of night.alive) {
    const action = night.actions.find((a) => a.actorId === player.id)
    const pick = action ? action.targetId : (night.decoys[player.id] ?? null)
    const role = roleOf(player)
    const passive = role?.night?.target === 'none'
    const fromSteps = night.messages.get(player.id) ?? []
    const first: PrivateResult[] = []   // the Mafia's choice, or what stopped you
    const last: PrivateResult[] = []    // what you did (if it wasn't told already), what happened to you

    if (role?.team === 'mafia') first.push({ kind: 'mafia-chose', round, targetId: night.mafia.targetId })

    const blocked = night.jailed.has(player.id) || night.distracted.has(player.id)
    const skipped = night.state.nightPicks[player.id] === SKIP
    if (night.jailed.has(player.id)) first.push({ kind: 'locked-up', round })
    else if (night.distracted.has(player.id)) first.push({ kind: 'distracted', round })
    else if (action && !passive) {
      if (!pick) {
        if (skipped) last.push({ kind: 'skipped', round, action: action.kind })
        else if (!isMafiaKiller(role)) last.push({ kind: 'no-pick', round, action: action.kind })
      }
      else if (action.kind === 'protect') {
        last.push(night.saved.has(pick) ? { kind: 'patient-saved', round, targetId: pick } : { kind: 'protected', round, targetId: pick })
      } else if (action.kind === 'guard') {
        last.push({ kind: 'guarded', round, targetId: pick, fought: night.fought.has(player.id) })
      } else if (action.kind === 'jail') {
        last.push({ kind: 'jailed', round, targetId: pick, executedRole: action.option === 'execute' ? playerById(night, pick).roleId : null })
      } else if (action.kind === 'vest') {
        const max = maxUsesFor(role!.night!, night.state) ?? 0
        last.push({ kind: 'vest', round, left: max - (night.state.uses?.[player.id] ?? 0) - 1 })
      }
    } else if (!action && role?.team !== 'mafia') {
      // No night power tonight: the decoy "who do you suspect?" pick goes to the narrator only
      last.push({ kind: 'slept', round, suspectedId: pick })
    }

    if ((passive || !action) && pick) night.beats.push({ kind: 'suspects', playerId: player.id, targetId: pick })
    if (!pick && !passive && !blocked) night.beats.push(skipped ? { kind: 'skipped', playerId: player.id } : { kind: 'no-pick', playerId: player.id })
    if (night.saved.has(player.id) && !night.alerting.has(player.id)) last.push({ kind: 'was-saved', round })

    // A blocked player hears only what was done to them and what their team learned
    const told = blocked ? fromSteps.filter(keepWhenBlocked) : fromSteps
    const messages = [...first, ...told, ...last]
    // Someone with nothing to report still gets a line, so nobody stands out
    night.messages.set(player.id, messages.length > 0 ? messages : [{ kind: 'slept', round, suspectedId: null }])
  }
}

function keepWhenBlocked(m: PrivateResult) {
  return m.kind === 'blackmailed' || m.kind === 'categorized' || m.kind === 'guilt' || m.kind === 'distracted-them'
}

// 8. The Hypnotist's fake message replaces everything the target would have heard.
function fakeMessage(fake: FakeMessage, round: number): PrivateResult {
  switch (fake) {
    case 'protected': return { kind: 'watched-over', round }
    case 'attacked': return { kind: 'was-saved', round }
    case 'distracted': return { kind: 'distracted', round }
    case 'locked-up': return { kind: 'locked-up', round }
    case 'quiet': return { kind: 'slept', round, suspectedId: null }
  }
}

function stepMemory(night: Night) {
  writeMessages(night) // every message exists before the Hypnotist rewrites one
  for (const a of night.actions) {
    if (a.kind !== 'hypnotize' || !a.targetId || isBlocked(night, a.actorId)) continue
    const fake = (a.option ?? 'quiet') as FakeMessage
    night.messages.set(a.targetId, [fakeMessage(fake, night.round)])
    tell(night, a.actorId, { kind: 'hypnotized', round: night.round, targetId: a.targetId, fake })
    beat(night, a.actorId, 'hypnotize', [a.targetId], fake)
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
    jailed: new Set(),
    distracted: new Set(),
    alerting: new Set(),
    redirects: new Map(),
    visits: [],
    protectors: new Map(),
    guards: new Map(),
    readAs: new Map(),
    attacks: [],
    deaths: [],
    causes: {},
    saved: new Set(),
    fought: new Set(),
    mafia: { killerIds: [], targetId: null, tieBroken: false, shooterId: null },
    blackmailedId: null,
    roleChanges: {},
    messages: new Map(alive.map((p) => [p.id, []])),
    beats: [],
  }

  // The Mafia's choice is settled first (it's just counting marks); it opens the story
  chooseMafiaKill(night)
  const { mafia } = night
  if (mafia.killerIds.length > 0) {
    night.beats.push({ kind: 'mafia-targeted', mafiaIds: mafia.killerIds, targetId: mafia.targetId, tieBroken: mafia.tieBroken })
  }

  const RUN: Record<(typeof STEPS)[number], (night: Night) => void> = {
    jail: stepJail,
    distract: (n) => {
      stepDistract(n)
      recordVisits(n)
    },
    swap: () => {},
    protect: stepProtect,
    disguise: stepDisguise,
    kill: stepKill,
    investigate: stepInvestigate,
    memory: () => {},
    aftermath: (n) => {
      stepAftermath(n)
      stepMemory(n)
    },
  }
  for (const step of STEPS) RUN[step](night)
  return night
}
