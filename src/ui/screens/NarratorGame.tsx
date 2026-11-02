import type { GameState } from '../../engine'
import { ROLES } from '../../roles'
import { RoomHeader, ErrorBanner } from '../components/RoomHeader'
import { phaseLabel } from '../helpers'
import type { InRoomState, RoomSession } from '../roomSession'

interface Props {
  session: RoomSession
  state: InRoomState
  game: GameState
}

// The narrator's screen once roles are dealt: the full deal at a glance.
// Phase controls and eliminations arrive in the next chunk.
export function NarratorGame({ session, state, game }: Props) {
  return (
    <div className="room">
      <RoomHeader code={state.code} />

      {state.error && <ErrorBanner message={state.error.message} onDismiss={session.dismissError} />}

      <section className="stack">
        <p className="section-label">{phaseLabel(game.phase, game.round)}</p>
        <h1 className="room-title">The deal</h1>
        <p className="muted">Only you can see this. Phase controls are coming next.</p>
      </section>

      <ul className="list">
        {game.players.map((p) => {
          const role = p.roleId ? ROLES[p.roleId] : undefined
          return (
            <li key={p.id}>
              <span className={p.alive ? '' : 'is-dead'}>{p.name}</span>
              <span className={`team-tag team-${role?.team}`}>{role?.name}</span>
            </li>
          )
        })}
      </ul>

      <button type="button" className="btn btn-quiet" onClick={session.leave}>
        Close room
      </button>
    </div>
  )
}
