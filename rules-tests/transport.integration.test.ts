// The real Firebase transport, against the emulator with the real security rules on.
// Each "device" is signed in as its own user, exactly as phones would be.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import type { NarratorView, PlayerView } from '../src/engine'
import { createRealDb } from '../src/transport/firebase/realDb'
import { createFirebaseTransport } from '../src/transport/firebase/firebaseTransport'
import type { RoomConnection, RoomEvent } from '../src/transport/types'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mafia',
    database: { rules: readFileSync('database.rules.json', 'utf8'), host: '127.0.0.1', port: 9000 },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearDatabase()
})

function device(uid: string, codes: string[] = ['KXQRTZ']) {
  const queue = [...codes]
  return createFirebaseTransport({
    db: createRealDb(env.authenticatedContext(uid).database()),
    signIn: async () => uid,
    joinTimeoutMs: 5000,
    newSeed: () => 2026,
    newCode: () => queue.shift() ?? 'ZZZZZZ',
  })
}

function watch(connection: RoomConnection) {
  let latest: RoomEvent | undefined
  connection.subscribe((event) => {
    latest = event
  })
  return {
    get last() {
      return latest
    },
    get view() {
      return latest?.type === 'view' ? latest.view : undefined
    },
  }
}

// Waits until a condition holds (real network events take a moment).
async function until(check: () => boolean, ms = 5000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('Timed out waiting')
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
}

const NAMES = ['Ana', 'Ben', 'Cal', 'Dee', 'Eve']
const FIVE = ['mafioso', 'medic', 'detective', 'villager', 'villager']

describe('Firebase transport on the emulator, rules on', () => {
  it('plays a whole game: join, deal, private roles, eliminations, game over', async () => {
    const host = await device('narrator').host('Chisp')
    const narrator = watch(host)

    const players: RoomConnection[] = []
    for (const name of NAMES) players.push(await device(name.toLowerCase()).join(host.code, name))
    const watches = players.map(watch)
    await until(() => (narrator.view as NarratorView).game.players.length === 5)

    host.send({ type: 'setRoleSlots', slots: FIVE })
    host.send({ type: 'deal' })
    await until(() => watches.every((w) => (w.view as PlayerView)?.me?.roleId))

    const views = watches.map((w) => w.view as PlayerView)
    expect(views.map((v) => v.me?.roleId).sort()).toEqual([...FIVE].sort())
    for (const v of views) for (const p of v.players) expect(p).not.toHaveProperty('roleId')

    const game = (narrator.view as NarratorView).game
    const mafioso = game.players.find((p) => p.roleId === 'mafioso')!.id
    host.send({ type: 'advance' })
    host.send({ type: 'advance' })
    host.send({ type: 'advance' })
    host.send({ type: 'advance' })
    host.send({ type: 'eliminate', playerIds: [mafioso], cause: 'vote' })

    await until(() => watches.every((w) => (w.view as PlayerView)?.phase === 'ended'))
    for (const w of watches) {
      const v = w.view as PlayerView
      expect(v.winner).toBe('town')
      expect(Object.keys(v.revealedRoles ?? {})).toHaveLength(5)
    }
  })

  it('runs a night and a vote from players’ phones', async () => {
    const host = await device('narrator').host('Chisp')
    const narrator = watch(host)
    const players: RoomConnection[] = []
    for (const name of NAMES) players.push(await device(name.toLowerCase()).join(host.code, name))
    const watches = players.map(watch)
    await until(() => (narrator.view as NarratorView).game.players.length === 5)

    host.send({ type: 'setRoleSlots', slots: FIVE })
    host.send({ type: 'deal' })
    host.send({ type: 'advance' }) // Night 1
    await until(() => watches.every((w) => (w.view as PlayerView)?.night))

    const view = (i: number) => watches[i].view as PlayerView
    const mafiaIndex = watches.findIndex((_, i) => view(i).me?.roleId === 'mafioso')
    const target = view(mafiaIndex).night!.targets[0]
    players[mafiaIndex].send({ type: 'submitAction', playerId: view(mafiaIndex).me!.id, targetId: target })
    await until(() => !!(narrator.view as NarratorView).game.nightPicks[view(mafiaIndex).me!.id])

    host.send({ type: 'resolveNight' })
    await until(() => watches.every((w) => (w.view as PlayerView).phase === 'dawn'))
    for (let i = 0; i < 5; i++) expect(view(i).messages.length).toBeGreaterThan(0)

    host.send({ type: 'reveal' })
    await until(() => view(0).phase === 'day' || view(0).phase === 'ended')
    expect(view(0).lastNight?.deaths).toEqual([target])

    host.send({ type: 'advance' }) // Vote
    await until(() => view(0).phase === 'vote')
    const voters = watches.map((_, i) => i).filter((i) => view(i).me?.alive)
    const mafiaId = view(mafiaIndex).me!.id
    for (const i of voters) {
      if (i !== mafiaIndex) players[i].send({ type: 'castVote', playerId: view(i).me!.id, targetId: mafiaId })
    }
    await until(() => Object.keys((narrator.view as NarratorView).game.votes).length === voters.length - 1)
    host.send({ type: 'closeVote' })
    expect((narrator.view as NarratorView).game.voteResult?.eliminatedId).toBe(mafiaId)
    host.send({ type: 'revealVote' })
    await until(() => watches.every((w) => (w.view as PlayerView).phase === 'ended'))
    expect(view(0).winner).toBe('town')
  })

  it('keeps empty lists and missing values working after a round trip', async () => {
    const host = await device('narrator').host('Chisp')
    const ana = watch(await device('ana').join(host.code, 'Ana'))
    await until(() => !!ana.view)
    const view = ana.view as PlayerView
    expect(view.roleSlots).toEqual([])
    expect(view.teammates).toEqual([])
    expect(view.me?.roleId).toBeNull()
    expect(view.winner).toBeNull()
  })

  it('rejects a duplicate name and a missing room', async () => {
    const host = await device('narrator').host('Chisp')
    await device('ana').join(host.code, 'Ana')
    await expect(device('ana2').join(host.code, 'ana')).rejects.toMatchObject({ code: 'duplicate-name' })
    await expect(device('ben').join('ABCDEF', 'Ben')).rejects.toMatchObject({ code: 'room-not-found' })
  })

  it('lets the narrator resume after a refresh', async () => {
    const host = await device('narrator').host('Chisp')
    const ana = watch(await device('ana').join(host.code, 'Ana'))
    await until(() => !!ana.view)
    host.leave = () => {} // simulate the tab vanishing without closing the room

    const resumed = watch(await device('narrator').resumeHost(host.code))
    expect((resumed.view as NarratorView).game.players.map((p) => p.name)).toEqual(['Ana'])
  })

  it('tells a removed player, and tells everyone when the room closes', async () => {
    const host = await device('narrator').host('Chisp')
    const ana = watch(await device('ana').join(host.code, 'Ana'))
    const ben = watch(await device('ben').join(host.code, 'Ben'))
    await until(() => !!ana.view && !!ben.view)

    host.send({ type: 'removePlayer', id: 'ben' })
    await until(() => ben.last?.type === 'closed')
    expect(ben.last).toEqual({ type: 'closed', reason: 'removed' })

    host.leave()
    await until(() => ana.last?.type === 'closed')
    expect(ana.last).toEqual({ type: 'closed', reason: 'host-left' })
  })

  it('picks a new code when one is taken', async () => {
    await device('narrator1').host('One')
    const second = await device('narrator2', ['KXQRTZ', 'ABCDEF']).host('Two')
    expect(second.code).toBe('ABCDEF')
  })
})
