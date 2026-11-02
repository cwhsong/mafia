import type { PlayerView } from '../engine'

// Messages sent between tabs in one room.
export type RoomMessage =
  // player → host
  | { kind: 'join'; playerId: string; name: string }
  | { kind: 'leave'; playerId: string }
  // host → one player (every tab receives it; only the addressee uses it)
  | { kind: 'view'; to: string; view: PlayerView; hostName: string }
  | { kind: 'rejected'; to: string; code: string; message: string }
  | { kind: 'removed'; to: string }
  // host → everyone
  | { kind: 'closed' }

// The smallest interface over BroadcastChannel, so tests can swap in a fake.
export interface Channel {
  post(message: RoomMessage): void
  onMessage(handler: (message: RoomMessage) => void): void
  close(): void
}

export type ChannelFactory = (name: string) => Channel

export function roomChannelName(code: string): string {
  return `daybreak:${code}`
}

// Real tabs: BroadcastChannel delivers to every other tab on this site (not to the sender).
export const browserChannels: ChannelFactory = (name) => {
  const channel = new BroadcastChannel(name)
  return {
    post: (message) => channel.postMessage(message),
    onMessage: (handler) => {
      channel.onmessage = (event: MessageEvent<RoomMessage>) => handler(event.data)
    },
    close: () => channel.close(),
  }
}

// Tests: an in-memory stand-in that behaves like BroadcastChannel
// (asynchronous, copies each message, never echoes back to the sender).
export function createMemoryChannels(): ChannelFactory {
  const rooms = new Map<string, Set<(message: RoomMessage) => void>>()

  return (name) => {
    const members = rooms.get(name) ?? new Set()
    rooms.set(name, members)

    let handler: ((message: RoomMessage) => void) | null = null
    const deliver = (message: RoomMessage) => handler?.(message)
    members.add(deliver)

    return {
      post: (message) => {
        const copy = structuredClone(message)
        for (const member of members) {
          if (member !== deliver) queueMicrotask(() => member(copy))
        }
      },
      onMessage: (h) => {
        handler = h
      },
      close: () => {
        members.delete(deliver)
      },
    }
  }
}
