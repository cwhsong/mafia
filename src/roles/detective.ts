import type { RoleDef } from '../engine/types'
import { PRIORITY } from '../engine/priorities'

export const detective: RoleDef = {
  id: 'detective',
  name: 'Detective',
  emoji: '🔍',
  team: 'town',
  category: 'Town Investigative',
  description: 'Each night, investigate one player to learn whether they are Mafia.',
  night: {
    kind: 'investigate',
    priority: PRIORITY.investigate,
    canTargetSelf: false,
  },
  available: true,
}