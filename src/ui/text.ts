import type { FakeMessage, NightChoice, NightDeathCause, PlayerView, PrivateResult, PublicEntry, StoryBeat, Team } from '../engine'
import { ROLES } from '../roles'

const roleName = (id: string) => ROLES[id]?.name ?? id

// Everything the screens say about night actions, messages and story beats lives here,
// so the wording stays consistent and can be tested.

type NameOf = (id: string | null | undefined) => string

// "Ana", "Ana and Ben", "Ana, Ben, Cal"
export function joinNames(names: string[]): string {
  if (names.length <= 2) return names.join(' and ')
  return names.join(', ')
}

// Shown at dawn to players with nothing to report, so nobody stands out by reading
// nothing. It changes from night to night, and it never goes in the log.
export const QUIET_NIGHT = [
  'A quiet night for you.',
  'You slept through the night.',
  'The night passed in silence.',
  'Nothing stirred near you tonight.',
]

// The verb on the confirm button: "Confirm: protect Ana"
export const ACTION_VERB: Record<NightChoice, string> = {
  kill: 'kill',
  protect: 'protect',
  investigate: 'investigate',
  suspect: 'suspect',
  revenge: 'take',
  shortlist: 'investigate',
  watch: 'watch',
  follow: 'follow',
  examine: 'examine',
  spy: 'suspect',
  vision: 'suspect',
  categorize: 'investigate',
  guard: 'guard',
  jail: 'lock up',
  alert: 'go on alert',
  distract: 'distract',
  vest: 'wear a vest',
  blackmail: 'blackmail',
  frame: 'frame',
  disguise: 'copy',
  hypnotize: 'hypnotize',
  remember: 'remember',
}

export function nightSubtext(choice: NightChoice): string {
  switch (choice) {
    case 'kill': return 'Choose who to kill.'
    case 'protect': return 'Choose who to protect tonight.'
    case 'investigate': return 'Choose who to investigate.'
    case 'suspect': return 'Who do you suspect? Nobody sees your answer.'
    case 'revenge': return 'You were voted out. Choose one of the people who voted for you to take with you.'
    case 'shortlist': return 'Choose who to investigate. You’ll learn three roles they could be.'
    case 'watch': return 'Choose whose house to watch.'
    case 'follow': return 'Choose who to follow.'
    case 'examine': return 'Choose a dead player to examine.'
    case 'spy': return 'Who do you suspect? Nobody sees your answer.'
    case 'vision': return 'Who do you suspect? Nobody sees your answer.'
    case 'categorize': return 'Choose who to look into for the family.'
    case 'guard': return 'Choose who to guard tonight.'
    case 'jail': return 'Choose who to lock up tonight.'
    case 'alert': return 'Go on alert tonight, or stay home.'
    case 'distract': return 'Choose who to distract tonight.'
    case 'vest': return 'Wear a vest tonight, or save it.'
    case 'blackmail': return 'Choose who to blackmail.'
    case 'frame': return 'Choose who to frame.'
    case 'disguise': return 'Choose whose role to copy tonight.'
    case 'hypnotize': return 'Choose who to hypnotize, then the memory to plant.'
    case 'remember': return 'You can remember who you were. Choose a dead player, or wait.'
  }
}

export const FAKE_LABEL: Record<FakeMessage, string> = {
  protected: 'Someone watched over them',
  attacked: 'They were attacked but survived',
  distracted: 'They were distracted',
  'locked-up': 'They were locked up',
  quiet: 'A quiet night',
}

