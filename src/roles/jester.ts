import type { RoleDef } from '../engine/types'

export const jester: RoleDef = {
  id: 'jester',
  name: 'Jester',
  emoji: '🃏',
  team: 'neutral',
  category: 'Neutral Evil',
  description: 'You win if the town votes you out. Act suspicious, but not too suspicious.',
  night: null,
  available: false, // enabled in Phase 5 once its win condition is tested
}