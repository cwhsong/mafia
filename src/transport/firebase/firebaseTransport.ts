import {
  createGame,
  reduce,
  playerView,
  narratorView,
  randomSeed,
  EngineError,
  type Command,
  type GameState,
} from '../../engine'
import { generateRoomCode } from '../roomCode'
import { JoinError, type RoomConnection, type RoomEvent, type RoomTransport } from '../types'
import type { Db } from './db'
import { normalizeGameState, normalizePlayerView } from './normalize'

/*
  Database layout for one room (rules in database.rules.json):

  rooms/{CODE}/
    meta       { hostUid, hostName, createdAt }   any signed-in user can read
    closed     true once the narrator closes it    any signed-in user can read
    host/state the full GameState, seed included   narrator only
    views/{uid}    that player's PlayerView        that player + narrator
    requests/{uid} { type: 'join'|'leave', name }  written by that player, read by narrator
    notices/{uid}  { kind: 'rejected'|'removed' }  that player + narrator
*/

export const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000

interface Meta {
  hostUid: string
  hostName: string
  createdAt: number
}

interface Request {
  type: 'join' | 'leave'
  name?: string
}

interface Notice {
  kind: 'rejected' | 'removed'
  code?: string
  message?: string
}

interface FirebaseTransportOptions {
  db: Db
  signIn: () => Promise<string>
  joinTimeoutMs?: number
  newCode?: () => string
  newSeed?: () => number
  now?: () => number
}

