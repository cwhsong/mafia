import { useState } from 'react'
import type { GameState } from '../../engine'
import { ROLES } from '../../roles'
import { RoomHeader, ErrorBanner } from '../components/RoomHeader'
import { GameOver } from '../components/GameOver'
import { phaseLabel, nextPhaseLabel, causeForPhase } from '../helpers'
import type { InRoomState, RoomSession } from '../roomSession'

interface Props {
  session: RoomSession
  state: InRoomState
  game: GameState
}

const PHASE_NOTES: Record<string, string> = {
  day: 'Players discuss. Day 1 has no vote.',
  vote: 'The town votes out loud. Eliminate whoever they choose.',
  night: 'Everyone sleeps. Run the night as in classic Mafia; phone actions arrive in Phase 4.',
  dawn: 'Tell the story of the night, then eliminate anyone who died.',
}

// The narrator's dashboard once roles are dealt: phase controls, the full deal,
// and eliminations. Phase 4 replaces manual night eliminations with phone actions.
export function NarratorGame({ session, state, game }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)

  if (game.phase === 'ended' && game.winner) {
    return (
      <div className="room">
        <RoomHeader code={state.code} />
        <GameOver
          winner={game.winner}
          players={game.players.map((p) => ({ ...p, roleId: p.roleId ?? '' }))}
        />
        <button type="button" className="btn btn-quiet" onClick={session.leave}>
          Close room
        </button>
      </div>
    )
  }

  const next = nextPhaseLabel(game.phase, game.round)
  const cause = causeForPhase(game.phase)
  const selectedNames = game.players.filter((p) => selected.includes(p.id)).map((p) => p.name)

  function toggle(id: string) {
    setConfirming(false)
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function eliminate() {
    session.send({ type: 'eliminate', playerIds: selected, cause })
    setSelected([])
    setConfirming(false)
  }

  function advance() {
    setSelected([])
    setConfirming(false)
    session.send({ type: 'advance' })
  }

  return (
    <div className="room">
      <RoomHeader code={state.code} />

      {state.error && <ErrorBanner message={state.error.message} onDismiss={session.dismissError} />}

      <section className="stack">
        <p className="section-label">Narrator</p>
        <h1 className="room-title">{phaseLabel(game.phase, game.round)}</h1>
        <p className="muted">{PHASE_NOTES[game.phase]}</p>
        {next && (
          <button type="button" className="btn btn-primary" onClick={advance}>
            {next}
          </button>
        )}
      </section>

      <section className="stack">
        <div className="section-head">
          <p className="section-label">The deal</p>
          <span className="hint">Tap names to select</span>
        </div>
        <ul className="list">
          {game.players.map((p) => {
            const role = p.roleId ? ROLES[p.roleId] : undefined
            const isSelected = selected.includes(p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`pick ${isSelected ? 'is-picked' : ''}`}
                  onClick={() => toggle(p.id)}
                  disabled={!p.alive}
                  aria-pressed={isSelected}
                >
                  <span className={p.alive ? '' : 'is-dead'}>{p.name}</span>
                  {!p.alive && <span className="hint"> · out</span>}
                </button>
                <span className={`team-tag team-${role?.team}`}>{role?.name}</span>
              </li>
            )
          })}
        </ul>
      </section>

      {selected.length > 0 && (
        <section className="panel stack">
          <p>
            Eliminate <strong>{selectedNames.join(', ')}</strong>
            <span className="muted"> ({cause === 'vote' ? 'voted out' : cause === 'night' ? 'killed in the night' : 'removed by the narrator'})</span>
          </p>
          {confirming ? (
            <div className="row">
              <button type="button" className="btn btn-danger" onClick={eliminate}>
                Yes, eliminate
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="row">
              <button type="button" className="btn" onClick={() => setConfirming(true)}>
                Eliminate {selected.length === 1 ? 'player' : `${selected.length} players`}
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setSelected([])}>
                Clear
              </button>
            </div>
          )}
        </section>
      )}

      <button type="button" className="btn btn-quiet" onClick={session.leave}>
        Close room
      </button>
    </div>
  )
}
