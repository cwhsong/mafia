import { describe, it, expect } from 'vitest'
import { getPlayerId, type KeyValueStore } from './identity'

// A tiny in-memory stand-in for sessionStorage
function memoryStore(): KeyValueStore {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

describe('getPlayerId', () => {
  it('creates an id the first time', () => {
    const id = getPlayerId(memoryStore())
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('returns the same id every time for the same tab', () => {
    const store = memoryStore()
    expect(getPlayerId(store)).toBe(getPlayerId(store))
  })

  it('gives different tabs different ids', () => {
    expect(getPlayerId(memoryStore())).not.toBe(getPlayerId(memoryStore()))
  })
})