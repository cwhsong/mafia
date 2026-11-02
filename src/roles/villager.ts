import type { RoleDef } from '../engine/types'

export const villager: RoleDef = {
  id: 'villager',
  name: 'Villager',
  emoji: '🧑‍🌾',
  team: 'town',
  category: 'Town',
  description: 'No night action. Find the Mafia through discussion and your vote.',
  night: null,
  available: true,
}