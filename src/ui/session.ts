import { createLocalTransport } from '../transport/localTransport'
import { getPlayerId } from '../transport/identity'
import { connectFirebase } from '../transport/firebase/firebaseApp'
import { createFirebaseTransport } from '../transport/firebase/firebaseTransport'
import type { RoomTransport } from '../transport/types'
import { createRoomSession } from './roomSession'
import { isTestMode } from './testMode'

// `npm run dev` uses tabs (no internet); the live site and `npm run dev:firebase` use Firebase.
const useFirebase = import.meta.env.VITE_TRANSPORT === 'firebase'

function makeTransport(): RoomTransport {
  if (!useFirebase) return createLocalTransport({ playerId: getPlayerId() })
  const { db, signIn } = connectFirebase({
    perTabIdentity: isTestMode,
    useEmulator: import.meta.env.VITE_USE_EMULATOR === 'true',
  })
  return createFirebaseTransport({ db, signIn })
}

// The one room session for this tab.
export const appSession = createRoomSession(makeTransport())

// ---------- Picking up where you left off ----------
// We remember the room you were in. After a refresh (or, on a real phone, reopening
// the site) you go straight back in: players rejoin their seat, the narrator resumes
// the game. In test mode this is remembered per tab, matching per-tab identities.

const LAST_ROOM_KEY = 'daybreak.lastRoom'
const storage = useFirebase && !isTestMode ? localStorage : sessionStorage

interface SavedRoom {
  code: string
  name: string
  isHost: boolean
}

appSession.subscribe(() => {
  const state = appSession.getSnapshot()
  if (state.status === 'in-room') {
    const name =
      state.isHost ? state.hostName : state.view.kind === 'player' ? state.view.me?.name ?? '' : ''
    const saved: SavedRoom = { code: state.code, name, isHost: state.isHost }
    storage.setItem(LAST_ROOM_KEY, JSON.stringify(saved))
  } else if (state.status !== 'connecting') {
    storage.removeItem(LAST_ROOM_KEY)
  }
})

try {
  const raw = storage.getItem(LAST_ROOM_KEY)
  if (raw) {
    const saved = JSON.parse(raw) as SavedRoom
    void (saved.isHost ? appSession.resumeHost(saved.code) : appSession.join(saved.code, saved.name))
  }
} catch {
  storage.removeItem(LAST_ROOM_KEY)
}

// With tabs-only play the narrator's tab holds the game, so closing it ends the room.
// (With Firebase the game is saved online, and the narrator can come back to it.)
if (!useFirebase) {
  window.addEventListener('pagehide', () => {
    const state = appSession.getSnapshot()
    if (state.status === 'in-room' && state.isHost) appSession.leave()
  })
}
