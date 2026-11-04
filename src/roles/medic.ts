import type { RoleDef } from '../engine/types'

export const medic: RoleDef = {
  id: 'medic',
  name: 'Medic',
  emoji: '🩺',
  team: 'town',
  category: 'Town Protective',
  description: 'Each night, choose one player to protect from being killed.',
  night: {
    kind: 'protect',
    target: 'any',
    selfUses: 1, // once per game, as in Town of Salem
  },
  available: true,
}