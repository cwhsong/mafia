import type { Phase, Team } from '../engine'
import { AVAILABLE_ROLES, ROLES } from '../roles'

// ---------- Role picker ----------

// ['villager', 'villager', 'medic'] → { villager: 2, medic: 1 }
export function countRoles(slots: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const id of slots) counts[id] = (counts[id] ?? 0) + 1
  return counts
}

// Rebuilds the slot list with one role's count changed, in role-picker order.
export function withRoleCount(slots: readonly string[], roleId: string, count: number): string[] {
  const counts = { ...countRoles(slots), [roleId]: Math.max(0, count) }
  return AVAILABLE_ROLES.flatMap((role) => Array<string>(counts[role.id] ?? 0).fill(role.id))
}

// Tops up with Villagers until there is one role per player.
export function fillWithVillagers(slots: readonly string[], playerCount: number): string[] {
  const missing = playerCount - slots.length
  if (missing <= 0) return [...slots]
  return withRoleCount(slots, 'villager', (countRoles(slots).villager ?? 0) + missing)
}

// ---------- Labels ----------

export function phaseLabel(phase: Phase, round: number): string {
  switch (phase) {
    case 'lobby':
      return 'Lobby'
    case 'day':
      return `Day ${round}`
    case 'vote':
      return `Day ${round} · Vote`
    case 'night':
      return `Night ${round}`
    case 'dawn':
      return `Dawn ${round}`
    case 'ended':
      return 'Game over'
  }
}

export function teamOf(roleId: string | null | undefined): Team | null {
  return roleId ? (ROLES[roleId]?.team ?? null) : null
}

export function teamLabel(team: Team): string {
  return team === 'town' ? 'Town' : team === 'mafia' ? 'Mafia' : 'Neutral'
}

// Join link for a room, e.g. https://cwhsong.github.io/mafia/#KXQRTZ
export function joinLink(code: string, location: Pick<Location, 'origin' | 'pathname'>): string {
  return `${location.origin}${location.pathname}#${code}`
}
