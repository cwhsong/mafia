import { ROLES } from '../../roles'
import { INFO, categoryLabel } from '../../roles/info'
import { teamLabel } from '../helpers'
import './RoleCard.css'

interface Props {
  roleId: string
  faceUp: boolean
  onToggle: () => void
}

// The player's own role as a large playing card. Face down until tapped,
// so someone glancing at the phone can't see it.
export function RoleCard({ roleId, faceUp, onToggle }: Props) {
  const role = ROLES[roleId]
  if (!role) return null

  return (
    <button
      type="button"
      className={`role-card ${faceUp ? 'is-up' : ''} ${role.team === 'mafia' ? 'is-mafia' : ''}`}
      onClick={onToggle}
      aria-pressed={faceUp}
      aria-label={faceUp ? `Your role: ${role.name}. Tap to hide.` : 'Tap to reveal your role'}
    >
      <span className="role-card-inner">
        <span className="role-face role-back" aria-hidden={faceUp}>
          <span className="role-sun" />
          <span className="role-back-hint">Tap to reveal</span>
        </span>
        <span className="role-face role-front" aria-hidden={!faceUp}>
          <span className="role-corner role-corner-top">
            {role.name}
            <span className="role-pip" />
          </span>
          <span className="role-monogram">{role.name[0]}</span>
          <span className="role-team">{INFO[roleId] ? categoryLabel(INFO[roleId]) : teamLabel(role.team)}</span>
          <span className="role-desc">{INFO[roleId]?.ability ?? role.description}</span>
          <span className="role-corner role-corner-bottom">
            {role.name}
            <span className="role-pip" />
          </span>
        </span>
      </span>
    </button>
  )
}
