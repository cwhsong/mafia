import type { Team } from '../../engine'
import { ROLES } from '../../roles'
import { winnerLabel } from '../helpers'

interface RevealedPlayer {
  id: string
  name: string
  alive: boolean
  roleId: string
}

interface Props {
  winner: Team
  players: RevealedPlayer[]
  meId?: string
  subtext?: string | null
}

// Shown to everyone when the game ends: the winner, then every role revealed.
export function GameOver({ winner, players, meId, subtext }: Props) {
  return (
    <>
      <section className="stack">
        <p className="section-label">Game over</p>
        <h1 className={`room-title team-${winner}`}>{winnerLabel(winner)}.</h1>
        {subtext && <p className="muted">{subtext}</p>}
      </section>

      <section className="stack">
        <p className="section-label">Everyone’s roles</p>
        <ul className="list">
          {players.map((p) => {
            const role = ROLES[p.roleId]
            return (
              <li key={p.id}>
                <span>
                  <span className={p.alive ? '' : 'is-dead'}>{p.name}</span>
                  {p.id === meId && <span className="you"> (you)</span>}
                </span>
                <span className={`team-tag team-${role?.team}`}>{role?.name}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
