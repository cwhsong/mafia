import { useState } from 'react'
import { ABSTAIN, type FakeMessage, type PlayerView, type PrivateResult } from '../../engine'
import { ROLES } from '../../roles'
import { RoomHeader, ErrorBanner } from '../components/RoomHeader'
import { LeaveButton } from '../components/LeaveButton'
import { RoleCard } from '../components/RoleCard'
import { GameOver } from '../components/GameOver'
import { ScreenHeading } from '../components/ScreenHeading'
import { PickList, type PickOption } from '../components/PickList'
import { SeatTable, TableCenter, type Pointer, type Seat } from '../components/SeatTable'
import { usePick } from '../usePick'
import { RoleSheet } from '../roles/RoleSheet'
import { phaseLabel } from '../helpers'
import {
  ACTION_VERB, FAKE_LABEL, buildLog, gameOverSubtext, lastNightText, lastVoteText, messageText, nightSubtext, publicEntryText, rosterNotes,
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
          : view.night.choice === 'kill' && view.me?.roleId !== 'godfather' && view.teammates.some((t) => t.alive && t.roleId === 'godfather')
            ? 'Suggest a kill. The Godfather has the final say.'
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

  // Only people you can pick sit at the table tonight
  const familyPicks = [...night.teamPicks, ...night.teamActions]
  const seats: Seat[] = view.players
    .filter((p) => night.targets.includes(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      me: p.id === me.id,
      tags: familyPicks.filter((t) => t.targetId === p.id).map((t) => t.name),
    }))

  const needsOption = night.choice === 'hypnotize'
  const target = pick.pending ?? night.myPick
  const optionChanged = night.myPick !== null && !pick.pending && option !== night.myOption
  const verb = option === 'execute' ? 'execute' : ACTION_VERB[night.choice]
  const godfather = view.teammates.find((t) => t.alive && t.roleId === 'godfather')
  const suggesting = night.choice === 'kill' && godfather && me.roleId !== 'godfather'

  function send(targetId: string) {
    const chosen = option && night.options.includes(option) ? option : undefined
    session.send({ type: 'submitAction', playerId: me.id, targetId, ...(chosen ? { option: chosen } : {}) })
    pick.clear()
  }

  const tone = night.choice === 'kill' && view.teammates.length ? 'mafia' : undefined
  const center = pick.pending ? (
    <TableCenter label={verb.toUpperCase()} name={`${nameOf(pick.pending)}?`} note="not confirmed yet" tone={tone} />
  ) : night.myPick ? (
    <TableCenter label={verb.toUpperCase()} name={nameOf(night.myPick)} note="locked in" tone={tone ?? 'dawn'} />
  ) : (
    <TableCenter label={verb.toUpperCase()} note={suggesting ? `${godfather.name}’s mark is final` : 'Tap someone'} tone={tone} />
  )

  return (
    <section className="stack">
      <FamilyStrip view={view} />
      {passive && <p className="hint">Your ability works on its own tonight. Make a pick anyway, so nobody can tell.</p>}
      {usesLine && <p className="hint">{usesLine}</p>}
      {seats.length === 0 ? (
        <p className="hint">Nobody to choose yet.</p>
      ) : (
        <SeatTable
          seats={seats}
          pendingId={pick.pending}
          confirmedId={night.myPick}
          onTap={pick.toggle}
          center={center}
          label={`Choose who to ${ACTION_VERB[night.choice]}`}
        />
      )}

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

      <div className="confirm-bar">
        {night.myPick && !pick.pending && <p className="hint">You can change this until the narrator ends the night.</p>}
        {night.myPick && pick.pending && <p className="hint">Your pick: {nameOf(night.myPick)}</p>}
        {pick.pending && (!needsOption || option) && (
          <button type="button" className={`btn ${option === 'execute' ? 'btn-danger' : 'btn-primary'}`} onClick={() => send(pick.pending!)}>
            {night.myPick
              ? `Confirm: switch to ${nameOf(pick.pending)}`
              : `Confirm: ${suggesting ? 'suggest' : verb} ${nameOf(pick.pending)}`}
          </button>
        )}
        {optionChanged && (
          <button type="button" className="btn btn-primary" onClick={() => send(night.myPick!)}>
            Update choice
          </button>
        )}
      </div>
    </section>
  )
}

