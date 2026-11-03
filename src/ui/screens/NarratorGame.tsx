import { useState } from 'react'
import { ABSTAIN, type GameState } from '../../engine'
import { ROLES } from '../../roles'
import { RoomHeader, ErrorBanner } from '../components/RoomHeader'
import { GameOver } from '../components/GameOver'
import { ScreenHeading } from '../components/ScreenHeading'
import { PickList, type PickOption } from '../components/PickList'
import { phaseLabel, nextPhaseLabel, causeForPhase, winnerLabel } from '../helpers'
import { beatText, joinNames, lastNightText, lastVoteText } from '../text'
import { LeaveButton } from '../components/LeaveButton'
import type { InRoomState, RoomSession } from '../roomSession'

interface Props {
  session: RoomSession
  state: InRoomState
  game: GameState
}

type NameOf = (id: string | null | undefined) => string

// ---------- The deal (always available to the narrator) ----------

function Deal({ game }: { game: GameState }) {
  return (
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
  )
}

// ---------- Manual elimination (for edge cases, e.g. someone has to leave) ----------

function EliminateTool({ session, game, nameOf }: { session: RoomSession; game: GameState; nameOf: NameOf }) {
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const cause = causeForPhase(game.phase)
  const causeText = cause === 'vote' ? 'voted out' : cause === 'night' ? 'killed in the night' : 'removed by the narrator'

  const options: PickOption[] = game.players.map((p) => ({
    id: p.id,
    label: p.name,
    dead: !p.alive,
    disabled: !p.alive,
    note: p.alive ? undefined : 'out',
  }))

  function toggle(id: string) {
    setConfirming(false)
    setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function eliminate() {
    session.send({ type: 'eliminate', playerIds: selected, cause })
    setSelected([])
    setConfirming(false)
  }

  return (
    <section className="stack">
      <p className="section-label">Eliminate a player</p>
      <p className="hint">For edge cases, like someone having to leave. Tap names to select them.</p>
        <PickList options={options} selectedIds={selected} onToggle={toggle} />
        {selected.length > 0 &&
          (confirming ? (
            <div className="row">
              <button type="button" className="btn btn-danger" onClick={eliminate}>
                Yes, eliminate {joinNames(selected.map(nameOf))} ({causeText})
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirming(true)}>
              Eliminate {selected.length === 1 ? 'player' : `${selected.length} players`}
            </button>
          ))}
    </section>
  )
}

// A dropdown for occasional narrator controls; more tools will join it later.
function NarratorTools({ session, game, nameOf }: { session: RoomSession; game: GameState; nameOf: NameOf }) {
  return (
    <details className="tools">
      <summary>Narrator tools</summary>
      <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
        <EliminateTool session={session} game={game} nameOf={nameOf} />
      </div>
    </details>
  )
}

// ---------- Night ----------

function NightPanel({ session, game, nameOf }: { session: RoomSession; game: GameState; nameOf: NameOf }) {
  const [confirming, setConfirming] = useState(false)
  const alive = game.players.filter((p) => p.alive)
  const missing = alive.filter((p) => !game.nightPicks[p.id])

  function end() {
    if (missing.length > 0 && !confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    session.send({ type: 'resolveNight' })
  }

  return (
    <section className="stack">
      {missing.length > 0 && (
        <p className="summary">
          Still choosing: {missing.map((p) => p.name).join(', ')}
        </p>
      )}
      {confirming ? (
        <div className="stack">
          <p className="warning">
            End the night anyway? {joinNames(missing.map((p) => nameOf(p.id)))} {missing.length === 1 ? 'hasn’t' : 'haven’t'} chosen.
          </p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={end}>
              Yes, end the night
            </button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>
              Wait
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={end}>
          End the night
        </button>
      )}
    </section>
  )
}

// ---------- Dawn ----------

function DawnPanel({ session, game, nameOf }: { session: RoomSession; game: GameState; nameOf: NameOf }) {
  const [showPicks, setShowPicks] = useState(false)
  const dawn = game.dawn
  if (!dawn) return null
  const roleOf = (id: string) => {
    const roleId = game.players.find((p) => p.id === id)?.roleId
    return (roleId && ROLES[roleId]?.name) || 'player'
  }

  return (
    <section className="stack">
      <ol className="beats">
        {dawn.beats.map((beat, i) => (
          <li key={i}>{beatText(beat, nameOf, roleOf)}</li>
        ))}
      </ol>

      <button type="button" className="btn btn-small btn-quiet" onClick={() => setShowPicks((s) => !s)}>
        {showPicks ? 'Hide every pick' : 'Show every pick'}
      </button>
      {showPicks && (
        <ul className="list">
          {game.players
            .filter((p) => p.alive)
            .map((p) => (
              <li key={p.id}>
                <span>
                  {p.name} <span className="hint">({roleOf(p.id)})</span>
                </span>
                <span className="muted">{dawn.picks[p.id] ? nameOf(dawn.picks[p.id]) : 'no pick'}</span>
              </li>
            ))}
        </ul>
      )}

      <p className="summary">
        {dawn.deaths.length ? lastNightText(dawn.deaths, nameOf) : 'Nobody will die.'}
      </p>
      {dawn.endsGame && (
        <p className="warning">⚠️ This ends the game: {winnerLabel(dawn.endsGame)}.</p>
      )}

      <button type="button" className="btn btn-primary" onClick={() => session.send({ type: 'reveal' })}>
        Reveal
      </button>
    </section>
  )
}

// ---------- Vote ----------

function VotePanel({ session, game, nameOf }: { session: RoomSession; game: GameState; nameOf: NameOf }) {
  const alive = game.players.filter((p) => p.alive)
  const result = game.voteResult
  const votersFor = (id: string) =>
    Object.entries(game.votes).filter(([, target]) => target === id).map(([voter]) => nameOf(voter))
  const notVoted = alive.filter((p) => !game.votes[p.id])

  return (
    <section className="stack">
      <ul className="list">
        {alive.map((p) => {
          const voters = votersFor(p.id)
          return (
            <li key={p.id}>
              <span>{p.name}</span>
              <span className="pick-extra">
                {voters.length > 0 && <span className="voters">{voters.join(', ')}</span>}
                <span className="vote-count">{voters.length || ''}</span>
              </span>
            </li>
          )
        })}
        <li>
          <span>Abstain</span>
          <span className="pick-extra">
            <span className="voters">
              {[...votersFor(ABSTAIN), notVoted.length ? `${notVoted.length} not voted` : ''].filter(Boolean).join(', ')}
            </span>
            <span className="vote-count">{votersFor(ABSTAIN).length + notVoted.length || ''}</span>
          </span>
        </li>
      </ul>

      {!result ? (
        <>
          {notVoted.length > 0 && <p className="summary">Not voted yet: {notVoted.map((p) => p.name).join(', ')}</p>}
          <button type="button" className="btn btn-primary" onClick={() => session.send({ type: 'closeVote' })}>
            Close the vote
          </button>
        </>
      ) : (
        <>
          <p className="summary">
            {result.eliminatedId
              ? `${nameOf(result.eliminatedId)} will be eliminated: ${result.counts[result.eliminatedId]} votes to ${result.abstain} abstaining.`
              : 'Nobody will be eliminated (a tie, or Abstain had the most).'}
          </p>
          {result.endsGame && <p className="warning">⚠️ This ends the game: {winnerLabel(result.endsGame)}.</p>}
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => session.send({ type: 'revealVote' })}>
              Reveal vote
            </button>
            <button type="button" className="btn" onClick={() => session.send({ type: 'reopenVote' })}>
              Reopen the vote
            </button>
          </div>
        </>
      )}
    </section>
  )
}

