import '../screens/Room.css'

// Small header shown on every in-room screen.
export function RoomHeader({ code }: { code: string }) {
  return (
    <header className="room-header">
      <span className="wordmark">
        Mafia: <span>Daybreak</span>
      </span>
      <span className="code-chip" aria-label={`Room code ${code}`}>
        {code}
      </span>
    </header>
  )
}

// Narrator error message, with a button to dismiss it.
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="banner" role="alert">
      <span>{message}</span>
      <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
