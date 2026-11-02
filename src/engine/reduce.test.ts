import { describe, it, expect } from 'vitest'
import type { Command } from './types'
import { reduce, applyCommands } from './reduce'
import { createGame, addPlayer, removePlayer, setRoleSlots } from './setup'
import { dealRoles } from './deal'
import { advancePhase } from './phases'
import { eliminate } from './eliminate'
import { expectEngineError, gameWithRoles, lobbyWith } from './testHelpers'

const five = ['mafioso', 'medic', 'detective', 'villager', 'villager']

describe('reduce sends each command to the right function', () => {
  it('addPlayer', () => {
    const state = createGame('host', 1)
    expect(reduce(state, { type: 'addPlayer', id: 'a', name: 'Ana' }))
      .toEqual(addPlayer(state, 'a', 'Ana'))
  })

  it('removePlayer', () => {
    const state = lobbyWith(3)
    expect(reduce(state, { type: 'removePlayer', id: 'id1' }))
      .toEqual(removePlayer(state, 'id1'))
  })

  it('setRoleSlots', () => {
    const state = lobbyWith(5)
    expect(reduce(state, { type: 'setRoleSlots', slots: five }))
      .toEqual(setRoleSlots(state, five))
  })

  it('deal', () => {
    const state = setRoleSlots(lobbyWith(5), five)
    expect(reduce(state, { type: 'deal' })).toEqual(dealRoles(state))
  })

  it('advance', () => {
    const state = gameWithRoles(five)
    expect(reduce(state, { type: 'advance' })).toEqual(advancePhase(state))
  })

  it('eliminate', () => {
    const state = gameWithRoles(five)
    expect(reduce(state, { type: 'eliminate', playerIds: ['id3'], cause: 'vote' }))
      .toEqual(eliminate(state, ['id3'], 'vote'))
  })
})

describe('reduce', () => {
  it('passes engine errors through', () => {
    expectEngineError(() => reduce(lobbyWith(5), { type: 'deal' }), 'invalid-setup')
  })

  it('rejects unknown commands arriving at runtime', () => {
    const bogus = { type: 'explode' } as unknown as Command
    expectEngineError(() => reduce(lobbyWith(5), bogus), 'unknown-command')
  })

  it('does not change the original state', () => {
    const before = lobbyWith(2)
    reduce(before, { type: 'addPlayer', id: 'x', name: 'Xia' })
    expect(before.players).toHaveLength(2)
  })
})

describe('applyCommands', () => {
  it('applies commands in order', () => {
    const state = applyCommands(createGame('host', 7), [
      { type: 'addPlayer', id: 'a', name: 'Ana' },
      { type: 'addPlayer', id: 'b', name: 'Ben' },
      { type: 'removePlayer', id: 'a' },
    ])
    expect(state.players.map((p) => p.name)).toEqual(['Ben'])
  })

  it('rebuilds the same game from the same commands', () => {
    const commands: Command[] = [
      ...['Ana', 'Ben', 'Cal', 'Dee', 'Eve'].map((name, i): Command => ({
        type: 'addPlayer', id: `p${i}`, name,
      })),
      { type: 'setRoleSlots', slots: five },
      { type: 'deal' },
      { type: 'advance' },
    ]
    const first = applyCommands(createGame('host', 99), commands)
    const second = applyCommands(createGame('host', 99), commands)
    expect(second).toEqual(first)
  })

  it('returns the starting state for an empty list', () => {
    const start = lobbyWith(3)
    expect(applyCommands(start, [])).toBe(start)
  })
})