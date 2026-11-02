import type { RoleDef } from '../engine/types'
import { PRIORITY } from '../engine/priorities'

export const vigilante: RoleDef = {
  id: 'vigilante',
  name: 'Vigilante',
  emoji: '🎯',
  team: 'town',
  category: 'Town Killing',
  description: 'Up to three times per game, choose one player to shoot at night.',
  night: {
    kind: 'kill',
    priority: PRIORITY.kill,
    canTargetSelf: false,
    maxUses: 3,
  },
  available: false, // enabled in Phase 5 once its night logic is tested
}