import { useEffect, useRef } from 'react'
import { INFO, tagLine } from '../../roles/info'
import { isPlayable } from './playable'
import './Roles.css'

interface Props {
  roleId: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}

// One role in full: a sheet that slides up over the screen (a centered panel on wide screens).
// The Roles page and the in-game "More details" both use it, so the text never drifts apart.
export function RoleSheet({ roleId, onClose, onPrev, onNext }: Props) {
  const info = INFO[roleId]
  const closeRef = useRef<HTMLButtonElement>(null)
  const touchX = useRef<number | null>(null)

  useEffect(() => {
    closeRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev?.()
      if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext])

  if (!info) return null
  const playable = isPlayable(roleId)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet faction-${info.faction}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const start = touchX.current
          touchX.current = null
          if (start === null) return
          const moved = e.changedTouches[0].clientX - start
          if (moved > 60) onPrev?.()
          if (moved < -60) onNext?.()
        }}
      >
        <div className="sheet-top">
          <span className="sheet-grip" aria-hidden="true" />
          <button ref={closeRef} type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="sheet-head">
          <span className="tile-art sheet-art" aria-hidden="true">{info.name[0]}</span>
          <div>
            <p className="sheet-tags">{tagLine(info)}</p>
            <h2 id="sheet-title" className="sheet-title">{info.name}</h2>
            {!playable && <span className="soon">Coming soon</span>}
          </div>
        </div>

        <section className="sheet-section">
          <p className="section-label">Ability</p>
          <p className="sheet-ability">{info.ability}</p>
        </section>

        {info.goal && (
          <section className="sheet-section">
            <p className="section-label">Goal</p>
            <p>{info.goal}</p>
          </section>
        )}

        {info.details.length > 0 && (
          <section className="sheet-section">
            <p className="section-label">Details</p>
            <ul className="sheet-details">
              {info.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </section>
        )}

        {(onPrev || onNext) && (
          <div className="sheet-nav">
            <button type="button" className="btn btn-small btn-quiet" onClick={onPrev} disabled={!onPrev}>
              ← Previous
            </button>
            <button type="button" className="btn btn-small btn-quiet" onClick={onNext} disabled={!onNext}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
