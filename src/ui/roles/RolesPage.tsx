import { FACTIONS, NIGHT_ORDER, ROLE_INFO, TERMS, type RoleInfo } from '../../roles/info'
import { goHome, rolesHref } from '../route'
import { isPlayable } from './playable'
import { RoleSheet } from './RoleSheet'
import './Roles.css'

interface Props {
  openRoleId: string | null
}

function rolesIn(faction: string, category: string | null): RoleInfo[] {
  return ROLE_INFO.filter((r) => r.faction === faction && r.category === category)
}

function RoleTile({ info }: { info: RoleInfo }) {
  const playable = isPlayable(info.id)
  return (
    <a className={`tile faction-${info.faction} ${playable ? '' : 'is-soon'}`} href={rolesHref(info.id)}>
      <span className="tile-art" aria-hidden="true">{info.name[0]}</span>
      <span className="tile-name">{info.name}</span>
      {!playable && <span className="soon">Coming soon</span>}
    </a>
  )
}

// Every role, grouped by faction and category. Tapping a card opens it in full.
export function RolesPage({ openRoleId }: Props) {
  const order = ROLE_INFO.map((r) => r.id)
  const index = openRoleId ? order.indexOf(openRoleId) : -1
  const go = (id: string | null) => {
    window.location.hash = rolesHref(id)
  }

  return (
    <div className="roles-page">
      <nav className="roles-nav">
        <button type="button" className="link-btn" onClick={goHome}>
          ← Mafia: <span className="accent">Daybreak</span>
        </button>
      </nav>

      <header className="stack">
        <p className="eyebrow">The deck</p>
        <h1 className="page-title">Roles</h1>
        <p className="home-lede">
          Every role, what it does, and how it wins. Tap a card for the full rules.
        </p>
      </header>

      <details className="panel terms">
        <summary>Terms every card uses</summary>
        <dl className="terms-list">
          {TERMS.map((t) => (
            <div key={t.term}>
              <dt>{t.term}</dt>
              <dd>{t.meaning}</dd>
            </div>
          ))}
        </dl>
        <p className="section-label">Night order</p>
        <p className="hint">Lower numbers act first. Abilities with the same number land together.</p>
        <ol className="night-order">
          {NIGHT_ORDER.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </details>

      {FACTIONS.map((faction) => {
        const loose = rolesIn(faction.id, null)
        return (
          <section key={faction.id} className={`faction faction-${faction.id}`} aria-labelledby={`f-${faction.id}`}>
            <h2 id={`f-${faction.id}`} className="faction-title">{faction.name}</h2>
            <p className="faction-goal">{faction.goal}</p>
            {faction.rules && (
              <details className="panel faction-rules">
                <summary>{faction.name} Rules</summary>
                <ul>
                  {faction.rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </details>
            )}

            {loose.length > 0 && (
              <div className="tiles">
                {loose.map((r) => (
                  <RoleTile key={r.id} info={r} />
                ))}
              </div>
            )}

            {faction.categories.map((cat) => (
              <div key={cat.name} className="category">
                <h3 className="section-label">{cat.name}</h3>
                <div className="tiles">
                  {rolesIn(faction.id, cat.name).map((r) => (
                    <RoleTile key={r.id} info={r} />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )
      })}

      {index >= 0 && (
        <RoleSheet
          roleId={order[index]}
          onClose={() => go(null)}
          onPrev={index > 0 ? () => go(order[index - 1]) : undefined}
          onNext={index < order.length - 1 ? () => go(order[index + 1]) : undefined}
        />
      )}
    </div>
  )
}
