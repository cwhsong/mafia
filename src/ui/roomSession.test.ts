import { describe, it, expect } from 'vitest'
import { createMemoryChannels } from '../transport/channel'
import { createLocalTransport } from '../transport/localTransport'
import { createRoomSession, type SessionState } from './roomSession'

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

// One session per "device", all sharing in-memory channels
function setup() {
  const channels = createMemoryChannels()
  return (playerId: string) =>
    createRoomSession(
      createLocalTransport({
        playerId,
        channels,
        joinTimeoutMs: 50,
        newSeed: () => 1,
        newCode: () => 'KXQRTZ',
      }),
    )
}

function inRoom(state: SessionState) {
  if (state.status !== 'in-room') throw new Error(`Expected in-room, got ${state.status}`)
  return state
}

describe('room session', () => {
  it('starts idle', () => {
    expect(setup()('me').getSnapshot()).toEqual({ status: 'idle' })
  })

  it('hosts a room and shows the narrator view', async () => {
    const session = setup()('host')
    await session.host('Chisp')
    const state = inRoom(session.getSnapshot())
    expect(state).toMatchObject({ code: 'KXQRTZ', isHost: true, hostName: 'Chisp' })
    expect(state.view.kind).toBe('narrator')
  })

  it('shows "connecting" while joining, then the player view', async () => {
    const device = setup()
    await device('host').host('Chisp')
    const session = device('ana')
    const seen: string[] = []
    session.subscribe(() => seen.push(session.getSnapshot().status))

    await session.join('KXQRTZ', 'Ana')
    expect(seen).toEqual(['connecting', 'in-room'])
    expect(inRoom(session.getSnapshot()).view.kind).toBe('player')
  })

  it('reports a failed join in plain words', async () => {
    const session = setup()('ana')
    await session.join('NOPENO', 'Ana')
    expect(session.getSnapshot()).toMatchObject({
      status: 'failed',
      code: 'room-not-found',
      message: 'No game found with code NOPENO.',
    })
  })

  it('updates when the narrator changes the game', async () => {
    const device = setup()
    const narrator = device('host')
    await narrator.host('Chisp')
    const ana = device('ana')
    await ana.join('KXQRTZ', 'Ana')
    await device('ben').join('KXQRTZ', 'Ben')
    await settle()

    const view = inRoom(ana.getSnapshot()).view
    expect(view.kind === 'player' && view.players.map((p) => p.name)).toEqual(['Ana', 'Ben'])
  })

  it('keeps engine errors on the narrator screen until dismissed', async () => {
    const session = setup()('host')
    await session.host('Chisp')
    session.send({ type: 'deal' })
    expect(inRoom(session.getSnapshot()).error?.code).toBe('invalid-setup')
    session.dismissError()
    expect(inRoom(session.getSnapshot()).error).toBeNull()
  })

  it('moves to "closed" when the narrator leaves', async () => {
    const device = setup()
    const narrator = device('host')
    await narrator.host('Chisp')
    const ana = device('ana')
    await ana.join('KXQRTZ', 'Ana')

    narrator.leave()
    await settle()
    expect(narrator.getSnapshot()).toEqual({ status: 'idle' })
    expect(ana.getSnapshot()).toEqual({ status: 'closed', reason: 'host-left' })
  })

  it('ignores a second host/join while already in a room', async () => {
    const session = setup()('host')
    await session.host('Chisp')
    await session.join('KXQRTZ', 'Again')
    expect(inRoom(session.getSnapshot()).isHost).toBe(true)
  })
})
