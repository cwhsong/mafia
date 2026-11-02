import type { Command, NarratorView, PlayerView } from '../engine'

export type RoomView = PlayerView | NarratorView

// What a connection tells the UI.
export type RoomEvent =
  | { type: 'view'; view: RoomView; hostName: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'closed'; reason: 'host-left' | 'removed' }

// One device's link to a room, as host or as player.
export interface RoomConnection {
  readonly code: string
  readonly isHost: boolean
  // Calls the listener with the latest view right away, then on every change.
  subscribe(listener: (event: RoomEvent) => void): () => void
  send(command: Command): void
  leave(): void
}

// Creates or joins rooms. Phase 2: browser tabs. Phase 3: Firebase.
export interface RoomTransport {
  host(hostId: string, hostName: string): Promise<RoomConnection>
  join(code: string, playerId: string, name: string): Promise<RoomConnection>
}

// Why joining failed: 'room-not-found', or an engine code like 'duplicate-name'.
export class JoinError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'JoinError'
    this.code = code
  }
}