// A player's private dawn message.
export function messageText(result: PrivateResult, nameOf: NameOf): string {
  switch (result.kind) {
    case 'investigated':
      return result.result === 'suspicious'
        ? `${nameOf(result.targetId)} is suspicious.`
        : `${nameOf(result.targetId)} is not suspicious.`
    case 'patient-saved':
      return `Your patient, ${nameOf(result.targetId)}, was attacked, and you saved them.`
    case 'protected':
      return `You protected ${nameOf(result.targetId)}. Nobody attacked them.`
    case 'was-saved':
      return 'You were attacked last night, but someone saved you.'
    case 'mafia-chose':
      return result.targetId ? `The Mafia chose ${nameOf(result.targetId)}.` : 'The Mafia didn’t choose anyone.'
    case 'slept':
      return QUIET_NIGHT[(result.round - 1) % QUIET_NIGHT.length]
    case 'skipped':
      return result.action === 'alert' || result.action === 'vest' ? 'You stayed home tonight.' : 'You chose not to act tonight.'
    case 'no-pick':
      return result.action === 'protect'
        ? 'You didn’t protect anyone.'
        : result.action === 'investigate'
          ? 'You didn’t investigate anyone.'
          : result.action === 'alert'
            ? 'You stayed home.'
            : result.action === 'vest'
              ? 'You saved your vest.'
              : result.action === 'remember'
                ? 'You didn’t try to remember.'
                : 'You didn’t choose anyone.'
    case 'shortlist': {
      const names = result.roleIds.map(roleName)
      const options = names.length > 1 ? `${names.slice(0, -1).join(', ')}${names.length > 2 ? ',' : ''} or ${names[names.length - 1]}` : names[0]
      return `${nameOf(result.targetId)} is the ${options}.`
    }
    case 'watched':
      return result.visitorIds.length > 0
        ? `${joinNames(result.visitorIds.map(nameOf))} visited ${nameOf(result.targetId)}.`
        : `Nobody visited ${nameOf(result.targetId)}.`
    case 'followed':
      return result.visitedIds.length > 0
        ? `${nameOf(result.targetId)} visited ${joinNames(result.visitedIds.map(nameOf))}.`
        : `${nameOf(result.targetId)} stayed home.`
    case 'examined':
      return `${nameOf(result.targetId)} was the ${roleName(result.roleId)}.`
    case 'spied':
      return result.targetIds.length > 0
        ? `The Mafia visited ${joinNames(result.targetIds.map(nameOf))}.`
        : 'The Mafia visited nobody.'
    case 'vision':
      return result.evil
        ? `A vision: one of ${joinNames(result.playerIds.map(nameOf))} is suspicious.`
        : `A vision: one of ${joinNames(result.playerIds.map(nameOf))} is not suspicious.`
    case 'categorized':
      return `${nameOf(result.targetId)} is ${result.category}.`
    case 'guarded':
      return result.fought
        ? `You guarded ${nameOf(result.targetId)} and fought off their attacker.`
        : `You guarded ${nameOf(result.targetId)}. Nobody attacked them.`
    case 'jailed':
      return result.executedRole
        ? `You executed ${nameOf(result.targetId)}. They were the ${roleName(result.executedRole)}.`
        : `You locked up ${nameOf(result.targetId)}.`
    case 'alerted':
      return result.shotIds.length > 0
        ? `You went on alert and shot ${joinNames(result.shotIds.map(nameOf))}.`
        : 'You went on alert. Nobody came.'
    case 'distracted-them':
      return `You distracted ${nameOf(result.targetId)}.`
    case 'vest':
      return `You wore a vest. ${result.left === 1 ? '1 vest left.' : `${result.left} vests left.`}`
    case 'shot':
      return `You attacked ${nameOf(result.targetId)}.`
    case 'blackmailed-them':
      return `You blackmailed ${nameOf(result.targetId)}.`
    case 'framed':
      return `You framed ${nameOf(result.targetId)}.`
    case 'disguised':
      return `You copied ${nameOf(result.targetId)}: you read as the ${roleName(result.roleId)} tonight.`
    case 'hypnotized':
      return `You hypnotized ${nameOf(result.targetId)}: “${FAKE_LABEL[result.fake]}.”`
    case 'remembered':
      return `You remembered: you are the ${roleName(result.roleId)}.`
    case 'revenge':
      return `You took ${nameOf(result.targetId)} with you.`
    case 'locked-up':
      return 'You were locked up last night.'
    case 'distracted':
      return 'You were distracted last night.'
    case 'blackmailed':
      return 'You were blackmailed. Don’t speak today; you can still vote.'
    case 'watched-over':
      return 'Someone watched over you last night.'
    case 'guilt':
      return 'Overcome with guilt, you take your own life.'
    case 'became-jester':
      return 'Your target died before the town could vote them out. You are now the Jester.'
    case 'became-mafioso':
      return 'The family has no killer left. You are now a Mafioso: you pick who to kill.'
  }
}