// ---------- Screen ----------

function headingFor(game: GameState): { title: string; subtext: string } {
  const alive = game.players.filter((p) => p.alive)
  switch (game.phase) {
    case 'day':
      return game.round === 1
        ? { title: 'Introductions', subtext: 'No vote today. Start the night when everyone has checked their role.' }
        : { title: 'Discuss', subtext: 'Let the town talk, then start the vote.' }
    case 'night': {
      const chosen = alive.filter((p) => game.nightPicks[p.id]).length
      return { title: 'Night falls', subtext: `${chosen} of ${alive.length} have chosen.` }
    }
    case 'dawn':
      return { title: 'Tell the story', subtext: 'Here’s what happened. Press Reveal when you’re ready.' }
    case 'vote': {
      const voted = alive.filter((p) => game.votes[p.id]).length
      return game.voteResult
        ? { title: 'The town votes', subtext: 'The vote is closed. Build the suspense, then reveal.' }
        : { title: 'The town votes', subtext: `${voted} of ${alive.length} have voted.` }
    }
    default:
      return { title: '', subtext: '' }
  }
}

// The narrator's dashboard once roles are dealt.
export function NarratorGame({ session, state, game }: Props) {
  const names = new Map(game.players.map((p) => [p.id, p.name]))
  const nameOf: NameOf = (id) => (id ? names.get(id) ?? 'someone' : 'nobody')

  if (game.phase === 'ended' && game.winner) {
    return (
      <div className="room">
        <RoomHeader code={state.code} />
        <GameOver winner={game.winner} players={game.players.map((p) => ({ ...p, roleId: p.roleId ?? '' }))} />
        <LeaveButton label="Close room" warning="Everyone will be sent back to the start." onConfirm={session.leave} />
      </div>
    )
  }

  const { title, subtext } = headingFor(game)
  const dayButton = nextPhaseLabel(game.phase, game.round)

  return (
    <div className="room">
      <RoomHeader code={state.code} />

      {state.error && <ErrorBanner message={state.error.message} onDismiss={session.dismissError} />}

      <ScreenHeading label={`${phaseLabel(game.phase, game.round)} · Narrator`} title={title} subtext={subtext} />

      {game.phase === 'day' && game.lastNight && (
        <p className="summary">{lastNightText(game.lastNight.deaths, nameOf)}</p>
      )}
      {game.phase === 'night' && game.lastVote && (
        <p className="summary">{lastVoteText(game.lastVote.eliminatedId, nameOf)}</p>
      )}

      {dayButton && (
        <button type="button" className="btn btn-primary" onClick={() => session.send({ type: 'advance' })}>
          {dayButton}
        </button>
      )}
      {game.phase === 'night' && <NightPanel session={session} game={game} nameOf={nameOf} />}
      {game.phase === 'dawn' && <DawnPanel session={session} game={game} nameOf={nameOf} />}
      {game.phase === 'vote' && <VotePanel session={session} game={game} nameOf={nameOf} />}

      <section className="stack">
        <p className="section-label">The deal</p>
        <Deal game={game} />
      </section>

      <NarratorTools session={session} game={game} nameOf={nameOf} />

      <LeaveButton label="Close room" warning="This ends the game for everyone." onConfirm={session.leave} />
    </div>
  )
}
