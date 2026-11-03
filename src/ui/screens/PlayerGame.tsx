import { useState } from 'react'
import { ABSTAIN, type PlayerView, type PrivateResult } from '../../engine'
import { ROLES } from '../../roles'
import { RoomHeader, ErrorBanner } from '../components/RoomHeader'
import { LeaveButton } from '../components/LeaveButton'
import { RoleCard } from '../components/RoleCard'
import { GameOver } from '../components/GameOver'
import { ScreenHeading } from '../components/ScreenHeading'
import { PickList, Stamp, type PickOption } from '../components/PickList'
import { usePick } from '../usePick'
import { phaseLabel, teamOf } from '../helpers'
import {
  ACTION_VERB, buildLog, gameOverSubtext, lastNightText, lastVoteText, messageText, nightSubtext, publicEntryText,
} from '../text'
import type { InRoomState, RoomSession } from '../roomSession'

interface Props {
  session: RoomSession
  state: InRoomState
  view: PlayerView
}

type NameOf = (id: string | null | undefined) => string

function useNames(view: PlayerView): NameOf {
  const names = new Map(view.players.map((p) => [p.id, p.name]))
  return (id) => (id ? names.get(id) ?? 'someone' : 'nobody')
}

// ---------- Heading ----------

function heading(view: PlayerView): { title: string; subtext: string } {
  if (view.phase === 'finale') {
    return { title: 'Daybreak.', subtext: 'The narrator will tell how it ends.' }
  }
  if (view.me && !view.me.alive) {
    return {
      title: 'You were eliminated',
      subtext: 'Stay quiet and watch the rest of the game. Your role stays secret until the end.',
    }
  }
  switch (view.phase) {
    case 'day':
      return view.round === 1
        ? { title: 'Introduce yourselves', subtext: 'Check your role, then say hello. There’s no vote on Day 1.' }
        : { title: 'Discuss', subtext: 'Who do you trust? Who’s lying? The vote comes next.' }
    case 'night':
      return {
        title: 'Night falls',
        subtext: !view.night
          ? 'Close your eyes and follow the narrator.'
          : view.night.myPick
            ? 'Done. Waiting for everyone else… You can still change your pick.'
            : nightSubtext(view.night.choice),
      }
    case 'dawn':
      return { title: 'Dawn breaks', subtext: 'Listen to the narrator’s story of the night.' }
    case 'vote':
      return {
        title: 'Discuss and vote',
        subtext: view.vote?.closed
          ? 'The vote is closed. Waiting for the narrator…'
          : view.vote?.myVote
            ? 'Vote cast. You can change it until the narrator closes the vote.'
            : 'Talk it through, then vote. You can change your vote until the narrator closes it.',
      }
    default:
      return { title: '', subtext: '' }
  }
}

// ---------- Night ----------

function NightAction({ session, view, nameOf }: { session: RoomSession; view: PlayerView; nameOf: NameOf }) {
  const night = view.night!
  const me = view.me!
  const pick = usePick(night.myPick)
  const teammateIds = new Set(view.teammates.map((t) => t.id))

  const options: PickOption[] = view.players.map((p) => ({
    id: p.id,
    label: p.name,
    dead: !p.alive,
    disabled: !night.targets.includes(p.id),
    note: p.id === me.id ? 'you' : teammateIds.has(p.id) ? 'Mafia' : !p.alive ? 'out' : undefined,
    extra: (
      <span className="pick-extra">
        {night.teamPicks
          .filter((t) => t.targetId === p.id)
          .map((t) => (
            <Stamp key={t.playerId} name={t.name} />
          ))}
      </span>
    ),
  }))

  function confirm() {
    if (!pick.pending) return
    session.send({ type: 'submitAction', playerId: me.id, targetId: pick.pending })
    pick.clear()
  }

  return (
    <section className="stack">
      <PickList options={options} selectedIds={pick.selectedIds} confirmedId={night.myPick} onToggle={pick.toggle} />
      {pick.pending && (
        <button type="button" className="btn btn-primary" onClick={confirm}>
          {night.myPick
            ? `Switch to ${nameOf(pick.pending)}`
            : `Confirm: ${ACTION_VERB[night.choice]} ${nameOf(pick.pending)}`}
        </button>
      )}
    </section>
  )
}

// ---------- Vote ----------

function VoteAction({ session, view, nameOf }: { session: RoomSession; view: PlayerView; nameOf: NameOf }) {
  const vote = view.vote!
  const me = view.me
  const pick = usePick(vote.myVote)
  const canVote = Boolean(me?.alive) && !vote.closed

  const votersFor = (id: string) =>
    Object.entries(vote.votes).filter(([, target]) => target === id).map(([voter]) => nameOf(voter))

  const playerOptions: PickOption[] = view.players
    .filter((p) => p.alive)
    .map((p) => {
      const voters = votersFor(p.id)
      return {
        id: p.id,
        label: p.name,
        disabled: !vote.options.includes(p.id),
        note: p.id === me?.id ? 'you' : undefined,
        extra: (
          <span className="pick-extra">
            {voters.length > 0 && <span className="voters">{voters.join(', ')}</span>}
            <span className="vote-count">{voters.length || ''}</span>
          </span>
        ),
      }
    })

  const abstainers = votersFor(ABSTAIN)
  const abstainTotal = abstainers.length + vote.notVoted.length
  const abstainOption: PickOption = {
    id: ABSTAIN,
    label: 'Abstain',
    disabled: !vote.options.includes(ABSTAIN),
    extra: (
      <span className="pick-extra">
        <span className="voters">
          {[...abstainers, vote.notVoted.length ? `${vote.notVoted.length} not voted` : '']
            .filter(Boolean)
            .join(', ')}
        </span>
        <span className="vote-count">{abstainTotal || ''}</span>
      </span>
    ),
  }

  function confirm() {
    if (!pick.pending || !me) return
    session.send({ type: 'castVote', playerId: me.id, targetId: pick.pending })
    pick.clear()
  }

  const choiceName = (id: string) => (id === ABSTAIN ? 'abstain' : nameOf(id))

  return (
    <section className="stack">
      <PickList
        options={[...playerOptions, abstainOption]}
        selectedIds={pick.selectedIds}
        confirmedId={vote.myVote}
        onToggle={pick.toggle}
        locked={!canVote}
      />
      {canVote && pick.pending && (
        <button type="button" className="btn btn-primary" onClick={confirm}>
          {vote.myVote
            ? `Switch to ${choiceName(pick.pending)}`
            : pick.pending === ABSTAIN
              ? 'Confirm: abstain'
              : `Confirm: vote for ${nameOf(pick.pending)}`}
        </button>
      )}
      <p className="hint">Not voting counts as abstaining. Votes are public, like pointing at the table.</p>
    </section>
  )
}

