import type { DetectiveResult, RoleDef } from '../engine/types'
import { villager } from './villager'
import { mafioso } from './mafioso'
import { medic } from './medic'
import { detective } from './detective'
import { vigilante } from './vigilante'
import { jester } from './jester'
import { WAVE_1 } from './wave1'
import { ROLE_INFO } from './info'

// Every role, in the order the role picker will show them
const ALL: RoleDef[] = [villager, mafioso, medic, detective, vigilante, jester, ...WAVE_1]
const ORDER = ROLE_INFO.map((r) => r.id)
export const ROLE_LIST: RoleDef[] = [...ALL].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))

// Look up a role by id: ROLES['medic']
export const ROLES: Record<string, RoleDef> = Object.fromEntries(
  ROLE_LIST.map((role) => [role.id, role]),
)

// Only roles players can actually pick right now
export const AVAILABLE_ROLES: RoleDef[] = ROLE_LIST.filter((role) => role.available)

// Safe lookup: throws a clear error instead of returning undefined
export function getRole(id: string): RoleDef {
  const role = ROLES[id]
  if (!role) throw new Error(`Unknown role: ${id}`)
  return role
}

// Suspicious = a threat the Town must eliminate: the Mafia and Neutral Killing / Chaos roles.
// The Godfather reads as not suspicious.
export function detectiveSees(role: RoleDef): DetectiveResult {
  if (role.appearsAs) return role.appearsAs
  const hostile = role.team === 'neutral' && (role.category === 'Neutral Killing' || role.category === 'Neutral Chaos')
  return role.team === 'mafia' || hostile ? 'suspicious' : 'not-suspicious'
}