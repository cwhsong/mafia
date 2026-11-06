import { describe, expect, it } from 'vitest'
import { applyCommands, reduce, createGame, type GameState } from '../engine'
import { botMoves } from './bots'

function game(roles: string[]): GameState {
  let state = createGame('host', 7)
  roles.forEach((_, i) => (state = reduce(state, { type: 'addPlayer', id: `test-p${i}`, name: `P${i}` })))
  return { ...state, phase: 'day', round: 1, roleSlots: roles, players: state.players.map((p, i) => ({ ...p, roleId: roles[i] })) }
}

const seq = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]
}

describe('bots', () => {
  const roles = ['godfather', 'framer', 'medic', 'detective', 'veteran', 'villager', 'villager']

  it('make a valid pick for every bot at night, and the night resolves', () => {
    let state = reduce(game(roles), { type: 'advance' })
    const commands = botMoves(state, new Set(), seq(0.1, 0.6, 0.3))
    state = applyCommands(state, commands) // throws if any pick is invalid
    expect(Object.keys(state.nightPicks).length).toBeGreaterThanOrEqual(6)
    expect(() => reduce(state, { type: 'resolveNight' })).not.toThrow()
  })

  it('decide once per phase', () => {
    const state = reduce(game(roles), { type: 'advance' })
    const done = new Set<string>()
    botMoves(state, done)
    expect(botMoves(state, done)).toEqual([])
  })

  it('vote during the day', () => {
    let state = reduce(game(roles), { type: 'advance' })
    state = applyCommands(state, [{ type: 'resolveNight' }, { type: 'reveal' }])
    const living = state.players.filter((p) => p.alive).length
    state = applyCommands(state, botMoves(state, new Set()))
    expect(Object.keys(state.votes)).toHaveLength(living)
  })
})