// ---------- Messages ----------

function Messages({ results, nameOf }: { results: PrivateResult[]; nameOf: NameOf }) {
  if (results.length === 0) return null
  return (
    <section className="message" aria-live="polite">
      {results.map((r, i) => (
        <p key={i}>{messageText(r, nameOf)}</p>
      ))}
    </section>
  )
}

function YourLog({ view, nameOf }: { view: PlayerView; nameOf: NameOf }) {
  const sections = buildLog(view.history, view.messages, nameOf)
  if (sections.length === 0) return null
  return (
    <section className="stack">
      <p className="section-label">Your log</p>
      <div className="log">
        {sections.map((section) => (
          <div key={section.heading} className="log-section">
            <p className="log-heading">{section.heading}</p>
            {section.lines.map((line, i) => (
              <p key={i} className={line.private ? 'log-private' : ''}>
                {line.text}
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- Screen ----------

export function PlayerGame({ session, state, view }: Props) {
  const [faceUp, setFaceUp] = useState(false)
  const nameOf = useNames(view)
  const me = view.me
  const roleId = me?.roleId

  if (view.phase === 'ended' && view.winner && view.revealedRoles) {
    const roles = view.revealedRoles
    return (
      <div className="room">
        <RoomHeader code={state.code} />
        <GameOver
          winner={view.winner}
          subtext={gameOverSubtext(teamOf(roleId), view.winner)}
          players={view.players.map((p) => ({ ...p, roleId: roles[p.id] ?? '' }))}
          meId={me?.id}
        />
        <YourLog view={view} nameOf={nameOf} />
        <LeaveButton label="Leave room" onConfirm={session.leave} />
      </div>
    )
  }

  const { title, subtext } = heading(view)
  const thisNight = view.messages.filter((r) => r.round === view.round)
  const showPicker = (view.phase === 'night' && view.night) || view.phase === 'vote'

  const isDayOne = view.phase === 'day' && view.round === 1

  const roleSection = roleId ? (
    <section className="stack">
      {!isDayOne && <p className="section-label">Your role</p>}
      <RoleCard roleId={roleId} faceUp={faceUp} onToggle={() => setFaceUp((up) => !up)} />
      <p className="hint" style={{ textAlign: 'center' }}>
        {faceUp ? 'Tap the card to hide it again.' : 'Make sure nobody is looking, then tap.'}
      </p>
      {faceUp && view.teammates.length > 0 && (
        <div className="panel stack">
          <p className="section-label team-mafia">Your fellow Mafia</p>
          <ul className="list">
            {view.teammates.map((t) => (
              <li key={t.id}>
                <span className={t.alive ? '' : 'is-dead'}>{t.name}</span>
                <span className="team-tag team-mafia">{ROLES[t.roleId]?.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  ) : (
    <p className="muted">You’re watching this game.</p>
  )

  const table = (
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
              {p.id === me?.id && <span className="you"> (you)</span>}
            </span>
            {!p.alive && <span className="hint">out</span>}
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <div className="room">
      <RoomHeader code={state.code} />

      {state.error && <ErrorBanner message={state.error.message} onDismiss={session.dismissError} />}

      <ScreenHeading
        label={view.finale ? phaseLabel(view.finale.fromPhase, view.finale.round) : phaseLabel(view.phase, view.round)}
        title={title}
        subtext={subtext}
      />

      {isDayOne ? (
        // Day 1 is for checking your role, so it comes first
        <>
          {roleSection}
          {table}
          <YourLog view={view} nameOf={nameOf} />
        </>
      ) : (
        // Every other phase: what just happened, then what to do, then the record
        <>
          {view.phase === 'dawn' && <Messages results={thisNight} nameOf={nameOf} />}
          {(view.phase === 'day' || view.phase === 'vote') &&
            view.lastNight &&
            view.lastNight.round === view.round - 1 && (
              <p className="summary">{lastNightText(view.lastNight.deaths, nameOf)}</p>
            )}
          {view.phase === 'finale' && view.history.length > 0 && (
            <p className="summary">{publicEntryText(view.history[view.history.length - 1], nameOf)}</p>
          )}
          {view.phase === 'night' && view.lastVote && (
            <p className="summary">{lastVoteText(view.lastVote.eliminatedId, nameOf)}</p>
          )}

          {view.phase === 'night' && view.night && <NightAction session={session} view={view} nameOf={nameOf} />}
          {view.phase === 'vote' && view.vote && <VoteAction session={session} view={view} nameOf={nameOf} />}

          <YourLog view={view} nameOf={nameOf} />
          {!showPicker && table}
          {roleSection}
        </>
      )}

      <LeaveButton label="Leave room" warning="You can rejoin with the room code." onConfirm={session.leave} />
    </div>
  )
}
