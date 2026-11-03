import { useState } from 'react'

// Selection state for a single pick: tap to select, tap again to deselect.
// Returns the button label to show (or null when there is nothing to confirm).
export function usePick(confirmedId: string | null) {
  const [selected, setSelected] = useState<string | null>(null)
  const pending = selected !== null && selected !== confirmedId ? selected : null

  return {
    selectedIds: pending ? [pending] : [],
    pending,
    toggle: (id: string) => setSelected((current) => (current === id ? null : id)),
    clear: () => setSelected(null),
  }
}