// ---------- Your log ----------

export interface LogLine {
  text: string
  private: boolean // only you can see this line
}

export interface LogSection {
  heading: string // "Day 2", "Night 1"
  night: boolean
  round: number
  lines: LogLine[]
}

export function publicEntryText(entry: PublicEntry, nameOf: NameOf): string {
  switch (entry.kind) {
    case 'night':
      return lastNightText(entry.deaths, nameOf)
    case 'vote':
      return entry.eliminatedId
        ? `${nameOf(entry.eliminatedId)} was voted out (${joinNames(entry.voters.map(nameOf))}).`
        : 'Nobody was voted out.'
    case 'narrator-eliminated':
      return `${joinNames(entry.playerIds.map(nameOf))} ${entry.playerIds.length === 1 ? 'was' : 'were'} eliminated by the narrator.`
    case 'mayor':
      return `${nameOf(entry.playerId)} revealed themselves as the Mayor.`
    case 'revenge':
      return entry.targetId ? `${nameOf(entry.targetId)} died.` : 'Nobody else died.'
    case 'remembered':
      return `Someone remembered they were the ${roleName(entry.roleId)}.`
  }
}

function sectionOf(entry: PublicEntry): { round: number; night: boolean } {
  if (entry.kind === 'night' || entry.kind === 'remembered') return { round: entry.round, night: true }
  if (entry.kind === 'narrator-eliminated') return { round: entry.round, night: entry.phase === 'night' || entry.phase === 'dawn' }
  return { round: entry.round, night: false }
}

// The game so far, Town of Salem style: public events and your private results,
// grouped by day and night, oldest first. Quiet-night filler is left out.
export function buildLog(history: PublicEntry[], results: PrivateResult[], nameOf: NameOf): LogSection[] {
  const sections = new Map<string, { round: number; night: boolean; lines: LogLine[] }>()
  const add = (round: number, night: boolean, line: LogLine) => {
    const key = `${round}-${night ? 'n' : 'd'}`
    if (!sections.has(key)) sections.set(key, { round, night, lines: [] })
    sections.get(key)!.lines.push(line)
  }

  for (const result of results) {
    if (result.kind === 'slept') continue
    add(result.round, true, { text: messageText(result, nameOf), private: true })
  }
  for (const entry of history) {
    const { round, night } = sectionOf(entry)
    add(round, night, { text: publicEntryText(entry, nameOf), private: false })
  }

  return [...sections.values()]
    .sort((a, b) => a.round - b.round || Number(a.night) - Number(b.night))
    .map((s) => ({ heading: `${s.night ? 'Night' : 'Day'} ${s.round}`, night: s.night, round: s.round, lines: s.lines }))
}

// One line of the narrator's story at dawn. roleOf gives a player's role name.
export function beatText(beat: StoryBeat, nameOf: NameOf, roleOf: (id: string) => string): string {
  switch (beat.kind) {
    case 'mafia-targeted': {
      const who = joinNames(beat.mafiaIds.map(nameOf))
      if (!beat.targetId) return `The Mafia (${who}) chose nobody.`
      const tie = beat.tieBroken ? ' Their votes were tied, so it was settled at random.' : ''
      return `The Mafia (${who}) targeted ${nameOf(beat.targetId)}.${tie}`
    }
    case 'protected':
      return `${nameOf(beat.medicId)} (${roleOf(beat.medicId)}) protected ${nameOf(beat.targetId)}.`
    case 'saved':
      return beat.cause
        ? `${nameOf(beat.targetId)} was ${attackPhrase(beat.cause, false, nameOf, roleOf)}, but saved.`
        : `${nameOf(beat.targetId)} was saved.`
    case 'killed':
      return beat.cause
        ? `${nameOf(beat.targetId)} was ${attackPhrase(beat.cause, true, nameOf, roleOf)}.`
        : `${nameOf(beat.targetId)} was killed.`
    case 'investigated':
      return `${nameOf(beat.detectiveId)} (${roleOf(beat.detectiveId)}) investigated ${nameOf(beat.targetId)}: ${
        beat.result === 'suspicious' ? 'suspicious' : 'not suspicious'
      }.`
    case 'suspects':
      return `${nameOf(beat.playerId)} suspects ${nameOf(beat.targetId)}.`
    case 'no-pick':
      return `${nameOf(beat.playerId)} (${roleOf(beat.playerId)}) didn’t choose anyone.`
    case 'skipped':
      return `${nameOf(beat.playerId)} (${roleOf(beat.playerId)}) chose to skip tonight.`
    case 'ability':
      return abilityBeat(beat, nameOf, roleOf)
  }
}

