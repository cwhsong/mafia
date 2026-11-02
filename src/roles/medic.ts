import type { RoleDef } from '../engine/types'
import { PRIORITY } from '../engine/priorities'

export const medic: RoleDef = {
  id: 'medic',
  name: 'Medic',
  emoji: '🩺',
  team: 'town',
  category: 'Town Protective',
  description: 'Each night, choose one player to protect from being killed.',
  night: {
    kind: 'protect',
    priority: PRIORITY.protect,
    canTargetSelf: true,
  },
  available: true,
}