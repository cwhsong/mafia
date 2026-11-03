import { describe, it, expect } from 'vitest'
import { playerView } from '../../engine/views'
import { eliminate } from '../../engine/eliminate'
import { lobbyWith, setupGame } from '../../engine/testHelpers'
import { firebaseShape } from './db'
import { normalizeGameState, normalizePlayerView } from './normalize'

// What comes back after a round trip through Firebase
const roundTrip = (value: unknown) => structuredClone(firebaseShape(value))

const cast = { mafioso: ['Ana', 'Ben'], medic: 'Cal', villager: ['Dee', 'Eve'] }

describe('normalizeGameState', () => {
  it('restores an empty lobby (Firebase drops the empty lists and null winner)', () => {
    const state = lobbyWith(0)
    expect(normalizeGameState(roundTrip(state))).toEqual(state)
  })

  it('restores a lobby with players but no roles yet', () => {
    const state = lobbyWith(4)
    expect(normalizeGameState(roundTrip(state))).toEqual(state)
  })

  it('restores a game in progress, including seat 0 and dead players', () => {
    const state = eliminate(setupGame(cast), ['dee'], 'vote')
    expect(normalizeGameState(roundTrip(state))).toEqual(state)
  })

  it('restores a finished game', () => {
    const state = eliminate(setupGame(cast), ['ana', 'ben'], 'vote')
    expect(normalizeGameState(roundTrip(state))).toEqual(state)
  })

  it('reads lists stored as numbered objects', () => {
    const state = lobbyWith(2)
    const raw = roundTrip(state) as Record<string, unknown>
    raw.players = { 0: (raw.players as unknown[])[0], 1: (raw.players as unknown[])[1] }
    expect(normalizeGameState(raw).players).toEqual(state.players)
  })
})

describe('normalizePlayerView', () => {
  it('restores a lobby view', () => {
    const view = playerView(lobbyWith(3), 'id0')
    expect(normalizePlayerView(roundTrip(view))).toEqual(view)
  })

  it('restores a town view with no teammates', () => {
    const view = playerView(setupGame(cast), 'cal')
    expect(normalizePlayerView(roundTrip(view))).toEqual(view)
  })

  it('restores a Mafia view with a teammate', () => {
    const view = playerView(setupGame(cast), 'ana')
    expect(normalizePlayerView(roundTrip(view))).toEqual(view)
  })

  it('restores a game-over view with every role', () => {
    const view = playerView(eliminate(setupGame(cast), ['ana', 'ben'], 'vote'), 'eve')
    expect(normalizePlayerView(roundTrip(view))).toEqual(view)
  })
})