function abilityBeat(beat: Extract<StoryBeat, { kind: 'ability' }>, nameOf: NameOf, roleOf: (id: string) => string): string {
  const who = `${nameOf(beat.actorId)} (${roleOf(beat.actorId)})`
  const [t, ...rest] = beat.targetIds
  const list = (ids: string[]) => (ids.length > 0 ? joinNames(ids.map(nameOf)) : 'nobody')
  switch (beat.ability) {
    case 'jail': return `${who} locked up ${nameOf(t)}${lostAction(beat, nameOf)}.`
    case 'execute': return `${who} executed ${nameOf(t)}.`
    case 'alert': return `${who} went on alert.`
    case 'veteran-shot': return `${who} shot ${nameOf(t)}, who came to their house.`
    case 'distract':
      if (beat.detail === 'alert') return `${who} tried to distract ${nameOf(t)}, who was on alert.`
      if (beat.detail === 'killer') return `${who} distracted ${nameOf(t)}, who turned on them instead.`
      return `${who} distracted ${nameOf(t)}${lostAction(beat, nameOf)}.`
    case 'guard': return `${who} guarded ${nameOf(t)}.`
    case 'intercept': return `${who} stepped in front of ${nameOf(t)} and fought off ${nameOf(rest[0])}.`
    case 'vest': return `${who} wore a vest.`
    case 'frame': return `${who} framed ${nameOf(t)}.`
    case 'disguise': return `${who} copied ${nameOf(t)} and read as the ${beat.detail ? roleName(beat.detail) : 'same role'}.`
    case 'redirect': return `${who} attacked ${nameOf(t)} instead.`
    case 'kill': return `${who} attacked ${nameOf(t)}.`
    case 'blocked': return `${who} was stopped, and nobody else could reach ${nameOf(t)}.`
    case 'shortlist': return `${who} investigated ${nameOf(t)}: ${beat.detail}.`
    case 'watch': return `${who} watched ${nameOf(t)}. Visitors: ${list(rest)}.`
    case 'follow': return `${who} followed ${nameOf(t)}, who visited ${list(rest)}.`
    case 'examine': return `${who} examined ${nameOf(t)}: the ${beat.detail ? roleName(beat.detail) : '?'}.`
    case 'spy': return `${who} saw the Mafia visit ${list(beat.targetIds)}.`
    case 'vision': return `${who} had a vision of ${list(beat.targetIds)} (${beat.detail === 'evil' ? 'one is suspicious' : 'one is not suspicious'}).`
    case 'categorize': return `${who} looked into ${nameOf(t)}: ${beat.detail}.`
    case 'blackmail': return `${who} blackmailed ${nameOf(t)}.`
    case 'hypnotize': return `${who} hypnotized ${nameOf(t)}: “${beat.detail ? FAKE_LABEL[beat.detail as FakeMessage] : ''}.”`
    case 'remember': return `${who} remembered being the ${beat.detail ? roleName(beat.detail) : '?'}.`
    case 'guilt': return `${who} died of guilt.`
    case 'revenge': return `${who} took revenge on ${nameOf(t)}${lostAction(beat, nameOf)}.`
    default: return `${who} acted on ${list(beat.targetIds)}.`
  }
}

