import {
  createGame,
  reduce,
  playerView,
  narratorView,
  EngineError,
  type Command,
  type GameState,
} from '../engine'
import type { Channel, RoomMessage } from './channel'
import type { RoomConnection, RoomEvent } from './types'
import { playerMaySend, NOT_ALLOWED } from './permissions'

interface HostOptions {
  code: string
  hostId: string
  hostName: string
  seed: number
  channel: Channel
}

// The host's tab owns the game: it runs every command through the engine
// and sends each player only their own view.
export function createHostRoom({ code, hostId, hostName, seed, channel }: HostOptions): RoomConnection {
  let state: GameState = createGame(hostId, seed)
  const listeners = new Set<(event: RoomEvent) => void>()

  function emit(event: RoomEvent) {
    for (const listener of listeners) listener(event)
  }

  function sendView(playerId: string) {
    channel.post({ kind: 'view', to: playerId, view: playerView(state, playerId), hostName })
  }

  function publish() {
    emit({ type: 'view', view: narratorView(state), hostName })
    for (const player of state.players) sendView(player.id)
  }

  // Applies a command; tells removed players they were removed.
  function apply(command: Command) {
    const before = state.players.map((p) => p.id)
    state = reduce(state, command)
    for (const id of before) {
      if (!state.players.some((p) => p.id === id)) channel.post({ kind: 'removed', to: id })
    }
    publish()
  }

  channel.onMessage((message: RoomMessage) => {
    if (message.kind === 'join') {
      // Already in the room (e.g. they refreshed): just send their view again.
      if (state.players.some((p) => p.id === message.playerId)) {
        sendView(message.playerId)
        return
      }
      try {
        apply({ type: 'addPlayer', id: message.playerId, name: message.name })
      } catch (error) {
        if (!(error instanceof EngineError)) throw error
        channel.post({
          kind: 'rejected',
          to: message.playerId,
          code: error.code,
          message: error.code === 'wrong-phase' ? 'This game has already started.' : error.message,
        })
      }
    }

    if (message.kind === 'command') {
      // A player's own night pick or vote; anything else is refused.
      if (!playerMaySend(message.command, message.playerId)) {
        channel.post({ kind: 'error', to: message.playerId, ...NOT_ALLOWED })
        return
      }
      try {
        apply(message.command)
      } catch (error) {
        if (!(error instanceof EngineError)) throw error
        channel.post({ kind: 'error', to: message.playerId, code: error.code, message: error.message })
      }
    }

    if (message.kind === 'leave') {
      // Leaving only frees the seat in the lobby; mid-game they can rejoin.
      if (state.phase === 'lobby' && state.players.some((p) => p.id === message.playerId)) {
        apply({ type: 'removePlayer', id: message.playerId })
      }
    }
  })

  return {
    code,
    isHost: true,
    subscribe(listener) {
      listeners.add(listener)
      listener({ type: 'view', view: narratorView(state), hostName })
      return () => listeners.delete(listener)
    },
    send(command) {
      try {
        apply(command)
      } catch (error) {
        if (!(error instanceof EngineError)) throw error
        emit({ type: 'error', code: error.code, message: error.message })
      }
    },
    leave() {
      channel.post({ kind: 'closed' })
      channel.close()
      listeners.clear()
    },
  }
}