// The Mafia's names and roles, above the night table.
function FamilyStrip({ view }: { view: PlayerView }) {
  const family = view.teammates.filter((t) => t.alive)
  if (family.length === 0) return null
  return (
    <div className="family-strip">
      <p className="section-label team-mafia">Your family</p>
      <div className="family-chips">
        {family.map((t) => (
          <span key={t.id} className="family-chip">
            {t.name} · {ROLES[t.roleId]?.name}
          </span>
        ))}
      </div>
    </div>
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

  // A revealed Mayor's vote counts three times
  const weightOf = (voter: string) => (voter === view.mayorId ? 3 : 1)
  const weight = (id: string) =>
    Object.entries(vote.votes).filter(([, target]) => target === id).reduce((n, [voter]) => n + weightOf(voter), 0)

  const alive = view.players.filter((p) => p.alive)
  const seats: Seat[] = alive.map((p) => ({
    id: p.id,
    name: p.name,
    me: p.id === me?.id,
    disabled: !vote.options.includes(p.id),
    top: weight(p.id) ? String(weight(p.id)) : undefined,
  }))
  const pointers: Pointer[] = Object.entries(vote.votes)
    .filter(([, target]) => target !== ABSTAIN)
    .map(([from, to]) => ({ from, to, mine: from === me?.id }))

  const totals = alive.map((p) => ({ id: p.id, n: weight(p.id) })).filter((t) => t.n > 0)
  const most = Math.max(0, ...totals.map((t) => t.n))
  const leaders = totals.filter((t) => t.n === most)
  const totalVotes = alive.reduce((n, p) => n + weightOf(p.id), 0)
  const center =
    leaders.length === 0 ? (
      <TableCenter label="NO VOTES YET" note="Tap a seat to vote" />
    ) : leaders.length === 1 ? (
      <TableCenter label="LEADING" name={nameOf(leaders[0].id)} note={`${most} of ${totalVotes} votes`} />
    ) : (
      <TableCenter label="TIED" name={leaders.map((l) => nameOf(l.id)).join(' · ')} note={`${most} votes each`} />
    )

  function confirm() {
    if (!pick.pending || !me) return
    session.send({ type: 'castVote', playerId: me.id, targetId: pick.pending })
    pick.clear()
  }

  const choiceName = (id: string) => (id === ABSTAIN ? 'abstain' : nameOf(id))
  const abstainOn = pick.pending === ABSTAIN || (!pick.pending && vote.myVote === ABSTAIN)

  return (
    <section className="stack">
      <SeatTable
        seats={seats}
        pendingId={pick.pending}
        confirmedId={vote.myVote}
        onTap={pick.toggle}
        center={center}
        pointers={pointers}
        locked={!canVote}
        label="Vote"
      />
      <div className="abstain-row">
        <button
          type="button"
          className={`abstain ${abstainOn ? (pick.pending === ABSTAIN ? 'is-pending' : 'is-confirmed') : ''}`}
          onClick={() => pick.toggle(ABSTAIN)}
          disabled={!canVote || !vote.options.includes(ABSTAIN)}
          aria-pressed={abstainOn}
        >
          Abstain <span className="abstain-count">{weight(ABSTAIN)}</span>
        </button>
        <span className="hint">{vote.notVoted.length} not voted</span>
      </div>
      <div className="confirm-bar">
        {vote.myVote && <p className="hint">Your vote: {choiceName(vote.myVote)}</p>}
        {!vote.myVote && !pick.pending && canVote && <p className="hint">You haven’t voted yet. Not voting counts as abstaining.</p>}
        {canVote && pick.pending && (
          <button type="button" className="btn btn-primary" onClick={confirm}>
            {vote.myVote
              ? pick.pending === ABSTAIN
                ? 'Confirm: switch to abstain'
                : `Confirm: switch vote to ${nameOf(pick.pending)}`
              : pick.pending === ABSTAIN
                ? 'Confirm: abstain'
                : `Confirm: vote for ${nameOf(pick.pending)}`}
          </button>
        )}
      </div>
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
      <div className="log-key" aria-hidden="true">
        <span><span className="log-key-public" />Everyone knows</span>
        <span><span className="log-key-private" />Only you know</span>
      </div>
      <div className="ledger">
        {sections.map((section) => (
          <div key={section.heading} className="ledger-row">
            <p className="ledger-when" aria-label={section.heading}>
              <span className={`ledger-word ${section.night ? 'is-night' : 'is-day'}`}>{section.night ? 'Night' : 'Day'}</span>
              <span className="ledger-num">{section.round}</span>
            </p>
            <div className="ledger-lines">
              {section.lines.map((line, i) => (
                <p key={i} className={line.private ? 'log-private' : 'log-public'}>
                  {line.text}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Everyone in the game, with what you know about them. Information only: picking
// happens on the table. The dead fade to the bottom but keep their notes.
function AtTheTable({ view }: { view: PlayerView }) {
  const notes = rosterNotes(view)
  const ordered = [...view.players.filter((p) => p.alive), ...view.players.filter((p) => !p.alive)]
  return (
    <section className="stack">
      <div className="section-head">
        <p className="section-label">At the table</p>
        <span className="hint">{view.players.filter((p) => p.alive).length} still in</span>
      </div>
      <ul className="roster">
        {ordered.map((p) => (
          <li key={p.id} className={`roster-row ${p.alive ? '' : 'is-gone'} ${p.id === view.me?.id ? 'is-me' : ''}`}>
            <span className="roster-disc" aria-hidden="true">{p.name[0]}</span>
            <span className="roster-text">
              <span className="roster-name">
                {p.name}
                {p.id === view.me?.id && <span className="you"> (you)</span>}
                {!p.alive && <span className="visually-hidden"> (out)</span>}
              </span>
              {(notes.get(p.id) ?? []).map((n) => (
                <span key={n.text} className={`roster-note ${n.private ? 'is-private' : ''} ${n.tone ? `tone-${n.tone}` : ''}`}>
                  {n.text}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
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

  const isDayOne = view.phase === 'day' && view.round === 1
  const canRevealMayor =
    roleId === 'mayor' && Boolean(me?.alive) && !view.mayorId && (view.phase === 'day' || view.phase === 'vote')

  const roleSection = roleId ? (
    <section className="stack">
      {!isDayOne && <p className="section-label">Your role</p>}
      <RoleCard
        roleId={roleId}
        faceUp={faceUp}
        onToggle={() => setFaceUp((up) => !up)}
        onDetails={() => setDetailsOpen(true)}
      />
      <p className="hint role-card-hint">
        {faceUp ? 'Tap the card to hide it again.' : 'Make sure nobody is looking, then tap.'}
      </p>
      {detailsOpen && <RoleSheet roleId={roleId} onClose={() => setDetailsOpen(false)} />}
      {faceUp && view.nemesisTarget && (
        <p className="summary">Your target: {nameOf(view.nemesisTarget)}. Get them voted out.</p>
      )}
    </section>
  ) : (
    <p className="muted">You’re watching this game.</p>
  )

  const table = <AtTheTable view={view} />

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
          {table}
          {roleSection}
        </>
      )}

      <LeaveButton label="Leave room" warning="You can rejoin with the room code." onConfirm={session.leave} />
    </div>
  )
}
