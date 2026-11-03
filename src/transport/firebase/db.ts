// The handful of Realtime Database operations the transport needs.
// The real app wraps the Firebase SDK (firebaseApp.ts); tests use createMemoryDb().
export interface Db {
  get(path: string): Promise<unknown>
  set(path: string, value: unknown): Promise<void>
  // Writes several paths at once, all or nothing (paths are from the database root).
  update(updates: Record<string, unknown>): Promise<void>
  // Calls back with the current value, then again on every change. Returns an unsubscribe.
  onValue(path: string, callback: (value: unknown) => void): () => void
  // A placeholder the server replaces with its own clock time.
  serverTime(): unknown
}

// ---------- In-memory stand-in for tests ----------

type Tree = Record<string, unknown>

// Firebase doesn't store null, undefined, empty arrays or empty objects.
// Copying that here means tests catch any code that forgets to handle missing values.
export function firebaseShape(value: unknown): unknown {
  if (value === null || value === undefined) return undefined
  if (Array.isArray(value)) {
    const items = value.map(firebaseShape)
    return items.some((v) => v !== undefined) ? items : undefined
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Tree)
      .map(([k, v]) => [k, firebaseShape(v)] as const)
      .filter(([, v]) => v !== undefined)
    return entries.length ? Object.fromEntries(entries) : undefined
  }
  return value
}

const split = (path: string) => path.split('/').filter(Boolean)

function readAt(tree: Tree, parts: string[]): unknown {
  let node: unknown = tree
  for (const part of parts) {
    if (node === null || typeof node !== 'object') return null
    node = (node as Tree)[part]
  }
  return node === undefined ? null : structuredClone(node)
}

function writeAt(tree: Tree, parts: string[], value: unknown) {
  const shaped = firebaseShape(value)
  const parents: Tree[] = [tree]
  let node = tree
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== 'object' || node[part] === null) {
      if (shaped === undefined) return // deleting something that isn't there
      node[part] = {}
    }
    node = node[part] as Tree
    parents.push(node)
  }
  const last = parts.at(-1)!
  if (shaped === undefined) delete node[last]
  else node[last] = shaped

  // Remove parents left empty, like Firebase does
  for (let i = parents.length - 1; i > 0; i--) {
    if (Object.keys(parents[i]).length === 0) delete parents[i - 1][parts[i - 1]]
  }
}

export function createMemoryDb(): Db & { dump(): Tree } {
  const tree: Tree = {}
  const listeners = new Set<{ parts: string[]; callback: (value: unknown) => void }>()

  function touches(a: string[], b: string[]) {
    const n = Math.min(a.length, b.length)
    return a.slice(0, n).every((part, i) => part === b[i])
  }

  function notify(changed: string[][]) {
    for (const listener of listeners) {
      if (changed.some((parts) => touches(parts, listener.parts))) {
        const value = readAt(tree, listener.parts)
        queueMicrotask(() => {
          if (listeners.has(listener)) listener.callback(value)
        })
      }
    }
  }

  return {
    async get(path) {
      return readAt(tree, split(path))
    },
    async set(path, value) {
      writeAt(tree, split(path), structuredClone(value))
      notify([split(path)])
    },
    async update(updates) {
      const changed = Object.keys(updates).map(split)
      for (const [path, value] of Object.entries(updates)) {
        writeAt(tree, split(path), structuredClone(value))
      }
      notify(changed)
    },
    onValue(path, callback) {
      const listener = { parts: split(path), callback }
      listeners.add(listener)
      const value = readAt(tree, listener.parts)
      queueMicrotask(() => {
        if (listeners.has(listener)) callback(value)
      })
      return () => listeners.delete(listener)
    },
    serverTime() {
      return Date.now()
    },
    dump() {
      return structuredClone(tree)
    },
  }
}
