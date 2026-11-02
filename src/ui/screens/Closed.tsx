import '../screens/Room.css'

interface Props {
  reason: 'host-left' | 'removed'
  onHome: () => void
}

export function Closed({ reason, onHome }: Props) {
  return (
    <div className="room">
      <section className="panel stack">
        <h1 className="room-title">
          {reason === 'removed' ? 'You were removed' : 'The room has closed'}
        </h1>
        <p className="muted">
          {reason === 'removed'
            ? 'The narrator removed you from the room.'
            : 'The narrator ended the game or closed their tab.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={onHome}>
          Back to start
        </button>
      </section>
    </div>
  )
}
