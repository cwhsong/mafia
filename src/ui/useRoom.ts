import { useSyncExternalStore } from 'react'
import type { RoomSession, SessionState } from './roomSession'

// Gives a component the current room state and re-renders it whenever that changes.
export function useRoom(session: RoomSession): SessionState {
  return useSyncExternalStore(session.subscribe, session.getSnapshot)
}