// "shot by Ana (Vigilante)": what happened to someone who was attacked.
function attackPhrase(cause: NightDeathCause, died: boolean, nameOf: NameOf, roleOf: (id: string) => string): string {
  const by = cause.byId ? `${nameOf(cause.byId)} (${roleOf(cause.byId)})` : 'someone'
  switch (cause.kind) {
    case 'mafia': return `${died ? 'killed' : 'attacked'} by the Mafia`
    case 'veteran': return `shot by ${by} after visiting them`
    case 'execute': return `executed by ${by}`
    case 'role': return `${cause.byId && roleOf(cause.byId) === 'Vigilante' ? 'shot' : died ? 'killed' : 'attacked'} by ${by}`
    case 'bodyguard': return `fought off by ${by}`
    case 'guarding': return `killed guarding ${cause.byId ? nameOf(cause.byId) : 'someone'}`
    case 'guilt': return 'overcome by guilt'
    case 'revenge': return `taken by ${by}`
  }
}

// How each player died, for the narrator at dawn: "Ivy, killed by the Mafia".
export function deathCauseText(id: string, cause: NightDeathCause | undefined, nameOf: NameOf, roleOf: (id: string) => string): string {
  if (!cause) return `${nameOf(id)} died.`
  const by = cause.byId ? `${nameOf(cause.byId)} (${roleOf(cause.byId)})` : ''
  switch (cause.kind) {
    case 'mafia': return `${nameOf(id)}, killed by the Mafia`
    case 'veteran': return `${nameOf(id)}, shot by ${by} after visiting them`
    case 'execute': return `${nameOf(id)}, executed by ${by}`
    case 'role': return `${nameOf(id)}, ${cause.byId && roleOf(cause.byId) === 'Vigilante' ? 'shot' : 'killed'} by ${by}`
    case 'bodyguard': return `${nameOf(id)}, killed by ${by} while attacking`
    case 'guarding': return `${nameOf(id)}, killed guarding ${cause.byId ? nameOf(cause.byId) : 'someone'}`
    case 'guilt': return `${nameOf(id)}, died of guilt`
    case 'revenge': return `${nameOf(id)}, taken by ${by}`
  }
}

// The public line never gives a cause: the narrator tells how, not who.
export function lastNightText(deaths: string[], nameOf: NameOf): string {
  if (deaths.length === 0) return 'Nobody died last night.'
  return `${joinNames(deaths.map(nameOf))} died last night.`
}

export function lastVoteText(eliminatedId: string | null, nameOf: NameOf): string {
  return eliminatedId ? `${nameOf(eliminatedId)} was voted out.` : 'Nobody was voted out.'
}

export function gameOverSubtext(iWon: boolean | null): string | null {
  if (iWon === null) return null
  return iWon ? 'Winner winner chicken dinner.' : 'GGs.'
}

// Why the game ended, for the narrator's finale.
export function winReason(winner: Team): string {
  return winner === 'town'
    ? 'The last of the Mafia is gone.'
    : winner === 'mafia'
      ? 'The Mafia now match the town.'
      : 'The Serial Killer is the last one standing.'
}

// ---------- At the table ----------

// A short fact under a player's name on the roster. Private notes are things only you know.
export interface RosterNote {
  text: string
  private: boolean
  tone?: 'good' | 'bad' | 'mayor'
}

// What you know about each player, by id. The log has the full story; this keeps only
// what's useful to glance at: suspicion, roles you've learned, your team, the Mayor.
// A newer result about someone replaces an older one of the same kind.
export function rosterNotes(view: PlayerView): Map<string, RosterNote[]> {
  const notes = new Map<string, Map<string, RosterNote>>()
  const set = (id: string, key: string, note: RosterNote) => {
    if (!notes.has(id)) notes.set(id, new Map())
    notes.get(id)!.set(key, note)
  }

  if (view.mayorId) set(view.mayorId, 'mayor', { text: 'Mayor', private: false, tone: 'mayor' })
  for (const t of view.teammates) set(t.id, 'team', { text: `Mafia · ${roleName(t.roleId)}`, private: true, tone: 'bad' })
  if (view.nemesisTarget) set(view.nemesisTarget, 'nemesis', { text: 'Your target', private: true })

  for (const r of view.messages) {
    switch (r.kind) {
      case 'investigated':
        set(r.targetId, 'suspicion', r.result === 'suspicious'
          ? { text: 'Suspicious', private: true, tone: 'bad' }
          : { text: 'Not suspicious', private: true, tone: 'good' })
        break
      case 'shortlist': {
        const names = r.roleIds.map(roleName)
        set(r.targetId, 'role', { text: names.join(' / '), private: true })
        break
      }
      case 'examined':
        set(r.targetId, 'role', { text: roleName(r.roleId), private: true })
        break
      case 'categorized':
        set(r.targetId, 'category', { text: r.category, private: true })
        break
      case 'jailed':
        if (r.executedRole) set(r.targetId, 'role', { text: roleName(r.executedRole), private: true })
        break
    }
  }

  return new Map([...notes].map(([id, m]) => [id, [...m.values()]]))
}

