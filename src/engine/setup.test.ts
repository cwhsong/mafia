import { describe, it, expect } from 'vitest'
import type { GameState } from './types'
import {
  createGame, addPlayer, removePlayer, setRoleSlots, validateSetup, MAX_PLAYERS,
} from './setup'
import { expectEngineError, lobbyWith } from './testHelpers'

describe('createGame', () => {
  it('starts an empty lobby', () => {
    const state = createGame('host', 42)
    expect(state.phase).toBe('lobby')
    expect(state.round).toBe(0)
    expect(state.players).toEqual([])
    expect(state.seed).toBe(42)
    expect(state.winner).toBeNull()
  })
})

describe('addPlayer', () => {
  it('adds players in seat order', () => {
    const state = lobbyWith(3)
    expect(state.players.map((p) => p.seat)).toEqual([0, 1, 2])
    expect(state.players[0]).toEqual({
      id: 'id0', name: 'P0', seat: 0, alive: true, roleId: null,
    })
  })

  it('does not change the original state', () => {
    const before = createGame('host', 1)
    addPlayer(before, 'a', 'Ana')
    expect(before.players).toEqual([])
  })

  it('trims names', () => {
    const state = addPlayer(createGame('host', 1), 'a', '  Ana  ')
    expect(state.players[0].name).toBe('Ana')
  })

  it('rejects empty names', () => {
    expectEngineError(() => addPlayer(createGame('host', 1), 'a', '   '), 'empty-name')
  })

  it('rejects duplicate ids', () => {
    const state = addPlayer(createGame('host', 1), 'a', 'Ana')
    expectEngineError(() => addPlayer(state, 'a', 'Ben'), 'duplicate-id')
  })

  it('rejects duplicate names, ignoring case', () => {
    const state = addPlayer(createGame('host', 1), 'a', 'Ana')
    expectEngineError(() => addPlayer(state, 'b', 'ana'), 'duplicate-name')
  })

  it('rejects players past the maximum', () => {
    expectEngineError(() => addPlayer(lobbyWith(MAX_PLAYERS), 'x', 'Extra'), 'too-many-players')
  })

  it('only works in the lobby', () => {
    const started: GameState = { ...lobbyWith(5), phase: 'night' }
    expectEngineError(() => addPlayer(started, 'x', 'Late'), 'wrong-phase')
  })
})

describe('removePlayer', () => {
  it('removes the player and closes the seat gap', () => {
    const state = removePlayer(lobbyWith(4), 'id1')
    expect(state.players.map((p) => p.name)).toEqual(['P0', 'P2', 'P3'])
    expect(state.players.map((p) => p.seat)).toEqual([0, 1, 2])
  })

  it('rejects unknown players', () => {
    expectEngineError(() => removePlayer(lobbyWith(2), 'nope'), 'unknown-player')
  })

  it('only works in the lobby', () => {
    const started: GameState = { ...lobbyWith(5), phase: 'day' }
    expectEngineError(() => removePlayer(started, 'id0'), 'wrong-phase')
  })
})

describe('setRoleSlots', () => {
  it('stores the chosen roles', () => {
    const state = setRoleSlots(lobbyWith(5), ['mafioso', 'medic', 'detective', 'villager', 'villager'])
    expect(state.roleSlots).toHaveLength(5)
  })

  it('rejects unknown roles', () => {
    expectEngineError(() => setRoleSlots(lobbyWith(5), ['medik']), 'unknown-role')
  })

  it('rejects unavailable roles', () => {
    expectEngineError(() => setRoleSlots(lobbyWith(5), ['jester']), 'role-unavailable')
  })

  it('only works in the lobby', () => {
    const started: GameState = { ...lobbyWith(5), phase: 'night' }
    expectEngineError(() => setRoleSlots(started, ['villager']), 'wrong-phase')
  })
})

describe('validateSetup', () => {
  const fiveRoles = ['mafioso', 'medic', 'detective', 'villager', 'villager']

  it('returns no problems for a valid setup', () => {
    expect(validateSetup(setRoleSlots(lobbyWith(5), fiveRoles))).toEqual([])
  })

  it('flags too few players', () => {
    const state = setRoleSlots(lobbyWith(4), ['mafioso', 'medic', 'villager', 'villager'])
    expect(validateSetup(state).join(' ')).toMatch(/at least 5 players/)
  })

  it('flags a role count that does not match players', () => {
    const state = setRoleSlots(lobbyWith(6), fiveRoles)
    expect(validateSetup(state).join(' ')).toMatch(/Pick 6 roles/)
  })

  it('flags a game with no Mafia', () => {
    const state = setRoleSlots(lobbyWith(5), ['medic', 'detective', 'villager', 'villager', 'villager'])
    expect(validateSetup(state).join(' ')).toMatch(/at least one Mafia/)
  })

  it('flags Mafia at half or more', () => {
    const state = setRoleSlots(lobbyWith(6), [
      'mafioso', 'mafioso', 'mafioso', 'medic', 'villager', 'villager',
    ])
    expect(validateSetup(state).join(' ')).toMatch(/Too many Mafia/)
  })

  it('reports several problems at once', () => {
    expect(validateSetup(lobbyWith(3)).length).toBeGreaterThan(1)
  })
})