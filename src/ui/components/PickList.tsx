import { useState, type ReactNode } from 'react'

export interface PickOption {
  id: string
  label: string
  disabled?: boolean
  dead?: boolean
  note?: ReactNode   // small text after the name, e.g. "you", "Mafia", "out"
  extra?: ReactNode  // shown at the right of the row, e.g. Mafia stamps or voters
}

interface Props {
  options: PickOption[]
  selectedIds: string[]     // tapped but not yet confirmed
  confirmedId?: string | null
  onToggle: (id: string) => void
  locked?: boolean          // e.g. once the vote is closed
}

// A list of players to tap. Tap once to select, tap again to deselect.
// Confirming happens in a separate button below (see usePick).
export function PickList({ options, selectedIds, confirmedId = null, onToggle, locked = false }: Props) {
  return (
    <ul className="list pick-list">
      {options.map((option) => {
        const selected = selectedIds.includes(option.id)
        const confirmed = option.id === confirmedId
        return (
          <li key={option.id}>
            <button
              type="button"
              className={`pick ${selected ? 'is-picked' : ''} ${confirmed ? 'is-confirmed' : ''}`}
              onClick={() => onToggle(option.id)}
              disabled={locked || option.disabled}
              aria-pressed={selected}
            >
              <span className={option.dead ? 'is-dead' : ''}>{option.label}</span>
              {option.note && <span className="hint"> · {option.note}</span>}
              {confirmed && <span className="pick-check"> ✓ your pick</span>}
            </button>
            {option.extra}
          </li>
        )
      })}
    </ul>
  )
}

// Small seal-style stamp marking a Mafia teammate's pick. Tap it to see whose it is.
export function Stamp({ name }: { name: string }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      className="stamp"
      onClick={() => setOpen((o) => !o)}
      title={`${name}'s pick`}
      aria-label={`${name}'s pick`}
    >
      {open ? `${name}’s pick` : name[0]}
    </button>
  )
}
