import { describe, it, expect } from 'vitest'
import type { PlayerView, NarratorView } from '../engine'
import { createMemoryChannels } from './channel'
import { createLocalTransport } from './localTransport'
import { JoinError, type RoomConnection, type RoomEvent } from './types'

// Lets queued messages arrive (the memory channel is asynchronous, like real tabs).
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

// Records every event a connection emits; .last gives the newest.
function watch(connection: RoomConnection) {
  const events: RoomEvent[] = []
  connection.subscribe((event) => events.push(event))
  return {
    events,
    get last() {
      return events.at(-1)
    },
    get view() {
      const lastView = [...events].reverse().find((e) => e.type === 'view')
      return lastView?.type === 'view' ? lastView.view : undefined
    },
  }
}

function setup() {
  const transport = createLocalTransport({
    channels: createMemoryChannels(),
    joinTimeoutMs: 50,
    newSeed: () => 2026,
    newCode: () => 'KXQRTZ',
  })
  return transport
}

const SEVEN = ['mafioso', 'mafioso', 'medic', 'detective', 'villager', 'villager', 'villager']
const NAMES = ['Ana', 'Ben', 'Cal', 'Dee', 'Eve', 'Fay', 'Gus']

async function fullRoom() {
  const transport = setup()
  const host = await transport.host('host', 'Chisp')
  const hostWatch = watch(host)
  const players = await Promise.all(
    NAMES.map((name) => transport.join('KXQRTZ', name.toLowerCase(), name)),
  )
  const playerWatches = players.map(watch)
  return { transport, host, hostWatch, players, playerWatches }
}

describe('local transport', () => {
  it('creates a room with a code and shows the narrator an empty lobby', async () => {
    const host = await setup().host('host', 'Chisp')
    const w = watch(host)
    expect(host.code).toBe('KXQRTZ')
    expect(host.isHost).toBe(true)
    expect(w.view).toMatchObject({ kind: 'narrator', game: { phase: 'lobby', players: [] } })
  })

  it('lets players join by code', async () => {
    const { hostWatch, playerWatches } = await fullRoom()
    await settle()
    const narrator = hostWatch.view as NarratorView
    expect(narrator.game.players.map((p) => p.name)).toEqual(NAMES)
    expect((playerWatches[0].view as PlayerView).players).toHaveLength(7)
  })

  it('passes the narrator name to players', async () => {
    const { playerWatches } = await fullRoom()
    const last = playerWatches[0].last
    expect(last?.type === 'view' && last.hostName).toBe('Chisp')
  })

  it('rejects a code with no game', async () => {
    const transport = setup()
    await expect(transport.join('NOPENO', 'ana', 'Ana')).rejects.toMatchObject({
      code: 'room-not-found',
    })
  })

  it('rejects a duplicate name', async () => {
    const transport = setup()
    await transport.host('host', 'Chisp')
    await transport.join('KXQRTZ', 'ana', 'Ana')
    const attempt = transport.join('KXQRTZ', 'ana2', 'ana')
    await expect(attempt).rejects.toBeInstanceOf(JoinError)
    await expect(attempt).rejects.toMatchObject({ code: 'duplicate-name' })
  })

  it('lets a player rejoin after a refresh without taking a new seat', async () => {
    const { transport, hostWatch } = await fullRoom()
    await transport.join('KXQRTZ', 'ana', 'Ana')
    await settle()
    expect((hostWatch.view as NarratorView).game.players).toHaveLength(7)
  })

  it('deals roles and sends each player only their own', async () => {
    const { host, playerWatches } = await fullRoom()
    host.send({ type: 'setRoleSlots', slots: SEVEN })
    host.send({ type: 'deal' })
    await settle()

    const views = playerWatches.map((w) => w.view as PlayerView)
    expect(views.map((v) => v.me?.roleId).sort()).toEqual([...SEVEN].sort())
    for (const view of views) {
      for (const p of view.players) expect(p).not.toHaveProperty('roleId')
    }
  })

  it('shows Mafia their teammate after the deal', async () => {
    const { host, playerWatches } = await fullRoom()
    host.send({ type: 'setRoleSlots', slots: SEVEN })
    host.send({ type: 'deal' })
    await settle()

    const views = playerWatches.map((w) => w.view as PlayerView)
    const mafia = views.filter((v) => v.me?.roleId === 'mafioso')
    expect(mafia).toHaveLength(2)
    expect(mafia[0].teammates.map((t) => t.id)).toEqual([mafia[1].me?.id])
    for (const v of views.filter((v) => v.me?.roleId !== 'mafioso')) {
      expect(v.teammates).toEqual([])
    }
  })

  it('refuses new players once the game has started', async () => {
    const { transport, host } = await fullRoom()
    host.send({ type: 'setRoleSlots', slots: SEVEN })
    host.send({ type: 'deal' })
    await expect(transport.join('KXQRTZ', 'late', 'Late')).rejects.toMatchObject({
      code: 'wrong-phase',
      message: 'This game has already started.',
    })
  })

  it('reports engine errors to the narrator instead of crashing', async () => {
    const { host, hostWatch } = await fullRoom()
    host.send({ type: 'deal' }) // no roles chosen yet
    expect(hostWatch.last).toMatchObject({ type: 'error', code: 'invalid-setup' })
  })

  it('does not let players send commands', async () => {
    const { players, playerWatches } = await fullRoom()
    players[0].send({ type: 'deal' })
    expect(playerWatches[0].last).toMatchObject({ type: 'error', code: 'not-allowed' })
  })

  it('frees a lobby seat when a player leaves', async () => {
    const { players, hostWatch } = await fullRoom()
    players[6].leave()
    await settle()
    expect((hostWatch.view as NarratorView).game.players).toHaveLength(6)
  })

  it('tells a player when the narrator removes them', async () => {
    const { host, playerWatches } = await fullRoom()
    host.send({ type: 'removePlayer', id: 'gus' })
    await settle()
    expect(playerWatches[6].last).toEqual({ type: 'closed', reason: 'removed' })
  })

  it('tells players when the narrator leaves', async () => {
    const { host, playerWatches } = await fullRoom()
    host.leave()
    await settle()
    for (const w of playerWatches) expect(w.last).toEqual({ type: 'closed', reason: 'host-left' })
  })
})
