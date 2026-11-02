const PLAYER_ID_KEY = 'daybreak.playerId'

// The two Storage methods we actually use, so tests can pass a fake.
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>

// Returns this tab's player id, creating one the first time.
export function getPlayerId(store: KeyValueStore = sessionStorage): string {
  const existing = store.getItem(PLAYER_ID_KEY)
  if (existing) return existing

  const id = crypto.randomUUID()
  store.setItem(PLAYER_ID_KEY, id)
  return id
}