import { describe, it, expect } from 'vitest'
import type { NarratorView, PlayerView } from '../../engine'
import type { RoomConnection, RoomEvent } from '../types'
import { createMemoryDb } from './db'
import { createFirebaseTransport, ROOM_LIFETIME_MS } from './firebaseTransport'

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0))
}

function watch(connection: RoomConnection) {
  const events: RoomEvent[] = []
  connection.subscribe((event) => events.push(event))
  return {
    events,
    get last() {
      return events.at(-1)
    },
    get view() {
      const v = [...events].reverse().find((e) => e.type === 'view')
      return v?.type === 'view' ? v.view : undefined
    },
  }
}

// One shared in-memory database; each device signs in as its own uid.
function setup(options: { codes?: string[]; now?: () => number } = {}) {
  const db = createMemoryDb()
  const codes = [...(options.codes ?? ['KXQRTZ'])]
  const device = (uid: string) =>
    createFirebaseTransport({
      db,
      signIn: async () => uid,
      joinTimeoutMs: 50,
      newSeed: () => 2026,
      newCode: () => codes.shift() ?? 'ZZZZZZ',
      now: options.now,
    })
  return { db, device }
}

const SEVEN = ['mafioso', 'mafioso', 'medic', 'detective', 'villager', 'villager', 'villager']
const NAMES = ['Ana', 'Ben', 'Cal', 'Dee', 'Eve', 'Fay', 'Gus']

async function fullRoom() {
  const { db, device } = setup()
  const host = await device('host').host('Chisp')
  const hostWatch = watch(host)
  const players: RoomConnection[] = []
  for (const name of NAMES) players.push(await device(name.toLowerCase()).join('KXQRTZ', name))
  await settle()
  return { db, device, host, hostWatch, players, playerWatches: players.map(watch) }
}

function dealt(host: RoomConnection) {
  host.send({ type: 'setRoleSlots', slots: SEVEN })
  host.send({ type: 'deal' })
}

