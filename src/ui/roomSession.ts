import type { Command } from '../engine'
import { JoinError, type RoomConnection, type RoomTransport, type RoomView } from '../transport/types'

export type SessionState =
  | { status: 'idle' }
  | { status: 'connecting'; mode: 'host' | 'join' }
  | {
      status: 'in-room'
      code: string
      isHost: boolean
      hostName: string
      view: RoomView
      error: { code: string; message: string } | null
    }
  | { status: 'failed'; code: string; message: string }
  | { status: 'closed'; reason: 'host-left' | 'removed' }

export interface RoomSession {
  getSnapshot(): SessionState
  subscribe(listener: () => void): () => void
  host(name: string): Promise<void>
  join(code: string, name: string): Promise<void>
  send(command: Command): void
  leave(): void
  dismissError(): void
}

// Plain (non-React) store holding this device's room connection.
// React reads it through useRoom; tests use it directly.
export function createRoomSession(transport: RoomTransport, playerId: string): RoomSession {
  let state: SessionState = { status: 'idle' }
  let connection: RoomConnection | null = null
  let unsubscribe: (() => void) | null = null
  const listeners = new Set<() => void>()

  function set(next: SessionState) {
    state = next
    for (const listener of listeners) listener()
  }

  function attach(conn: RoomConnection) {
    connection = conn
    unsubscribe = conn.subscribe((event) => {
      if (event.type === 'view') {
        set({
          status: 'in-room',
          code: conn.code,
          isHost: conn.isHost,
          hostName: event.hostName,
          view: event.view,
          error: null,
        })
      } else if (event.type === 'error') {
        if (state.status === 'in-room') set({ ...state, error: { code: event.code, message: event.message } })
      } else {
        detach()
        set({ status: 'closed', reason: event.reason })
      }
    })
  }

  function detach() {
    unsubscribe?.()
    unsubscribe = null
    connection = null
  }

  async function connect(mode: 'host' | 'join', open: () => Promise<RoomConnection>) {
    if (connection) return
    set({ status: 'connecting', mode })
    try {
      attach(await open())
    } catch (error) {
      if (error instanceof JoinError) {
        set({ status: 'failed', code: error.code, message: error.message })
      } else {
        set({ status: 'failed', code: 'unknown', message: 'Something went wrong. Try again.' })
      }
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    host: (name) => connect('host', () => transport.host(playerId, name)),
    join: (code, name) => connect('join', () => transport.join(code, playerId, name)),
    send(command) {
      connection?.send(command)
    },
    leave() {
      connection?.leave()
      detach()
      set({ status: 'idle' })
    },
    dismissError() {
      if (state.status === 'in-room' && state.error) set({ ...state, error: null })
      if (state.status === 'failed' || state.status === 'closed') set({ status: 'idle' })
    },
  }
}

export type InRoomState = Extract<SessionState, { status: 'in-room' }>
