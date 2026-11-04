import type { RoleDef } from '../engine/types'

export const vigilante: RoleDef = {
  id: 'vigilante',
  name: 'Vigilante',
  emoji: '🎯',
  team: 'town',
  category: 'Town Killing',
  description: "Shoot someone. If you kill a Town member, you'll die of guilt the next night.",
  night: {
    kind: 'kill',
    target: 'other',
    maxUses: 2,
    fromNight: 2,
  },
  available: true,
}