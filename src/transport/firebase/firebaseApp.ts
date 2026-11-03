import { initializeApp } from 'firebase/app'
import {
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  signInAnonymously,
  connectAuthEmulator,
} from 'firebase/auth'
import { getDatabase, connectDatabaseEmulator } from 'firebase/database'
import { firebaseConfig } from '../firebaseConfig'
import { createRealDb } from './realDb'

interface Options {
  // true: each tab is a separate person (for testing several players in one browser).
  // false: one person per browser, remembered after closing the tab (real phones).
  perTabIdentity: boolean
  useEmulator: boolean
}

// Connects to Firebase and returns what the transport needs.
export function connectFirebase({ perTabIdentity, useEmulator }: Options) {
  const app = initializeApp(firebaseConfig)
  const auth = initializeAuth(app, {
    persistence: perTabIdentity ? browserSessionPersistence : browserLocalPersistence,
  })
  const database = getDatabase(app)

  if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectDatabaseEmulator(database, '127.0.0.1', 9000)
  }

  const db = createRealDb(database)

  // Anonymous sign-in: no account needed. The same browser (or tab) keeps the same id.
  let uid: Promise<string> | null = null
  function signIn(): Promise<string> {
    uid ??= (async () => {
      await auth.authStateReady()
      if (auth.currentUser) return auth.currentUser.uid
      const credential = await signInAnonymously(auth)
      return credential.user.uid
    })().catch((error) => {
      uid = null // let the next attempt try again
      throw error
    })
    return uid
  }

  return { db, signIn }
}
