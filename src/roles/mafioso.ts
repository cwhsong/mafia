import type { RoleDef } from '../engine/types'

export const mafioso: RoleDef = {
  id: 'mafioso',
  name: 'Mafioso',
  emoji: '🕴️',
  team: 'mafia',
  category: 'Mafia Killing',
  description: 'Each night, agree with the rest of the Mafia on one player to eliminate.',
  night: {
    kind: 'kill',
    target: 'other',
    sharedWithTeam: true,
  },
  available: true,
}