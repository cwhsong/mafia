import type { CSSProperties } from 'react'
import './CardFan.css'

type FanCard = { name: string; initial: string; team: 'Town' | 'Mafia' }

const CARDS: FanCard[] = [
  { name: 'Villager', initial: 'V', team: 'Town' },
  { name: 'Medic', initial: 'M', team: 'Town' },
  { name: 'Mafioso', initial: 'M', team: 'Mafia' },
  { name: 'Detective', initial: 'D', team: 'Town' },
]

// Decorative fan of role cards that deal in face down, then flip one by one.
export function CardFan() {
  return (
    <div className="fan">
      {CARDS.map((card, i) => (
        <div
          key={card.name}
          className={`fan-card ${card.team === 'Mafia' ? 'is-mafia' : ''}`}
          style={{ '--i': i, '--n': CARDS.length } as CSSProperties}
        >
          <div className="fan-card-inner">
            <div className="fan-face fan-back">
              <span className="sun" />
            </div>
            <div className="fan-face fan-front">
              <span className="corner corner-top">
                {card.name}
                <span className="corner-pip" />
              </span>
              <span className="monogram">{card.initial}</span>
              <span className="team">{card.team}</span>
              <span className="corner corner-bottom">
                {card.name}
                <span className="corner-pip" />
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
