import { useState } from 'react'
import type { PlayerView } from '../../engine'
import { ROLES } from '../../roles'
import { RoomHeader } from '../components/RoomHeader'
import { RoleCard } from '../components/RoleCard'
import { phaseLabel } from '../helpers'
import type { InRoomState, RoomSession } from '../roomSession'

interface Props {
  session: RoomSession
  state: InRoomState
  view: PlayerView
}

// A player's screen once roles are dealt. Phase screens, the dead screen and
// game over arrive in the next chunk; for now this shows the role card.
export function PlayerGame({ session, state, view }: Props) {
  const [faceUp, setFaceUp] = useState(false)
  const roleId = view.me?.roleId

  return (
    <div className="room">
      <RoomHeader code={state.code} />

      <section className="stack">
        <p className="section-label">{phaseLabel(view.phase, view.round)}</p>
        <h1 className="room-title">Your role</h1>
      </section>

      {roleId ? (
        <RoleCard roleId={roleId} faceUp={faceUp} onToggle={() => setFaceUp((up) => !up)} />
      ) : (
        <p className="muted">You’re watching this game.</p>
      )}

      <p className="hint" style={{ textAlign: 'center' }}>
        {faceUp ? 'Tap the card to hide it again.' : 'Make sure nobody is looking, then tap.'}
      </p>

      {faceUp && view.teammates.length > 0 && (
        <section className="panel stack">
          <p className="section-label team-mafia">Your fellow Mafia</p>
          <ul className="list">
            {view.teammates.map((t) => (
              <li key={t.id}>
                <span className={t.alive ? '' : 'is-dead'}>{t.name}</span>
                <span className="team-tag team-mafia">{ROLES[t.roleId]?.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" className="btn btn-quiet" onClick={session.leave}>
        Leave room
      </button>
    </div>
  )
}