export function createFirebaseTransport(options: FirebaseTransportOptions): RoomTransport {
  const {
    db,
    signIn,
    joinTimeoutMs = 8000,
    newCode = generateRoomCode,
    newSeed = randomSeed,
    now = Date.now,
  } = options

  const roomPath = (code: string) => `rooms/${code}`

  async function me(): Promise<string> {
    try {
      return await signIn()
    } catch {
      throw new JoinError('offline', 'Couldn’t connect. Check your internet connection and try again.')
    }
  }

  async function readMeta(code: string): Promise<Meta | null> {
    const meta = (await db.get(`${roomPath(code)}/meta`)) as Meta | null
    if (!meta) return null
    if (now() - Number(meta.createdAt ?? 0) > ROOM_LIFETIME_MS) return null // expired
    return meta
  }

  // ---------- Narrator ----------

  function startHost(code: string, hostName: string, initial: GameState): RoomConnection {
    const base = roomPath(code)
    let state = initial
    const listeners = new Set<(event: RoomEvent) => void>()

    function emit(event: RoomEvent) {
      for (const listener of listeners) listener(event)
    }

    function reportWriteError() {
      emit({ type: 'error', code: 'offline', message: 'Couldn’t save to the server. Check your connection.' })
    }

    // Saves the game and every player's view in one write.
    function publish(extra: Record<string, unknown> = {}) {
      const updates: Record<string, unknown> = { [`${base}/host/state`]: state, ...extra }
      for (const player of state.players) {
        updates[`${base}/views/${player.id}`] = playerView(state, player.id)
      }
      emit({ type: 'view', view: narratorView(state), hostName })
      db.update(updates).catch(reportWriteError)
    }

    function apply(command: Command, extra: Record<string, unknown> = {}) {
      const before = state.players.map((p) => p.id)
      state = reduce(state, command)
      const removed: Record<string, unknown> = {}
      for (const id of before) {
        if (!state.players.some((p) => p.id === id)) {
          removed[`${base}/views/${id}`] = null
          removed[`${base}/notices/${id}`] = { kind: 'removed' } satisfies Notice
        }
      }
      publish({ ...removed, ...extra })
    }

    function handleRequest(uid: string, request: Request) {
      const consumed = { [`${base}/requests/${uid}`]: null }

      if (request.type === 'join') {
        if (state.players.some((p) => p.id === uid)) {
          publish(consumed) // already seated (refresh): resend their view
          return
        }
        try {
          apply({ type: 'addPlayer', id: uid, name: String(request.name ?? '') }, consumed)
        } catch (error) {
          if (!(error instanceof EngineError)) throw error
          const notice: Notice = {
            kind: 'rejected',
            code: error.code,
            message: error.code === 'wrong-phase' ? 'This game has already started.' : error.message,
          }
          db.update({ ...consumed, [`${base}/notices/${uid}`]: notice }).catch(reportWriteError)
        }
        return
      }

      if (request.type === 'leave') {
        if (state.phase === 'lobby' && state.players.some((p) => p.id === uid)) {
          apply({ type: 'removePlayer', id: uid }, consumed)
        } else {
          db.update(consumed).catch(reportWriteError)
        }
      }
    }

    const stopRequests = db.onValue(`${base}/requests`, (value) => {
      if (!value) return
      for (const [uid, request] of Object.entries(value as Record<string, Request>)) {
        handleRequest(uid, request)
      }
    })

    publish()

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
        stopRequests()
        listeners.clear()
        db.update({ [`${base}/closed`]: true, [`${base}/requests`]: null }).catch(() => {})
      },
    }
  }

  // ---------- Player ----------

  function startPlayer(code: string, uid: string, name: string, hostName: string): Promise<RoomConnection> {
    const base = roomPath(code)

    return new Promise<RoomConnection>((resolve, reject) => {
      const listeners = new Set<(event: RoomEvent) => void>()
      const stops: (() => void)[] = []
      let latest: RoomEvent | null = null
      let joined = false
      let finished = false

      function emit(event: RoomEvent) {
        latest = event
        for (const listener of listeners) listener(event)
      }

      function stopAll() {
        stops.forEach((stop) => stop())
        stops.length = 0
      }

      function fail(error: JoinError) {
        if (joined || finished) return
        finished = true
        clearTimeout(timer)
        stopAll()
        reject(error)
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
          for (const listener of listeners) {
            listener({ type: 'error', code: 'not-allowed', message: 'Only the narrator can do that.' })
          }
        },
        leave() {
          stopAll()
          listeners.clear()
          db.set(`${base}/requests/${uid}`, { type: 'leave' } satisfies Request).catch(() => {})
        },
      }

      const timer = setTimeout(() => {
        fail(new JoinError('host-offline', 'The narrator isn’t connected right now. Try again in a moment.'))
      }, joinTimeoutMs)

      function listen() {
        stops.push(
          db.onValue(`${base}/views/${uid}`, (value) => {
            if (!value) return
            emit({ type: 'view', view: normalizePlayerView(value), hostName })
            if (!joined && !finished) {
              joined = true
              clearTimeout(timer)
              resolve(connection)
            }
          }),
          db.onValue(`${base}/notices/${uid}`, (value) => {
            const notice = value as Notice | null
            if (!notice) return
            if (notice.kind === 'rejected') {
              fail(new JoinError(notice.code ?? 'rejected', notice.message ?? 'The narrator couldn’t add you.'))
            } else if (notice.kind === 'removed' && joined) {
              stopAll()
              emit({ type: 'closed', reason: 'removed' })
            }
          }),
          db.onValue(`${base}/closed`, (value) => {
            if (!value) return
            if (joined) {
              stopAll()
              emit({ type: 'closed', reason: 'host-left' })
            } else {
              fail(new JoinError('room-not-found', `No game found with code ${code}.`))
            }
          }),
        )
      }

      // Clear any old notice first (e.g. from an earlier removal), then ask to join.
      db.set(`${base}/notices/${uid}`, null)
        .then(() => {
          listen()
          return db.set(`${base}/requests/${uid}`, { type: 'join', name } satisfies Request)
        })
        .catch(() => fail(new JoinError('offline', 'Couldn’t reach the server. Check your connection.')))
    })
  }

  // Any unexpected failure (offline, permission denied) becomes a plain-language JoinError.
  async function guard<T>(attempt: () => Promise<T>): Promise<T> {
    try {
      return await attempt()
    } catch (error) {
      if (error instanceof JoinError) throw error
      console.error(error)
      throw new JoinError('unavailable', 'Couldn’t reach the game server. Check your connection and try again.')
    }
  }

  return {
    host: (hostName) => guard(async () => {
      const uid = await me()
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode()
        if (await readMeta(code)) continue // code in use; try another
        const state = createGame(uid, newSeed())
        try {
          await db.set(roomPath(code), {
            meta: { hostUid: uid, hostName, createdAt: db.serverTime() },
            host: { state },
          })
        } catch {
          continue // someone else got this code first
        }
        return startHost(code, hostName, state)
      }
      throw new JoinError('unavailable', 'Couldn’t open a room. Try again.')
    }),

    resumeHost: (code) => guard(async () => {
      const uid = await me()
      const meta = await readMeta(code)
      const closed = await db.get(`${roomPath(code)}/closed`)
      if (!meta || closed || meta.hostUid !== uid) {
        throw new JoinError('room-not-found', `Room ${code} is no longer available.`)
      }
      const state = normalizeGameState(await db.get(`${roomPath(code)}/host/state`))
      return startHost(code, meta.hostName, state)
    }),

    join: (code, name) => guard(async () => {
      const uid = await me()
      const meta = await readMeta(code)
      const closed = await db.get(`${roomPath(code)}/closed`)
      if (!meta || closed) throw new JoinError('room-not-found', `No game found with code ${code}.`)
      if (meta.hostUid === uid) {
        throw new JoinError(
          'is-narrator',
          'You’re the narrator of this room in another tab. To join as a player in the same browser, open the site with ?test at the end of the address.',
        )
      }
      return startPlayer(code, uid, name, meta.hostName)
    }),
  }
}
