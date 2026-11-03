// Security rules tests. These need the Firebase emulator, so they run with
// `npm run test:rules` (and in CI), not with plain `npm test`.
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { get, ref, remove, serverTimestamp, set, update } from 'firebase/database'

let env: RulesTestEnvironment

const CODE = 'KXQRTZ'
const room = `rooms/${CODE}`

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mafia',
    database: {
      rules: readFileSync('database.rules.json', 'utf8'),
      host: '127.0.0.1',
      port: 9000,
    },
  })
})

afterAll(async () => {
  await env.cleanup()
})

// Every test starts with one room hosted by "narrator", with Ana seated.
beforeEach(async () => {
  await env.clearDatabase()
  await env.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), room), {
      meta: { hostUid: 'narrator', hostName: 'Chisp', createdAt: Date.now() },
      host: { state: { seed: 1234, phase: 'lobby' } },
      views: { ana: { kind: 'player', phase: 'lobby' }, ben: { kind: 'player', phase: 'lobby' } },
      requests: { cal: { type: 'join', name: 'Cal' } },
      notices: { ben: { kind: 'rejected', code: 'duplicate-name' } },
    })
  })
})

const as = (uid: string) => env.authenticatedContext(uid).database()
const anonymous = () => env.unauthenticatedContext().database()

describe('reading', () => {
  it('lets any signed-in user read room info and whether it is closed', async () => {
    await assertSucceeds(get(ref(as('stranger'), `${room}/meta`)))
    await assertSucceeds(get(ref(as('stranger'), `${room}/closed`)))
  })

  it('blocks visitors who are not signed in', async () => {
    await assertFails(get(ref(anonymous(), `${room}/meta`)))
  })

  it('never lets anyone list all rooms or read a whole room', async () => {
    await assertFails(get(ref(as('narrator'), 'rooms')))
    await assertFails(get(ref(as('ana'), room)))
  })

  it('lets only the narrator read the full game, including the seed', async () => {
    await assertSucceeds(get(ref(as('narrator'), `${room}/host`)))
    await assertFails(get(ref(as('ana'), `${room}/host`)))
  })

  it('lets a player read their own view but not someone else’s', async () => {
    await assertSucceeds(get(ref(as('ana'), `${room}/views/ana`)))
    await assertFails(get(ref(as('ana'), `${room}/views/ben`)))
    await assertFails(get(ref(as('ana'), `${room}/views`)))
  })

  it('lets the narrator read every view and every join request', async () => {
    await assertSucceeds(get(ref(as('narrator'), `${room}/views/ana`)))
    await assertSucceeds(get(ref(as('narrator'), `${room}/requests`)))
  })

  it('does not let players read other players’ requests', async () => {
    await assertFails(get(ref(as('ana'), `${room}/requests`)))
  })

  it('lets a player read only their own notices', async () => {
    await assertSucceeds(get(ref(as('ben'), `${room}/notices/ben`)))
    await assertFails(get(ref(as('ana'), `${room}/notices/ben`)))
  })
})

describe('writing', () => {
  it('lets the narrator update views and the game', async () => {
    await assertSucceeds(
      update(ref(as('narrator')), {
        [`${room}/views/ana`]: { kind: 'player', phase: 'day' },
        [`${room}/host/state/phase`]: 'day',
        [`${room}/requests/cal`]: null,
        [`${room}/closed`]: true,
      }),
    )
  })

  it('stops players from writing views, the game, or closing the room', async () => {
    await assertFails(set(ref(as('ana'), `${room}/views/ana`), { kind: 'player', phase: 'ended' }))
    await assertFails(set(ref(as('ana'), `${room}/host/state/phase`), 'ended'))
    await assertFails(set(ref(as('ana'), `${room}/closed`), true))
  })

  it('lets a player ask to join or leave under their own id only', async () => {
    await assertSucceeds(set(ref(as('dee'), `${room}/requests/dee`), { type: 'join', name: 'Dee' }))
    await assertSucceeds(set(ref(as('ana'), `${room}/requests/ana`), { type: 'leave' }))
    await assertFails(set(ref(as('dee'), `${room}/requests/eve`), { type: 'join', name: 'Eve' }))
  })

  it('rejects malformed requests and over-long names', async () => {
    await assertFails(set(ref(as('dee'), `${room}/requests/dee`), { type: 'deal' }))
    await assertFails(set(ref(as('dee'), `${room}/requests/dee`), { type: 'join', name: 'x'.repeat(25) }))
  })

  it('does not accept join requests for rooms that do not exist', async () => {
    await assertFails(set(ref(as('dee'), 'rooms/ABCDEF/requests/dee'), { type: 'join', name: 'Dee' }))
  })

  it('lets a player clear their own notice but not write one', async () => {
    await assertSucceeds(remove(ref(as('ben'), `${room}/notices/ben`)))
    await assertFails(set(ref(as('ben'), `${room}/notices/ben`), { kind: 'removed' }))
    await assertFails(remove(ref(as('ana'), `${room}/notices/ben`)))
  })

  it('lets anyone signed in open a new room in their own name', async () => {
    await assertSucceeds(
      set(ref(as('newhost'), 'rooms/ABCDEF'), {
        meta: { hostUid: 'newhost', hostName: 'Dee', createdAt: serverTimestamp() },
        host: { state: { seed: 1 } },
      }),
    )
  })

  it('does not let anyone open a room in someone else’s name', async () => {
    await assertFails(
      set(ref(as('newhost'), 'rooms/ABCDEF'), {
        meta: { hostUid: 'someone-else', hostName: 'Dee', createdAt: serverTimestamp() },
      }),
    )
  })

  it('does not let anyone take over a room that is still active', async () => {
    await assertFails(
      set(ref(as('thief'), room), {
        meta: { hostUid: 'thief', hostName: 'Thief', createdAt: serverTimestamp() },
      }),
    )
  })

  it('lets a new room replace one that has expired (older than a day)', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), `${room}/meta/createdAt`), Date.now() - 2 * 86400000)
    })
    await assertSucceeds(
      set(ref(as('newhost'), room), {
        meta: { hostUid: 'newhost', hostName: 'Dee', createdAt: serverTimestamp() },
      }),
    )
  })

  it('rejects a room with a missing or over-long narrator name', async () => {
    await assertFails(
      set(ref(as('newhost'), 'rooms/ABCDEF'), {
        meta: { hostUid: 'newhost', hostName: 'x'.repeat(25), createdAt: serverTimestamp() },
      }),
    )
    await assertFails(
      set(ref(as('newhost'), 'rooms/ABCDEF'), { meta: { hostUid: 'newhost', createdAt: serverTimestamp() } }),
    )
  })
})
