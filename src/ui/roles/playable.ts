import { ROLES } from '../../roles'

// A role is playable once the game engine supports it; everything else shows "Coming soon".
export function isPlayable(roleId: string): boolean {
  return ROLES[roleId]?.available === true
}
