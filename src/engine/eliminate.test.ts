import { describe, it, expect } from 'vitest'
import type { GameState } from './types'
import { eliminate } from './eliminate'
import { expectEngineError, gameWithRoles, lobbyWith } from './testHelpers'

const five = ['mafioso', 'medic', 'detective', 'villager', 'villager']

describe('eliminate', () => {
  it('marks the player dead and logs it', () => {
    const state = eliminate(gameWithRoles(five), ['id3'], 'vote')
    expect(state.players[3].alive).toBe(false)
    expect(state.log.at(-1)).toEqual({ type: 'eliminated', playerId: 'id3', cause: 'vote' })
  })

  it('keeps playing when nobody has won', () => {
    const state = eliminate(gameWithRoles(five), ['id3'], 'vote')
    expect(state.phase).toBe('day')
    expect(state.winner).toBeNull()
  })

  it('ends the game when a team wins', () => {
    const state = eliminate(gameWithRoles(five), ['id0'], 'vote') // the only Mafioso
    expect(state.phase).toBe('ended')
    expect(state.winner).toBe('town')
    expect(state.log.slice(-2)).toEqual([
      { type: 'eliminated', playerId: 'id0', cause: 'vote' },
      { type: 'game-over', winner: 'town' },
    ])
  })

  it('applies simultaneous deaths before checking for a winner', () => {
    // 1 Mafioso, 2 Villagers. Mafia kill a Villager; the Vigilante shoots the Mafioso.
    // One at a time, the first death would wrongly hand Mafia a win at parity.
    const state = eliminate(gameWithRoles(['mafioso', 'villager', 'villager']), ['id1', 'id0'], 'night')
    expect(state.winner).toBe('town')
    expect(state.players.filter((p) => !p.alive).map((p) => p.id).sort()).toEqual(['id0', 'id1'])
  })

  it('accepts an empty list (a night where nobody died)', () => {
    const before = gameWithRoles(five)
    const after = eliminate(before, [], 'night')
    expect(after.players).toEqual(before.players)
    expect(after.phase).toBe('day')
  })

  it('does not change the original state', () => {
    const before = gameWithRoles(five)
    eliminate(before, ['id3'], 'vote')
    expect(before.players[3].alive).toBe(true)
  })

  it('rejects unknown players', () => {
    expectEngineError(() => eliminate(gameWithRoles(five), ['nope'], 'vote'), 'unknown-player')
  })

  it('rejects players who are already dead', () => {
    const state = eliminate(gameWithRoles(five), ['id3'], 'vote')
    expectEngineError(() => eliminate(state, ['id3'], 'night'), 'already-dead')
  })

  it('rejects the same player twice in one call', () => {
    expectEngineError(() => eliminate(gameWithRoles(five), ['id3', 'id3'], 'night'), 'already-dead')
  })

  it('applies nothing if any player in the list is invalid', () => {
    const before = gameWithRoles(five)
    expectEngineError(() => eliminate(before, ['id3', 'nope'], 'night'), 'unknown-player')
    expect(before.players[3].alive).toBe(true)
  })

  it('cannot be used in the lobby', () => {
    expectEngineError(() => eliminate(lobbyWith(5), ['id0'], 'host'), 'wrong-phase')
  })

  it('cannot be used after the game has ended', () => {
    const ended: GameState = eliminate(gameWithRoles(five), ['id0'], 'vote')
    expectEngineError(() => eliminate(ended, ['id3'], 'host'), 'wrong-phase')
  })
})