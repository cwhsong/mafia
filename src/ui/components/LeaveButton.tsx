import { useState } from 'react'

// "Leave room" / "Close room" with a confirm step, so a stray tap doesn't end anything.
export function LeaveButton({ label, warning, onConfirm }: { label: string; warning?: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <button type="button" className="btn btn-quiet" onClick={() => setConfirming(true)}>
        {label}
      </button>
    )
  }

  return (
    <div className="panel stack">
      <p>{warning ?? 'Are you sure?'}</p>
      <div className="row">
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          Yes, {label.toLowerCase()}
        </button>
        <button type="button" className="btn" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
