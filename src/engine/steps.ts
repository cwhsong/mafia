import type { NightActionKind } from './types'

// The order a night resolves in. Every night ability belongs to exactly one step,
// and steps run top to bottom, so (for example) a distraction always lands before
// the action it cancels, and protection is in place before any kill.
export const STEPS = [
  'jail',         // 1. Warden locks someone up; Veteran goes on alert
  'distract',     // 2. Bartender / Consort cancel actions
  'swap',         // 3. Ferryman swaps targets (later)
  'protect',      // 4. Medic, Bodyguard, vests
  'disguise',     // 5. Framer, Impostor change how someone reads
  'kill',         // 6. Mafia, Vigilante, Serial Killer, execution, Veteran's shots
  'investigate',  // 7. Detective and friends read the result of everything above
  'memory',       // 8. Hypnotist replaces a dawn message
  'aftermath',    // 9. guilt, revenge, remembering
] as const

export type Step = (typeof STEPS)[number]

export const STEP_OF: Record<NightActionKind, Step> = {
  jail: 'jail',
  alert: 'jail',
  distract: 'distract',
  protect: 'protect',
  guard: 'protect',
  vest: 'protect',
  frame: 'disguise',
  disguise: 'disguise',
  kill: 'kill',
  investigate: 'investigate',
  shortlist: 'investigate',
  watch: 'investigate',
  follow: 'investigate',
  examine: 'investigate',
  spy: 'investigate',
  vision: 'investigate',
  categorize: 'investigate',
  blackmail: 'investigate',
  hypnotize: 'memory',
  remember: 'aftermath',
}

// Abilities that don't send you to anyone's house (a Lookout never sees them).
export const NOT_A_VISIT: ReadonlySet<NightActionKind> = new Set(['alert', 'vest', 'spy', 'vision', 'examine', 'remember'])
