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
import type { PlayerView } from '../../engine'
import { generateRoomCode } from '../roomCode'
import { JoinError, type RoomConnection, type RoomEvent, type RoomTransport } from '../types'
import { playerMaySend, NOT_ALLOWED } from '../permissions'
import type { Db } from './db'

/*
  Database layout for one room (rules in database.rules.json):

  rooms/{CODE}/
    meta       { hostUid, hostName, createdAt }   any signed-in user can read
    closed     true once the narrator closes it    any signed-in user can read
    host/state the full GameState as JSON text     narrator only (it includes the seed)
    views/{uid}    that player's PlayerView as JSON text   that player + narrator
    requests/{uid}/{id}  join, leave, or a command  written by that player, read by narrator
    notices/{uid}  { kind: 'rejected'|'removed'|'error' }  that player + narrator

  Game data is stored as JSON text so it comes back exactly as saved
  (Firebase would otherwise drop nulls and empty lists).
*/

export const ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000

interface Meta {
  hostUid: string
  hostName: string
  createdAt: number
}

interface Request {
  type: 'join' | 'leave' | 'command'
  name?: string
  command?: string // JSON text of a Command
}

interface Notice {
  kind: 'rejected' | 'removed' | 'error'
  code?: string
  message?: string
  at?: number
}

// Request ids sort in the order they were made.
function requestId(): string {
  return `${Date.now().toString(36).padStart(9, '0')}${Math.random().toString(36).slice(2, 8)}`
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
      const updates: Record<string, unknown> = { [`${base}/host/state`]: JSON.stringify(state), ...extra }
      for (const player of state.players) {
        updates[`${base}/views/${player.id}`] = JSON.stringify(playerView(state, player.id))
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

    function handleRequest(uid: string, id: string, request: Request) {
      const consumed = { [`${base}/requests/${uid}/${id}`]: null }
      const tellPlayer = (code: string, message: string) =>
        db
          .update({ ...consumed, [`${base}/notices/${uid}`]: { kind: 'error', code, message, at: Date.now() } })
          .catch(reportWriteError)

      if (request.type === 'command') {
        let command: Command
        try {
          command = JSON.parse(String(request.command)) as Command
        } catch {
          tellPlayer('unknown-command', 'That request couldn’t be read.')
          return
        }
        if (!playerMaySend(command, uid)) {
          tellPlayer(NOT_ALLOWED.code, NOT_ALLOWED.message)
          return
        }
        try {
          apply(command, consumed)
        } catch (error) {
          if (!(error instanceof EngineError)) throw error
          tellPlayer(error.code, error.message)
        }
        return
      }

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

    // Each request is handled once, in the order it was made, then deleted.
    const handled = new Set<string>()
    const stopRequests = db.onValue(`${base}/requests`, (value) => {
      if (!value) return
      const queue: [string, string, Request][] = []
      for (const [uid, requests] of Object.entries(value as Record<string, Record<string, Request>>)) {
        for (const [id, request] of Object.entries(requests ?? {})) queue.push([uid, id, request])
      }
      queue.sort((a, b) => (a[1] < b[1] ? -1 : 1))
      for (const [uid, id, request] of queue) {
        const key = `${uid}/${id}`
        if (handled.has(key)) continue
        handled.add(key)
        handleRequest(uid, id, request)
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
        send(command) {
          if (!playerMaySend(command, uid)) {
            for (const listener of listeners) listener({ type: 'error', ...NOT_ALLOWED })
            return
          }
          const request: Request = { type: 'command', command: JSON.stringify(command) }
          db.set(`${base}/requests/${uid}/${requestId()}`, request).catch(() => {
            for (const listener of listeners) {
              listener({ type: 'error', code: 'offline', message: 'Couldn’t send that. Check your connection.' })
            }
          })
        },
        leave() {
          stopAll()
          listeners.clear()
          db.set(`${base}/requests/${uid}/${requestId()}`, { type: 'leave' } satisfies Request).catch(() => {})
        },
      }

      const timer = setTimeout(() => {
        fail(new JoinError('host-offline', 'The narrator isn’t connected right now. Try again in a moment.'))
      }, joinTimeoutMs)

      function listen() {
        stops.push(
          db.onValue(`${base}/views/${uid}`, (value) => {
            if (typeof value !== 'string') return
            emit({ type: 'view', view: JSON.parse(value) as PlayerView, hostName })
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
            } else if (notice.kind === 'error' && joined) {
              for (const listener of listeners) {
                listener({ type: 'error', code: notice.code ?? 'error', message: notice.message ?? 'Something went wrong.' })
              }
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
          return db.set(`${base}/requests/${uid}/${requestId()}`, { type: 'join', name } satisfies Request)
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
            host: { state: JSON.stringify(state) },
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
      const saved = await db.get(`${roomPath(code)}/host/state`)
      if (typeof saved !== 'string') throw new JoinError('room-not-found', `Room ${code} is no longer available.`)
      const state = JSON.parse(saved) as GameState
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
