import type { PlayerView } from '../../engine'
import { ROLES } from '../../roles'
import { RoomHeader } from '../components/RoomHeader'
import { countRoles } from '../helpers'
import type { InRoomState, RoomSession } from '../roomSession'

interface Props {
  session: RoomSession
  state: InRoomState
  view: PlayerView
}

export function PlayerLobby({ session, state, view }: Props) {
  const counts = Object.entries(countRoles(view.roleSlots))

  return (
    <div className="room">
      <RoomHeader code={state.code} />

      <section className="stack">
        <h1 className="room-title">You’re in, {view.me?.name}.</h1>
        <p className="muted">{state.hostName} is narrating.</p>
        <p className="waiting">Waiting for the narrator to deal the roles…</p>
      </section>

      <section className="stack">
        <div className="section-head">
          <p className="section-label">At the table</p>
          <span className="hint">{view.players.length} players</span>
        </div>
        <ul className="list">
          {view.players.map((p) => (
            <li key={p.id}>
              <span>
                {p.name} {p.id === view.me?.id && <span className="you">(you)</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {counts.length > 0 && (
        <section className="stack">
          <p className="section-label">Roles in this game</p>
          <ul className="list">
            {counts.map(([roleId, count]) => {
              const role = ROLES[roleId]
              return (
                <li key={roleId}>
                  <span>
                    {role?.name ?? roleId}{' '}
                    <span className={`team-tag team-${role?.team}`}>{role?.team}</span>
                  </span>
                  <span className="muted">× {count}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <button type="button" className="btn btn-quiet" onClick={session.leave}>
        Leave room
      </button>
    </div>
  )
}
