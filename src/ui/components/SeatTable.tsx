import type { ReactNode } from 'react'

export interface Seat {
  id: string
  name: string
  me?: boolean
  disabled?: boolean
  top?: string        // shown above the seat: a vote count
  tags?: string[]     // Mafia teammates' picks, shown above the seat
}

export interface Pointer {
  from: string
  to: string
  mine?: boolean
}

interface Props {
  seats: Seat[]
  pendingId: string | null    // tapped, not yet confirmed
  confirmedId: string | null
  onTap: (id: string) => void
  center: ReactNode
  pointers?: Pointer[]
  locked?: boolean
  label: string               // what the table is for, for screen readers
}

// The table's own coordinate space; the box keeps this shape so the SVG pointers and
// the seats (placed in percentages) always line up.
const W = 342
const H = 470

// Seats sit around an oval table. Tap a seat to pick it; confirming happens below.
export function SeatTable({ seats, pendingId, confirmedId, onTap, center, pointers = [], locked = false, label }: Props) {
  const n = seats.length
  const size = n <= 10 ? 'md' : n <= 14 ? 'sm' : 'xs'
  const rx = W / 2 - 26
  const ry = H / 2 - 40
  const at = new Map(
    seats.map((s, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n, 1)
      return [s.id, { x: W / 2 + rx * Math.cos(a), y: H / 2 + ry * Math.sin(a) }]
    }),
  )
  const r = size === 'md' ? 32 : size === 'sm' ? 27 : 23

  // Each pointer stops short of both circles
  const lines = pointers
    .map((p) => {
      const a = at.get(p.from)
      const b = at.get(p.to)
      if (!a || !b) return null
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 1
      return { ...p, x1: a.x + (dx / d) * r, y1: a.y + (dy / d) * r, x2: b.x - (dx / d) * (r + 4), y2: b.y - (dy / d) * (r + 4) }
    })
    .filter((l) => l !== null)

  return (
    <div className={`seat-table seat-table-${size}`} role="group" aria-label={label}>
      <div className="seat-table-center">{center}</div>
      <svg className="seat-pointers" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {lines.map((l) => (
          <line
            key={`${l.from}-${l.to}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            className={l.mine ? 'is-mine' : ''}
          />
        ))}
      </svg>
      {seats.map((s) => {
        const pos = at.get(s.id)!
        const pending = s.id === pendingId
        const confirmed = s.id === confirmedId && !pending
        return (
          <button
            key={s.id}
            type="button"
            className={`seat ${pending ? 'is-pending' : ''} ${confirmed ? 'is-confirmed' : ''} ${s.me ? 'is-me' : ''}`}
            style={{ left: `${(pos.x / W) * 100}%`, top: `${(pos.y / H) * 100}%` }}
            onClick={() => onTap(s.id)}
            disabled={locked || s.disabled}
            aria-pressed={pending || confirmed}
            aria-label={`${s.name}${s.me ? ' (you)' : ''}${s.top ? `, ${s.top}` : ''}${s.tags?.length ? `, picked by ${s.tags.join(' and ')}` : ''}`}
          >
            <span className="seat-top">
              {s.tags?.map((t) => (
                <span key={t} className="seat-tag">{t}</span>
              ))}
              {s.top && <span className="seat-count">{s.top}</span>}
            </span>
            <span className="seat-disc" aria-hidden="true">{s.name[0]}</span>
            <span className="seat-name">{s.me ? 'you' : s.name}</span>
          </button>
        )
      })}
    </div>
  )
}

// The middle of the table: a small label, a name, a note.
export function TableCenter({ label, name, note, tone }: { label: string; name?: string; note?: string; tone?: 'dawn' | 'mafia' }) {
  return (
    <>
      <span className={`table-label ${tone ? `tone-${tone}` : ''}`}>{label}</span>
      {name && <span className="table-name">{name}</span>}
      {note && <span className="table-note">{note}</span>}
    </>
  )
}
