import { describe, it, expect } from 'vitest'
import type { Command, GameState } from './types'
import { createGame } from './setup'
import { reduce, applyCommands } from './reduce'
import { expectEngineError, setupGame } from './testHelpers'

// Turns the log into readable lines like 'night 1' or 'eliminated (vote)'
function timeline(state: GameState): string[] {
  return state.log.map((e) => {
    if (e.type === 'phase') return `${e.phase} ${e.round}`
    if (e.type === 'eliminated') return `eliminated (${e.cause})`
    if (e.type === 'game-over') return `game-over: ${e.winner}`
    return e.type
  })
}

const advance: Command = { type: 'advance' }
const kill = (id: string): Command => ({ type: 'eliminate', playerIds: [id], cause: 'night' })
const voteOut = (id: string): Command => ({ type: 'eliminate', playerIds: [id], cause: 'vote' })

describe('full game: Town wins', () => {
  // Lobby → deal, all through commands, with a real seeded shuffle
  const names = ['Ana', 'Ben', 'Cal', 'Dee', 'Eve', 'Fay', 'Gus']
  const setup: Command[] = [
    ...names.map((name): Command => ({ type: 'addPlayer', id: name.toLowerCase(), name })),
    {
      type: 'setRoleSlots',
      slots: ['mafioso', 'mafioso', 'medic', 'detective', 'villager', 'villager', 'villager'],
    },
    { type: 'deal' },
  ]
  const dealt = applyCommands(createGame('host', 3993), setup)

  // We don't know who got Mafia until after the shuffle, so look it up
  const mafia = dealt.players.filter((p) => p.roleId === 'mafioso').map((p) => p.id)
  const town = dealt.players.filter((p) => p.roleId !== 'mafioso').map((p) => p.id)

  const final = applyCommands(dealt, [
    advance,              // Day 1 → Night 1
    advance,              // → Dawn 1
    kill(town[0]),        // Mafia kill a town player (2 Mafia vs 4)
    advance,              // → Day 2
    advance,              // → Vote 2
    voteOut(mafia[0]),    // Town catch a Mafioso (1 vs 4)
    advance,              // → Night 2
    advance,              // → Dawn 2
    kill(town[1]),        // Another night kill (1 vs 3)
    advance,              // → Day 3
    advance,              // → Vote 3
    voteOut(mafia[1]),    // Last Mafioso voted out → the finale
    { type: 'revealWinner' }, // the narrator reveals: Town win
  ])

  it('deals 2 Mafiosos and starts on Day 1', () => {
    expect(mafia).toHaveLength(2)
    expect(dealt.phase).toBe('day')
    expect(dealt.round).toBe(1)
  })

  it('ends with Town winning', () => {
    expect(final.phase).toBe('ended')
    expect(final.winner).toBe('town')
  })

  it('leaves the right players alive', () => {
    const alive = final.players.filter((p) => p.alive).map((p) => p.id)
    expect(alive.sort()).toEqual(town.slice(2).sort())
  })

  it('records the whole game in order', () => {
    expect(timeline(final)).toEqual([
      'dealt',
      'day 1',
      'night 1',
      'dawn 1',
      'eliminated (night)',
      'day 2',
      'vote 2',
      'eliminated (vote)',
      'night 2',
      'dawn 2',
      'eliminated (night)',
      'day 3',
      'vote 3',
      'eliminated (vote)',
      'finale 3',
      'game-over: town',
    ])
  })

  it('refuses any command after the game ends', () => {
    expectEngineError(() => reduce(final, advance), 'wrong-phase')
  })
})

describe('full game: Mafia win', () => {
  const start = setupGame({
    mafioso: ['Ana', 'Ben'],
    medic: 'Cal',
    detective: 'Dee',
    villager: ['Eve', 'Fay', 'Gus'],
  })

  const final = applyCommands(start, [
    advance,          // → Night 1
    advance,          // → Dawn 1
    kill('cal'),      // Medic killed (2 Mafia vs 4)
    advance,          // → Day 2
    advance,          // → Vote 2
    voteOut('eve'),   // Town vote out an innocent Villager (2 vs 3)
    advance,          // → Night 2
    advance,          // → Dawn 2
    kill('fay'),      // 2 vs 2: Mafia reach parity → the finale
    { type: 'revealWinner' },
  ])

  it('ends with the Mafia winning at parity', () => {
    expect(final.phase).toBe('ended')
    expect(final.winner).toBe('mafia')
  })

  it('leaves both Mafiosos and two town players alive', () => {
    const alive = final.players.filter((p) => p.alive).map((p) => p.id)
    expect(alive).toEqual(['ana', 'ben', 'dee', 'gus'])
  })

  it('decides at Dawn 2, then the narrator reveals the winner', () => {
    expect(timeline(final).slice(-4)).toEqual([
      'dawn 2',
      'eliminated (night)',
      'finale 2',
      'game-over: mafia',
    ])
  })
})