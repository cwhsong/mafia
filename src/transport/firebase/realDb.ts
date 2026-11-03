import { ref, get, set, update, onValue, serverTimestamp, type Database } from 'firebase/database'
import type { Db } from './db'

// Wraps a Firebase Realtime Database in the small Db interface the transport uses.
export function createRealDb(database: Database): Db {
  return {
    get: async (path) => (await get(ref(database, path))).val(),
    set: (path, value) => set(ref(database, path), value),
    update: (updates) => update(ref(database), updates),
    onValue: (path, callback) => onValue(ref(database, path), (snapshot) => callback(snapshot.val())),
    serverTime: () => serverTimestamp(),
  }
}
