import type { NightChoice, PrivateResult, PublicEntry, StoryBeat, Team } from '../engine'

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

export const ACTION_VERB: Record<NightChoice, string> = {
  kill: 'kill',
  protect: 'protect',
  investigate: 'investigate',
  suspect: 'suspect',
}

export function nightSubtext(choice: NightChoice): string {
  switch (choice) {
    case 'kill':
      return 'Choose who the Mafia will kill.'
    case 'protect':
      return 'Choose who to protect tonight.'
    case 'investigate':
      return 'Choose who to investigate.'
    case 'suspect':
      return 'Who do you suspect? Nobody sees your answer.'
  }
}

// A player's private dawn message.
export function messageText(result: PrivateResult, nameOf: NameOf): string {
  switch (result.kind) {
    case 'investigated':
      return result.result === 'mafia'
        ? `${nameOf(result.targetId)} is Mafia.`
        : `${nameOf(result.targetId)} is not Mafia.`
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
    case 'no-pick':
      return result.action === 'protect'
        ? 'You didn’t protect anyone.'
        : result.action === 'investigate'
          ? 'You didn’t investigate anyone.'
          : 'You didn’t choose anyone.'
  }
}

// ---------- Your log ----------

export interface LogLine {
  text: string
  private: boolean // only you can see this line
}

export interface LogSection {
  heading: string // "Day 2", "Night 1"
  lines: LogLine[]
}

function publicText(entry: PublicEntry, nameOf: NameOf): string {
  switch (entry.kind) {
    case 'night':
      return lastNightText(entry.deaths, nameOf)
    case 'vote':
      return entry.eliminatedId
        ? `${nameOf(entry.eliminatedId)} was voted out (${joinNames(entry.voters.map(nameOf))}).`
        : 'Nobody was voted out.'
    case 'narrator-eliminated':
      return `${joinNames(entry.playerIds.map(nameOf))} ${entry.playerIds.length === 1 ? 'was' : 'were'} eliminated by the narrator.`
  }
}

function sectionOf(entry: PublicEntry): { round: number; night: boolean } {
  if (entry.kind === 'night') return { round: entry.round, night: true }
  if (entry.kind === 'vote') return { round: entry.round, night: false }
  return { round: entry.round, night: entry.phase === 'night' || entry.phase === 'dawn' }
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
    add(round, night, { text: publicText(entry, nameOf), private: false })
  }

  return [...sections.values()]
    .sort((a, b) => a.round - b.round || Number(a.night) - Number(b.night))
    .map((s) => ({ heading: `${s.night ? 'Night' : 'Day'} ${s.round}`, lines: s.lines }))
}

// One line of the narrator's story at dawn. roleOf gives a player's role name.
export function beatText(beat: StoryBeat, nameOf: NameOf, roleOf: (id: string) => string): string {
  switch (beat.kind) {
    case 'mafia-targeted': {
      const who = beat.mafiaIds.map(nameOf).join(', ')
      if (!beat.targetId) return `The Mafia (${who}) chose nobody.`
      const tie = beat.tieBroken ? ' Their votes were tied, so it was settled at random.' : ''
      return `The Mafia (${who}) targeted ${nameOf(beat.targetId)}.${tie}`
    }
    case 'protected':
      return `The ${roleOf(beat.medicId)} (${nameOf(beat.medicId)}) protected ${nameOf(beat.targetId)}.`
    case 'saved':
      return `${nameOf(beat.targetId)} was saved.`
    case 'killed':
      return `${nameOf(beat.targetId)} was killed.`
    case 'investigated':
      return `The ${roleOf(beat.detectiveId)} (${nameOf(beat.detectiveId)}) investigated ${nameOf(beat.targetId)}: ${
        beat.result === 'mafia' ? 'Mafia' : 'not Mafia'
      }.`
    case 'suspects':
      return `${nameOf(beat.playerId)} suspects ${nameOf(beat.targetId)}.`
    case 'no-pick':
      return `${nameOf(beat.playerId)} (${roleOf(beat.playerId)}) didn’t choose anyone.`
  }
}

export function lastNightText(deaths: string[], nameOf: NameOf): string {
  if (deaths.length === 0) return 'Nobody died last night.'
  return `${joinNames(deaths.map(nameOf))} ${deaths.length === 1 ? 'was' : 'were'} killed in the night.`
}

export function lastVoteText(eliminatedId: string | null, nameOf: NameOf): string {
  return eliminatedId ? `${nameOf(eliminatedId)} was voted out.` : 'Nobody was voted out.'
}

export function gameOverSubtext(myTeam: Team | null, winner: Team): string | null {
  if (!myTeam) return null
  return myTeam === winner ? 'Winner winner chicken dinner.' : 'GGs.'
}
