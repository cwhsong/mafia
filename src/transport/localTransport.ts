import { randomSeed } from '../engine'
import { browserChannels, roomChannelName, type ChannelFactory, type RoomMessage } from './channel'
import { createHostRoom } from './hostRoom'
import { generateRoomCode } from './roomCode'
import { JoinError, type RoomConnection, type RoomEvent, type RoomTransport } from './types'

interface LocalTransportOptions {
  channels?: ChannelFactory
  joinTimeoutMs?: number
  newSeed?: () => number
  newCode?: () => string
}

// Phase 2 transport: rooms live in browser tabs and talk over BroadcastChannel.
// Only works between tabs of the same browser. Phase 3 swaps in Firebase.
export function createLocalTransport(options: LocalTransportOptions = {}): RoomTransport {
  const {
    channels = browserChannels,
    joinTimeoutMs = 2000,
    newSeed = randomSeed,
    newCode = generateRoomCode,
  } = options

  return {
    async host(hostId, hostName) {
      const code = newCode()
      return createHostRoom({
        code,
        hostId,
        hostName,
        seed: newSeed(),
        channel: channels(roomChannelName(code)),
      })
    },

    join(code, playerId, name) {
      return new Promise<RoomConnection>((resolve, reject) => {
        const channel = channels(roomChannelName(code))
        const listeners = new Set<(event: RoomEvent) => void>()
        let latest: RoomEvent | null = null
        let joined = false

        function emit(event: RoomEvent) {
          latest = event
          for (const listener of listeners) listener(event)
        }

        const connection: RoomConnection = {
          code,
          isHost: false,
          subscribe(listener) {
            listeners.add(listener)
            if (latest) listener(latest)
            return () => listeners.delete(listener)
          },
          send() {
            // Players have no commands yet. Phase 4 adds night actions and votes.
            for (const listener of listeners) {
              listener({ type: 'error', code: 'not-allowed', message: 'Only the narrator can do that.' })
            }
          },
          leave() {
            channel.post({ kind: 'leave', playerId })
            channel.close()
            listeners.clear()
          },
        }

        const timer = setTimeout(() => {
          if (joined) return
          channel.close()
          reject(new JoinError('room-not-found', `No game found with code ${code}.`))
        }, joinTimeoutMs)

        channel.onMessage((message: RoomMessage) => {
          if (message.kind === 'closed') {
            emit({ type: 'closed', reason: 'host-left' })
            return
          }
          if (!('to' in message) || message.to !== playerId) return

          if (message.kind === 'view') {
            emit({ type: 'view', view: message.view, hostName: message.hostName })
            if (!joined) {
              joined = true
              clearTimeout(timer)
              resolve(connection)
            }
          }
          if (message.kind === 'rejected' && !joined) {
            clearTimeout(timer)
            channel.close()
            reject(new JoinError(message.code, message.message))
          }
          if (message.kind === 'removed') {
            emit({ type: 'closed', reason: 'removed' })
          }
        })

        channel.post({ kind: 'join', playerId, name })
      })
    },
  }
}