describe('firebase transport', () => {
  it('opens a room and saves it to the database', async () => {
    const { db, device } = setup()
    const host = await device('host').host('Chisp')
    expect(host.code).toBe('KXQRTZ')
    const saved = db.dump() as { rooms: Record<string, { meta: { hostUid: string; hostName: string } }> }
    expect(saved.rooms.KXQRTZ.meta).toMatchObject({ hostUid: 'host', hostName: 'Chisp' })
  })

  it('picks a different code if one is already in use', async () => {
    const { device } = setup({ codes: ['KXQRTZ', 'KXQRTZ', 'ABCDEF'] })
    await device('host1').host('One')
    const second = await device('host2').host('Two')
    expect(second.code).toBe('ABCDEF')
  })

  it('reuses a code once its old room has expired', async () => {
    let clock = Date.now() // the memory db stamps rooms with the real time
    const { device } = setup({ codes: ['KXQRTZ', 'KXQRTZ'], now: () => clock })
    await device('host1').host('One')
    clock += ROOM_LIFETIME_MS + 60_000
    expect((await device('host2').host('Two')).code).toBe('KXQRTZ')
  })

  it('lets players join by code', async () => {
    const { hostWatch, playerWatches } = await fullRoom()
    expect((hostWatch.view as NarratorView).game.players.map((p) => p.name)).toEqual(NAMES)
    expect((playerWatches[0].view as PlayerView).players).toHaveLength(7)
  })

  it('passes the narrator name to players', async () => {
    const { playerWatches } = await fullRoom()
    const last = playerWatches[0].last
    expect(last?.type === 'view' && last.hostName).toBe('Chisp')
  })

  it('rejects a code with no game', async () => {
    await expect(setup().device('ana').join('NOPENO', 'Ana')).rejects.toMatchObject({ code: 'room-not-found' })
  })

  it('says so when the narrator is offline', async () => {
    const { db, device } = setup()
    const host = await device('host').host('Chisp')
    host.leave() // stops listening, like a closed tab…
    await db.set('rooms/KXQRTZ/closed', null) // …but without closing the room
    await expect(device('ana').join('KXQRTZ', 'Ana')).rejects.toMatchObject({ code: 'host-offline' })
  })

  it('tells the narrator to use ?test to also join in the same browser', async () => {
    const { device } = setup()
    await device('host').host('Chisp')
    await expect(device('host').join('KXQRTZ', 'Me')).rejects.toMatchObject({ code: 'is-narrator' })
  })

  it('rejects a duplicate name', async () => {
    const { device } = setup()
    await device('host').host('Chisp')
    await device('ana').join('KXQRTZ', 'Ana')
    await expect(device('ana2').join('KXQRTZ', 'ana')).rejects.toMatchObject({ code: 'duplicate-name' })
  })

  it('lets a rejected player try again with another name', async () => {
    const { device } = setup()
    await device('host').host('Chisp')
    await device('ana').join('KXQRTZ', 'Ana')
    await expect(device('ana2').join('KXQRTZ', 'Ana')).rejects.toBeTruthy()
    const retry = await device('ana2').join('KXQRTZ', 'Anna')
    expect(retry.code).toBe('KXQRTZ')
  })

  it('lets a player rejoin after a refresh without taking a new seat', async () => {
    const { device, hostWatch } = await fullRoom()
    await device('ana').join('KXQRTZ', 'Ana')
    await settle()
    expect((hostWatch.view as NarratorView).game.players).toHaveLength(7)
  })

  it('deals roles and stores each player’s own view only under their id', async () => {
    const { db, host, playerWatches } = await fullRoom()
    dealt(host)
    await settle()

    const views = playerWatches.map((w) => w.view as PlayerView)
    expect(views.map((v) => v.me?.roleId).sort()).toEqual([...SEVEN].sort())
    for (const view of views) {
      for (const p of view.players) expect(p).not.toHaveProperty('roleId')
    }

    const room = (db.dump() as { rooms: Record<string, Record<string, unknown>> }).rooms.KXQRTZ
    expect(JSON.stringify(room.views)).not.toContain('"seed"')
    expect(JSON.parse((room.host as { state: string }).state).seed).toBe(2026)
  })

  it('shows Mafia their teammate', async () => {
    const { host, playerWatches } = await fullRoom()
    dealt(host)
    await settle()
    const views = playerWatches.map((w) => w.view as PlayerView)
    const mafia = views.filter((v) => v.me?.roleId === 'mafioso')
    expect(mafia[0].teammates.map((t) => t.id)).toEqual([mafia[1].me?.id])
  })

  it('refuses new players once the game has started', async () => {
    const { device, host } = await fullRoom()
    dealt(host)
    await settle()
    await expect(device('late').join('KXQRTZ', 'Late')).rejects.toMatchObject({
      code: 'wrong-phase',
      message: 'This game has already started.',
    })
  })

  it('takes players’ night picks through the request queue', async () => {
    const { db, host, hostWatch, players, playerWatches } = await fullRoom()
    dealt(host)
    host.send({ type: 'advance' })
    await settle()
    const views = playerWatches.map((w) => w.view as PlayerView)
    const i = views.findIndex((v) => v.me?.roleId === 'detective')
    const target = views[i].night!.targets[0]

    players[i].send({ type: 'submitAction', playerId: views[i].me!.id, targetId: target })
    await settle()
    expect((hostWatch.view as NarratorView).game.nightPicks[views[i].me!.id]).toBe(target)
    expect((playerWatches[i].view as PlayerView).night?.myPick).toBe(target)
    // the request was used up
    expect((db.dump() as { rooms: Record<string, { requests?: unknown }> }).rooms.KXQRTZ.requests).toBeUndefined()
  })

  it('handles several quick changes of mind in order', async () => {
    const { host, hostWatch, players, playerWatches } = await fullRoom()
    dealt(host)
    host.send({ type: 'advance' })
    await settle()
    const me = (playerWatches[0].view as PlayerView).me!
    const [a, b] = (playerWatches[0].view as PlayerView).night!.targets
    players[0].send({ type: 'submitAction', playerId: me.id, targetId: a })
    players[0].send({ type: 'submitAction', playerId: me.id, targetId: b })
    await settle()
    expect((hostWatch.view as NarratorView).game.nightPicks[me.id]).toBe(b)
  })

  it('tells a player when their pick is refused, and refuses acting for others', async () => {
    const { host, players, playerWatches } = await fullRoom()
    dealt(host)
    host.send({ type: 'advance' })
    await settle()
    const me = (playerWatches[0].view as PlayerView).me!
    players[0].send({ type: 'submitAction', playerId: me.id, targetId: 'nobody' })
    await settle()
    expect(playerWatches[0].last).toMatchObject({ type: 'error', code: 'invalid-target' })

    players[0].send({ type: 'submitAction', playerId: 'someone-else', targetId: 'ana' })
    expect(playerWatches[0].last).toMatchObject({ type: 'error', code: 'not-allowed' })
  })

  it('refuses a forged request for another player', async () => {
    const { db, host, hostWatch } = await fullRoom()
    dealt(host)
    host.send({ type: 'advance' })
    await settle()
    // Ana writes (under her own id, as the rules require) a command claiming to be Ben
    await db.set('rooms/KXQRTZ/requests/ana/x1', {
      type: 'command',
      command: JSON.stringify({ type: 'submitAction', playerId: 'ben', targetId: 'cal' }),
    })
    await settle()
    expect((hostWatch.view as NarratorView).game.nightPicks.ben).toBeUndefined()
  })

  it('reports engine errors to the narrator', async () => {
    const { host, hostWatch } = await fullRoom()
    host.send({ type: 'deal' })
    expect(hostWatch.last).toMatchObject({ type: 'error', code: 'invalid-setup' })
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

  it('tells players when the narrator closes the room', async () => {
    const { host, playerWatches } = await fullRoom()
    host.leave()
    await settle()
    for (const w of playerWatches) expect(w.last).toEqual({ type: 'closed', reason: 'host-left' })
  })

  it('lets the narrator pick the game back up after a refresh', async () => {
    const { device, host, playerWatches } = await fullRoom()
    dealt(host)
    host.send({ type: 'advance' }) // Night 1
    await settle()

    // The narrator's tab reloads: a brand-new transport for the same uid
    const resumed = await device('host').resumeHost('KXQRTZ')
    const w = watch(resumed)
    const game = (w.view as NarratorView).game
    expect(game.phase).toBe('night')
    expect(game.players.every((p) => p.roleId)).toBe(true)

    resumed.send({ type: 'advance' }) // Dawn 1
    await settle()
    expect((playerWatches[0].view as PlayerView).phase).toBe('dawn')
  })

  it('does not let someone else resume the room', async () => {
    const { device } = await fullRoom()
    await expect(device('ana').resumeHost('KXQRTZ')).rejects.toMatchObject({ code: 'room-not-found' })
  })

  it('does not resume a closed room', async () => {
    const { device, host } = await fullRoom()
    host.leave()
    await settle()
    await expect(device('host').resumeHost('KXQRTZ')).rejects.toMatchObject({ code: 'room-not-found' })
  })

  it('plays a full game to a Town win', async () => {
    const { host, hostWatch, playerWatches } = await fullRoom()
    dealt(host)
    await settle()
    const game = () => (hostWatch.view as NarratorView).game
    const mafia = game().players.filter((p) => p.roleId === 'mafioso').map((p) => p.id)

    host.send({ type: 'advance' }) // Night 1
    host.send({ type: 'advance' }) // Dawn 1
    host.send({ type: 'advance' }) // Day 2
    host.send({ type: 'advance' }) // Vote 2
    host.send({ type: 'eliminate', playerIds: mafia, cause: 'vote' })
    await settle()
    expect((playerWatches[0].view as PlayerView).phase).toBe('finale')
    expect((playerWatches[0].view as PlayerView).winner).toBeNull()

    host.send({ type: 'revealWinner' })
    await settle()
    for (const w of playerWatches) {
      const view = w.view as PlayerView
      expect(view.phase).toBe('ended')
      expect(view.winner).toBe('town')
      expect(Object.keys(view.revealedRoles ?? {})).toHaveLength(7)
    }
  })
})

describe('firebase transport when the server refuses', () => {
  it('turns unexpected errors into a plain message', async () => {
    const db = createMemoryDb()
    db.get = async () => {
      throw new Error('PERMISSION_DENIED')
    }
    const transport = createFirebaseTransport({ db, signIn: async () => 'host' })
    const quiet = console.error
    console.error = () => {}
    await expect(transport.host('Chisp')).rejects.toMatchObject({ code: 'unavailable' })
    console.error = quiet
  })

  it('explains a failed sign-in', async () => {
    const transport = createFirebaseTransport({
      db: createMemoryDb(),
      signIn: async () => {
        throw new Error('auth/network-request-failed')
      },
    })
    await expect(transport.join('KXQRTZ', 'Ana')).rejects.toMatchObject({ code: 'offline' })
  })
})
