import { useState } from 'react'
import type { PlayerView } from '../../engine'
import { ROLES } from '../../roles'
import { RoomHeader } from '../components/RoomHeader'
import { RoleCard } from '../components/RoleCard'
import { GameOver } from '../components/GameOver'
import { phaseLabel } from '../helpers'
import type { InRoomState, RoomSession } from '../roomSession'

interface Props {
  session: RoomSession
  state: InRoomState
  view: PlayerView
}

function phaseMessage(view: PlayerView): { title: string; body: string } {
  switch (view.phase) {
    case 'day':
      return view.round === 1
        ? { title: 'Introduce yourselves', body: 'Check your role, then say hello. There’s no vote on Day 1.' }
        : { title: 'Discuss', body: 'Who do you trust? Who’s lying? The vote comes next.' }
    case 'vote':
      return { title: 'The town votes', body: 'Vote out loud. The narrator will announce the result.' }
    case 'night':
      return { title: 'Night falls', body: 'Close your eyes and follow the narrator.' }
    case 'dawn':
      return { title: 'Dawn breaks', body: 'Listen to the narrator’s story of the night.' }
    default:
      return { title: '', body: '' }
  }
}

// A player's screen once roles are dealt: the current phase, their card,
// the dead screen if they've been eliminated, and game over.
export function PlayerGame({ session, state, view }: Props) {
  const [faceUp, setFaceUp] = useState(false)
  const roleId = view.me?.roleId
  const dead = view.me ? !view.me.alive : false

  if (view.phase === 'ended' && view.winner && view.revealedRoles) {
    const roles = view.revealedRoles
    return (
      <div className="room">
        <RoomHeader code={state.code} />
        <GameOver
          winner={view.winner}
          players={view.players.map((p) => ({ ...p, roleId: roles[p.id] ?? '' }))}
          meId={view.me?.id}
        />
        <button type="button" className="btn btn-quiet" onClick={session.leave}>
          Leave room
        </button>
      </div>
    )
  }

  const message = phaseMessage(view)

  return (
    <div className="room">
      <RoomHeader code={state.code} />

      <section className="stack">
        <p className="section-label">{phaseLabel(view.phase, view.round)}</p>
        {dead ? (
          <>
            <h1 className="room-title">You were eliminated</h1>
            <p className="muted">Stay quiet and watch the rest of the game. Your role stays secret until the end.</p>
          </>
        ) : (
          <>
            <h1 className="room-title">{message.title}</h1>
            <p className="muted">{message.body}</p>
          </>
        )}
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

      <section className="stack">
        <div className="section-head">
          <p className="section-label">At the table</p>
          <span className="hint">{view.players.filter((p) => p.alive).length} still in</span>
        </div>
        <ul className="list">
          {view.players.map((p) => (
            <li key={p.id}>
              <span>
                <span className={p.alive ? '' : 'is-dead'}>{p.name}</span>
                {p.id === view.me?.id && <span className="you"> (you)</span>}
              </span>
              {!p.alive && <span className="hint">out</span>}
            </li>
          ))}
        </ul>
      </section>

      <button type="button" className="btn btn-quiet" onClick={session.leave}>
        Leave room
      </button>
    </div>
  )
}
