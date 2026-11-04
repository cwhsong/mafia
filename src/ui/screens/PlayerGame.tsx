import { useState } from 'react'
import { ABSTAIN, type FakeMessage, type PlayerView, type PrivateResult } from '../../engine'
import { ROLES } from '../../roles'
import { RoomHeader, ErrorBanner } from '../components/RoomHeader'
import { LeaveButton } from '../components/LeaveButton'
import { RoleCard } from '../components/RoleCard'
import { GameOver } from '../components/GameOver'
import { ScreenHeading } from '../components/ScreenHeading'
import { PickList, Stamp, type PickOption } from '../components/PickList'
import { usePick } from '../usePick'
import { RoleSheet } from '../roles/RoleSheet'
import { phaseLabel } from '../helpers'
import {
  ACTION_VERB, FAKE_LABEL, buildLog, gameOverSubtext, lastNightText, lastVoteText, messageText, nightSubtext, publicEntryText,
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
  if (view.revenge?.kind === 'avenger') {
    return { title: 'Your last act', subtext: 'You’re out, but you can take someone with you.' }
  }
  if (view.night?.choice === 'revenge') {
    return { title: 'The last laugh', subtext: nightSubtext('revenge') }
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

const USE_WORD: Partial<Record<string, [string, string]>> = {
  kill: ['bullet', 'bullets'],
  alert: ['alert', 'alerts'],
  vest: ['vest', 'vests'],
  remember: ['use', 'uses'],
}

function NightAction({ session, view, nameOf }: { session: RoomSession; view: PlayerView; nameOf: NameOf }) {
  const night = view.night!
  const me = view.me!
  const pick = usePick(night.myPick)
  const [option, setOption] = useState<string | null>(night.myOption)
  const teammateIds = new Set(view.teammates.map((t) => t.id))
  const passive = me.roleId ? ROLES[me.roleId]?.night?.target === 'none' : false
  const words = USE_WORD[night.choice]
  const usesLine =
    night.usesLeft !== null && words ? `${night.usesLeft} ${night.usesLeft === 1 ? words[0] : words[1]} left.` : null

  // An on/off ability (Veteran's alert, Survivor's vest)
  if (night.choice === 'alert' || night.choice === 'vest') {
    const on = night.myPick === me.id
    const label = night.choice === 'alert' ? 'Go on alert tonight' : 'Wear a vest tonight'
    return (
      <section className="stack">
        {usesLine && <p className="hint">{usesLine} Using it counts once the night ends.</p>}
        {on ? (
          <>
            <p className="summary">{night.choice === 'alert' ? 'You’re on alert tonight. ✓' : 'You’re wearing a vest tonight. ✓'}</p>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => session.send({ type: 'clearAction', playerId: me.id })}>
              {night.choice === 'alert' ? 'Stay home instead' : 'Save the vest instead'}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => session.send({ type: 'submitAction', playerId: me.id, targetId: me.id })}>
            {label}
          </button>
        )}
      </section>
    )
  }

  // Revenge and picks among the dead list only who can be chosen
  const onlyTargets = night.choice === 'revenge' || night.choice === 'examine' || night.choice === 'remember'
  const listed = onlyTargets ? view.players.filter((p) => night.targets.includes(p.id)) : view.players
  const options: PickOption[] = listed.map((p) => ({
    id: p.id,
    label: p.name,
    dead: !p.alive && night.choice !== 'examine' && night.choice !== 'remember',
    disabled: !night.targets.includes(p.id),
    note: p.id === me.id ? 'you' : teammateIds.has(p.id) ? 'Mafia' : !p.alive ? 'out' : p.id === view.mayorId ? 'Mayor' : undefined,
    extra:
      night.choice === 'kill' ? (
        <span className="pick-extra">
          {night.teamPicks
            .filter((t) => t.targetId === p.id)
            .map((t) => (
              <Stamp key={t.playerId} name={t.name} />
            ))}
        </span>
      ) : undefined,
  }))

  const needsOption = night.choice === 'hypnotize'
  const target = pick.pending ?? night.myPick
  const optionChanged = night.myPick !== null && !pick.pending && option !== night.myOption

  function send(targetId: string) {
    const chosen = option && night.options.includes(option) ? option : undefined
    session.send({ type: 'submitAction', playerId: me.id, targetId, ...(chosen ? { option: chosen } : {}) })
    pick.clear()
  }

  return (
    <section className="stack">
      {passive && <p className="hint">Your ability works on its own tonight. Make a pick anyway, so nobody can tell.</p>}
      {usesLine && <p className="hint">{usesLine}</p>}
      {night.killMark && <p className="section-label">Your ability</p>}
      {onlyTargets && options.length === 0 && <p className="hint">Nobody to choose yet.</p>}
      <PickList options={options} selectedIds={pick.selectedIds} confirmedId={night.myPick} onToggle={pick.toggle} />

      {target && night.options.length > 0 && night.choice === 'jail' && (
        <label className="check-row">
          <input type="checkbox" checked={option === 'execute'} onChange={(e) => setOption(e.target.checked ? 'execute' : null)} />
          Execute {nameOf(target)} (once a game; it can’t be stopped)
        </label>
      )}
      {target && needsOption && (
        <div className="stack">
          <p className="section-label">Memory to plant</p>
          <div className="chips">
            {night.options.map((o) => (
              <button key={o} type="button" className={`chip ${option === o ? 'is-on' : ''}`} onClick={() => setOption(o)} aria-pressed={option === o}>
                {FAKE_LABEL[o as FakeMessage]}
              </button>
            ))}
          </div>
        </div>
      )}

      {pick.pending && (!needsOption || option) && (
        <button type="button" className={`btn ${option === 'execute' ? 'btn-danger' : 'btn-primary'}`} onClick={() => send(pick.pending!)}>
          {night.myPick
            ? `Switch to ${nameOf(pick.pending)}`
            : `Confirm: ${option === 'execute' ? 'execute' : ACTION_VERB[night.choice]} ${nameOf(pick.pending)}`}
        </button>
      )}
      {optionChanged && (
        <button type="button" className="btn btn-primary" onClick={() => send(night.myPick!)}>
          Update choice
        </button>
      )}

      {night.killMark && <KillMark session={session} view={view} nameOf={nameOf} />}
      {night.teamActions.length > 0 && (
        <div className="panel stack">
          <p className="section-label team-mafia">Your family tonight</p>
          {night.teamActions.map((t) => (
            <p key={t.playerId} className="hint">
              {t.name} ({ROLES[t.roleId]?.name}) → {nameOf(t.targetId)}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}

// Mafia support members mark who the family should kill, alongside their own ability.
function KillMark({ session, view, nameOf }: { session: RoomSession; view: PlayerView; nameOf: NameOf }) {
  const night = view.night!
  const mark = night.killMark!
  const me = view.me!
  const pick = usePick(mark.myMark)
  const options: PickOption[] = view.players
    .filter((p) => p.alive && !view.teammates.some((t) => t.id === p.id) && p.id !== me.id)
    .map((p) => ({
      id: p.id,
      label: p.name,
      disabled: !mark.targets.includes(p.id),
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
  return (
    <section className="stack">
      <p className="section-label team-mafia">Who should the family kill?</p>
      <p className="hint">The Godfather’s mark is final; without him, the most-marked player is killed.</p>
      <PickList options={options} selectedIds={pick.selectedIds} confirmedId={mark.myMark} onToggle={pick.toggle} />
      {pick.pending && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            session.send({ type: 'markKill', playerId: me.id, targetId: pick.pending })
            pick.clear()
          }}
        >
          {mark.myMark ? `Switch mark to ${nameOf(pick.pending)}` : `Mark ${nameOf(pick.pending)}`}
        </button>
      )}
    </section>
  )
}

// An Avenger who just died chooses who to take with them.
function AvengerPrompt({ session, view, nameOf }: { session: RoomSession; view: PlayerView; nameOf: NameOf }) {
  const revenge = view.revenge!
  const me = view.me!
  const pick = usePick(null)
  const options: PickOption[] = view.players
    .filter((p) => revenge.options.includes(p.id))
    .map((p) => ({ id: p.id, label: p.name }))
  return (
    <section className="panel stack">
      <p className="section-label">Your last act</p>
      <p>Take someone down with you, or let it go. Everyone is waiting on you.</p>
      <PickList options={options} selectedIds={pick.selectedIds} onToggle={pick.toggle} />
      {pick.pending && (
        <button type="button" className="btn btn-danger" onClick={() => session.send({ type: 'takeRevenge', playerId: me.id, targetId: pick.pending })}>
          Take {nameOf(pick.pending)} with you
        </button>
      )}
      <button type="button" className="btn btn-small btn-quiet" onClick={() => session.send({ type: 'takeRevenge', playerId: me.id, targetId: null })}>
        Let it go
      </button>
    </section>
  )
}

// A Mayor reveals themselves during the day; it's public and can't be undone.
function MayorReveal({ session, view }: { session: RoomSession; view: PlayerView }) {
  const [confirming, setConfirming] = useState(false)
  const me = view.me!
  if (!confirming) {
    return (
      <button type="button" className="btn btn-small" onClick={() => setConfirming(true)}>
        Reveal yourself as Mayor
      </button>
    )
  }
  return (
    <div className="panel stack">
      <p>Everyone will see you’re the Mayor, and your vote will count three times. The Medic can’t protect you after this.</p>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => session.send({ type: 'revealMayor', playerId: me.id })}>
          Yes, reveal
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------- Vote ----------

function VoteAction({ session, view, nameOf }: { session: RoomSession; view: PlayerView; nameOf: NameOf }) {
  const vote = view.vote!
  const me = view.me
  const pick = usePick(vote.myVote)
  const canVote = Boolean(me?.alive) && !vote.closed

  const votersFor = (id: string) =>
    Object.entries(vote.votes).filter(([, target]) => target === id).map(([voter]) => nameOf(voter) + (voter === view.mayorId ? ' ×3' : ''))
  // A revealed Mayor's vote counts three times
  const weight = (id: string) =>
    Object.entries(vote.votes).filter(([, target]) => target === id).reduce((n, [voter]) => n + (voter === view.mayorId ? 3 : 1), 0)

  const playerOptions: PickOption[] = view.players
    .filter((p) => p.alive)
    .map((p) => {
      const voters = votersFor(p.id)
      return {
        id: p.id,
        label: p.name,
        disabled: !vote.options.includes(p.id),
        note: p.id === me?.id ? 'you' : p.id === view.mayorId ? 'Mayor' : undefined,
        extra: (
          <span className="pick-extra">
            {voters.length > 0 && <span className="voters">{voters.join(', ')}</span>}
            <span className="vote-count">{weight(p.id) || ''}</span>
          </span>
        ),
      }
    })

  const abstainers = votersFor(ABSTAIN)
  const abstainTotal = weight(ABSTAIN) + vote.notVoted.reduce((n, id) => n + (id === view.mayorId ? 3 : 1), 0)
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
  const [detailsOpen, setDetailsOpen] = useState(false)
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
          subtext={gameOverSubtext(me ? (view.winners ?? []).includes(me.id) : null)}
          winners={view.winners ?? []}
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
  const canRevealMayor =
    roleId === 'mayor' && Boolean(me?.alive) && !view.mayorId && (view.phase === 'day' || view.phase === 'vote')

  const roleSection = roleId ? (
    <section className="stack">
      {!isDayOne && <p className="section-label">Your role</p>}
      <RoleCard roleId={roleId} faceUp={faceUp} onToggle={() => setFaceUp((up) => !up)} />
      <p className="hint" style={{ textAlign: 'center' }}>
        {faceUp ? 'Tap the card to hide it again.' : 'Make sure nobody is looking, then tap.'}
      </p>
      {faceUp && (
        <button type="button" className="btn btn-small btn-quiet" onClick={() => setDetailsOpen(true)}>
          More details
        </button>
      )}
      {detailsOpen && <RoleSheet roleId={roleId} onClose={() => setDetailsOpen(false)} />}
      {faceUp && view.nemesisTarget && (
        <p className="summary">Your target: {nameOf(view.nemesisTarget)}. Get them voted out.</p>
      )}
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
            {p.id === view.mayorId && <span className="team-tag team-town">Mayor</span>}
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
          {view.revenge?.kind === 'avenger' && <AvengerPrompt session={session} view={view} nameOf={nameOf} />}
          {view.blackmailed && <p className="warning">You’re blackmailed: don’t speak today. You can still vote.</p>}
          {canRevealMayor && <MayorReveal session={session} view={view} />}
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
