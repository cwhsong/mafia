import { createLocalTransport } from '../transport/localTransport'
import { getPlayerId } from '../transport/identity'
import { createRoomSession } from './roomSession'

// The one room session for this tab.
export const appSession = createRoomSession(createLocalTransport(), getPlayerId())

// ---------- Rejoin after a refresh ----------
// A player who refreshes the page drops back to idle. We remember which room they
// were in (per tab) and quietly rejoin; the host recognises their id and keeps their seat.
// The narrator's tab holds the game itself in Phase 2, so a narrator refresh ends the room.

const LAST_ROOM_KEY = 'daybreak.lastRoom'

appSession.subscribe(() => {
  const state = appSession.getSnapshot()
  if (state.status === 'in-room' && !state.isHost && state.view.kind === 'player' && state.view.me) {
    sessionStorage.setItem(LAST_ROOM_KEY, JSON.stringify({ code: state.code, name: state.view.me.name }))
  } else if (state.status === 'idle' || state.status === 'closed') {
    sessionStorage.removeItem(LAST_ROOM_KEY)
  }
})

try {
  const saved = sessionStorage.getItem(LAST_ROOM_KEY)
  if (saved) {
    const { code, name } = JSON.parse(saved) as { code: string; name: string }
    void appSession.join(code, name)
  }
} catch {
  sessionStorage.removeItem(LAST_ROOM_KEY)
}

// If the narrator closes their tab, tell the players instead of leaving them waiting.
window.addEventListener('pagehide', () => {
  const state = appSession.getSnapshot()
  if (state.status === 'in-room' && state.isHost) appSession.leave()
})