// ", so Med couldn't protect Eve": what a jailed or distracted player lost.
function lostAction(beat: Extract<StoryBeat, { kind: 'ability' }>, nameOf: NameOf): string {
  const [who, target] = beat.targetIds
  if (!beat.detail || !target) return ''
  const verb = ACTION_VERB[beat.detail as NightChoice] ?? beat.detail
  return target === who ? `, so ${nameOf(who)} couldn’t ${verb}` : `, so ${nameOf(who)} couldn’t ${verb} ${nameOf(target)}`
}

// ---------- The narrator's dawn: one short section per step ----------

export interface DawnSection {
  title: string
  lines: string[]
}

// Which section each story line belongs to: the night's priorities, 0 to 6.
const SECTION_ORDER = [
  '0 · Lock-ups', '1 · Unstoppable', '2 · Distractions', '3 · Protection and deception', '4 · Investigations', '5 · Kills', '6 · Late effects', 'Didn’t act',
] as const
type SectionTitle = (typeof SECTION_ORDER)[number]

function dawnSectionOf(beat: StoryBeat): SectionTitle | null {
  switch (beat.kind) {
    case 'mafia-targeted':
    case 'saved':
    case 'killed':
      return '5 · Kills'
    case 'protected':
      return '3 · Protection and deception'
    case 'investigated':
      return '4 · Investigations'
    case 'no-pick':
    case 'skipped':
      return 'Didn’t act'
    case 'suspects':
      return null // filler for the narrator; still in "Show every pick"
    case 'ability':
      switch (beat.ability) {
        case 'jail': return '0 · Lock-ups'
        case 'alert': case 'guilt': case 'revenge': return '1 · Unstoppable'
        case 'distract': return '2 · Distractions'
        case 'guard': case 'vest': case 'frame': case 'disguise': case 'blackmail': return '3 · Protection and deception'
        case 'kill': case 'execute': case 'redirect': case 'blocked': case 'intercept': case 'veteran-shot': return '5 · Kills'
        case 'hypnotize': case 'remember': return '6 · Late effects'
        default: return '4 · Investigations'
      }
  }
}

// The night as the narrator reads it: only steps where something happened. The Mafia's
// choice and the member who carried it out read as one line.
export function dawnSections(beats: StoryBeat[], nameOf: NameOf, roleOf: (id: string) => string): DawnSection[] {
  const mafia = beats.find((b) => b.kind === 'mafia-targeted')
  const shooter =
    mafia?.kind === 'mafia-targeted' && mafia.targetId
      ? beats.find(
          (b) => b.kind === 'ability' && b.ability === 'kill' && b.targetIds[0] === mafia.targetId && mafia.mafiaIds.includes(b.actorId),
        )
      : undefined

  const lines = new Map<SectionTitle, string[]>()
  const add = (title: SectionTitle, line: string) => lines.set(title, [...(lines.get(title) ?? []), line])

  for (const beat of beats) {
    const title = dawnSectionOf(beat)
    if (!title || beat === shooter) continue
    if (beat === mafia && shooter?.kind === 'ability' && mafia.kind === 'mafia-targeted') {
      const who = joinNames(mafia.mafiaIds.map(nameOf))
      const tie = mafia.tieBroken ? ' (a tie, settled at random)' : ''
      add(title, `The Mafia (${who}) chose ${nameOf(mafia.targetId)}${tie}; ${nameOf(shooter.actorId)} went.`)
      continue
    }
    add(title, beatText(beat, nameOf, roleOf))
  }
  return SECTION_ORDER.filter((t) => lines.has(t)).map((title) => ({ title, lines: lines.get(title)! }))
}
