import type { DetectiveResult, RoleDef } from '../engine/types'
import { villager } from './villager'
import { mafioso } from './mafioso'
import { medic } from './medic'
import { detective } from './detective'
import { vigilante } from './vigilante'
import { jester } from './jester'

// Every role, in the order the role picker will show them
export const ROLE_LIST: RoleDef[] = [
  villager,
  mafioso,
  medic,
  detective,
  vigilante,
  jester,
]

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

// What the Detective sees when investigating this role
export function detectiveSees(role: RoleDef): DetectiveResult {
  if (role.appearsAs) return role.appearsAs
  return role.team === 'mafia' ? 'mafia' : 'not-mafia'
}