import { useState } from 'react'
import { validateSetup, MIN_PLAYERS, REPEATABLE, type GameState } from '../../engine'
import { AVAILABLE_ROLES } from '../../roles'
import { RoomHeader, ErrorBanner } from '../components/RoomHeader'
import { countRoles, withRoleCount, fillWithVillagers, joinLink } from '../helpers'
import type { InRoomState, RoomSession } from '../roomSession'
import { LeaveButton } from '../components/LeaveButton'
import { isTestMode } from '../testMode'
import { FACTIONS, INFO } from '../../roles/info'
import { RoleSheet } from '../roles/RoleSheet'

interface Props {
  session: RoomSession
  state: InRoomState
  game: GameState
}

export function HostLobby({ session, state, game }: Props) {
  const [copied, setCopied] = useState(false)
  const [infoFor, setInfoFor] = useState<string | null>(null)
  const counts = countRoles(game.roleSlots)
  const problems = validateSetup(game)
  const link = joinLink(state.code, window.location, isTestMode && !import.meta.env.DEV)

  function setCount(roleId: string, count: number) {
    session.send({ type: 'setRoleSlots', slots: withRoleCount(game.roleSlots, roleId, count) })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked; the link is also shown on screen.
    }
  }

  // Test mode only: pretend players, so you can test with fewer tabs.
  function addTestPlayers(count: number) {
    const names = ['Ana', 'Ben', 'Cal', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jon', 'Kit', 'Lou']
    const taken = new Set(game.players.map((p) => p.name.toLowerCase()))
    names
      .filter((n) => !taken.has(n.toLowerCase()))
      .slice(0, count)
      .forEach((name) => session.send({ type: 'addPlayer', id: `test-${name.toLowerCase()}`, name }))
  }
  const toMinimum = Math.max(0, MIN_PLAYERS - game.players.length)

  return (
    <div className="room room-wide">
      <RoomHeader code={state.code} />

      {state.error && <ErrorBanner message={state.error.message} onDismiss={session.dismissError} />}

      <section className="panel stack">
        <p className="section-label">Room code</p>
        <p className="big-code">{state.code}</p>
        <p className="hint">Players open this site and join with the code, or use the link.</p>
        <div className="row">
          <button type="button" className="btn btn-small" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy join link'}
          </button>
          {isTestMode && toMinimum > 0 && (
            <button type="button" className="btn btn-small btn-quiet" onClick={() => addTestPlayers(toMinimum)}>
              Fill to {MIN_PLAYERS} with test players
            </button>
          )}
          {isTestMode && (
            <button type="button" className="btn btn-small btn-quiet" onClick={() => addTestPlayers(1)}>
              + 1 test player
            </button>
          )}
        </div>
      </section>

      <section className="stack">
        <div className="section-head">
          <p className="section-label">Players</p>
          <span className="hint">
            {game.players.length} joined · {MIN_PLAYERS} minimum
          </span>
        </div>
        {game.players.length === 0 ? (
          <p className="waiting">Waiting for players to join…</p>
        ) : (
          <ul className="list">
            {game.players.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => session.send({ type: 'removePlayer', id: p.id })}
                  aria-label={`Remove ${p.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack picker-section">
        <div className="section-head">
          <p className="section-label">Roles</p>
          <span className="hint">
            {game.roleSlots.length} of {game.players.length} chosen
          </span>
        </div>
        <div className="picker-factions">
          {FACTIONS.map((faction) => {
            const roles = AVAILABLE_ROLES.filter((r) => INFO[r.id]?.faction === faction.id)
            if (roles.length === 0) return null
            const groups = [null, ...faction.categories.map((c) => c.name)]
              .map((category) => ({ category, roles: roles.filter((r) => (INFO[r.id]?.category ?? null) === category) }))
              .filter((g) => g.roles.length > 0)
            return (
              <div key={faction.id} className="stack picker-faction">
                <h3 className={`picker-faction-title team-${faction.id}`}>{faction.name}</h3>
                {groups.map((group) => (
                  <div key={group.category ?? 'none'} className="stack picker-group">
                    {group.category && <p className="section-label">{group.category}</p>}
                    <ul className="list">
                      {group.roles.map((role) => {
                        const count = counts[role.id] ?? 0
                        const unique = !REPEATABLE.has(role.id)
                        return (
                          <li key={role.id} className="role-row">
                            <div>
                              <button type="button" className="role-name-btn" onClick={() => setInfoFor(role.id)}>
                                {role.name}
                              </button>
                              <p className="hint">{INFO[role.id]?.ability ?? role.description}</p>
                              {role.id === 'serial-killer' && <p className="hint">Recommended for 9+ players.</p>}
                            </div>
                            <div className="stepper">
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => setCount(role.id, count - 1)}
                                disabled={count === 0}
                                aria-label={`One fewer ${role.name}`}
                              >
                                −
                              </button>
                              <span className="stepper-count" aria-label={`${count} ${role.name}`}>
                                {count}
                              </span>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => setCount(role.id, count + 1)}
                                disabled={unique && count >= 1}
                                aria-label={`One more ${role.name}`}
                              >
                                +
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        {game.roleSlots.length < game.players.length && (
          <button
            type="button"
            className="btn btn-small"
            onClick={() =>
              session.send({
                type: 'setRoleSlots',
                slots: fillWithVillagers(game.roleSlots, game.players.length),
              })
            }
          >
            Fill the rest with Villagers
          </button>
        )}
      </section>

      <section className="stack">
        {problems.length > 0 && (
          <ul className="problems">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={problems.length > 0}
          onClick={() => session.send({ type: 'deal' })}
        >
          Deal roles
        </button>
        <LeaveButton label="Close room" warning="Everyone in the lobby will be sent back to the start." onConfirm={session.leave} />
      </section>

      {infoFor && <RoleSheet roleId={infoFor} onClose={() => setInfoFor(null)} />}
    </div>
  )
}
