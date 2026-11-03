import type { NightChoice, PrivateResult, StoryBeat, Team } from '../engine'

// Everything the screens say about night actions, messages and story beats lives here,
// so the wording stays consistent and can be tested.

type NameOf = (id: string | null | undefined) => string

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
      return 'You slept through the night.'
    case 'no-pick':
      return result.action === 'protect'
        ? 'You didn’t protect anyone.'
        : result.action === 'investigate'
          ? 'You didn’t investigate anyone.'
          : 'You didn’t choose anyone.'
  }
}

// The same message in the "Your nights" log, where a Villager's decoy pick is worth keeping.
export function logText(result: PrivateResult, nameOf: NameOf): string {
  if (result.kind === 'slept' && result.suspectedId) {
    return `You slept through the night. You suspected ${nameOf(result.suspectedId)}.`
  }
  return messageText(result, nameOf)
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
  return `${deaths.map(nameOf).join(' and ')} ${deaths.length === 1 ? 'was' : 'were'} killed in the night.`
}

export function lastVoteText(eliminatedId: string | null, nameOf: NameOf): string {
  return eliminatedId ? `${nameOf(eliminatedId)} was voted out.` : 'Nobody was voted out.'
}

export function gameOverSubtext(myTeam: Team | null, winner: Team): string | null {
  if (!myTeam) return null
  return myTeam === winner ? 'Winner winner chicken dinner.' : 'GGs.'
}
