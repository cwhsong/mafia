import type { NightActionKind } from './types'

// The order a night resolves in, by priority (as in Town of Salem): lower numbers act
// first, and abilities at the same priority land together, so they can't undo each other.
export const STEPS = [
  'jail',         // 0. Locked in before the night: the Warden locks someone up
  'unstoppable',  // 1. Nothing can stop these: Veteran's alert, Vigilante's guilt, Jester's revenge
  'distract',     // 2. Bartender / Consort cancel actions (Ferryman swaps will go here too)
  'protect',      // 3. Protection and deception: Medic, Bodyguard, vests, Framer, Impostor, Blackmailer
  'investigate',  // 4. Detective and friends
  'kill',         // 5. Mafia, Vigilante, Serial Killer, execution, Veteran's shots
  'late',         // 6. Late effects: Amnesiac remembers, Hypnotist replaces a dawn message
] as const

export type Step = (typeof STEPS)[number]

export const STEP_OF: Record<NightActionKind, Step> = {
  jail: 'jail',
  alert: 'unstoppable',
  distract: 'distract',
  protect: 'protect',
  guard: 'protect',
  vest: 'protect',
  frame: 'protect',
  disguise: 'protect',
  blackmail: 'protect',
  kill: 'kill',
  investigate: 'investigate',
  shortlist: 'investigate',
  watch: 'investigate',
  follow: 'investigate',
  examine: 'investigate',
  spy: 'investigate',
  vision: 'investigate',
  categorize: 'investigate',
  hypnotize: 'late',
  remember: 'late',
}

// Abilities that don't send you to anyone's house (a Lookout never sees them).
export const NOT_A_VISIT: ReadonlySet<NightActionKind> = new Set(['alert', 'vest', 'spy', 'vision', 'examine', 'remember'])
