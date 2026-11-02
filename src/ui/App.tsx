import { firebaseConfig } from '../transport/firebaseConfig'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <span aria-hidden="true">🕵️</span>
        <span>Mafia: Daybreak</span>
      </header>

      <main className="app-main">
        {/* Placeholder until Step 2.6 builds the real Home screen */}
        <div className="card stack">
          <h1>Play Mafia in person</h1>
          <p className="muted">
            Phones handle the roles and the night. The narrator handles the story. 
          </p>
          <button className="btn btn-primary" disabled>
            Host a game
          </button>
          <button className="btn" disabled>
            Join a game
          </button>
        </div>
      </main>

      <footer className="app-footer">
        {import.meta.env.MODE} · {firebaseConfig.projectId}
      </footer>
    </div>
  )
}