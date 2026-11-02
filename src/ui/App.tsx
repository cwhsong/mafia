import { firebaseConfig } from '../transport/firebaseConfig'
import { appSession } from './session'
import { useRoom } from './useRoom'
import { Home } from './screens/Home'
import { HostLobby } from './screens/HostLobby'
import { PlayerLobby } from './screens/PlayerLobby'
import { PlayerGame } from './screens/PlayerGame'
import { NarratorGame } from './screens/NarratorGame'
import { Closed } from './screens/Closed'

// The room state decides the screen; there is no page routing.
function Screen() {
  const state = useRoom(appSession)

  if (state.status === 'closed') {
    return <Closed reason={state.reason} onHome={appSession.dismissError} />
  }

  if (state.status !== 'in-room') {
    return <Home session={appSession} state={state} />
  }

  const { view } = state
  if (view.kind === 'narrator') {
    return view.game.phase === 'lobby' ? (
      <HostLobby session={appSession} state={state} game={view.game} />
    ) : (
      <NarratorGame session={appSession} state={state} game={view.game} />
    )
  }

  return view.phase === 'lobby' ? (
    <PlayerLobby session={appSession} state={state} view={view} />
  ) : (
    <PlayerGame session={appSession} state={state} view={view} />
  )
}

export default function App() {
  return (
    <div className="app">
      <main className="app-main">
        <Screen />
      </main>

      <footer className="app-footer">
        {import.meta.env.MODE} · {firebaseConfig.projectId}
      </footer>
    </div>
  )
}
