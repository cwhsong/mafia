import { describe, it, expect } from 'vitest'
import type { GameState, PrivateResult } from './types'
import { applyCommands, reduce } from './reduce'
import { eligibleTargets, nightChoice } from './night'
import { expectEngineError, setupGame } from './testHelpers'

// Ana and Ben are Mafia; Cal is the Medic; Dee the Detective; Eve, Fay, Gus are Villagers.
const cast = {
  mafioso: ['Ana', 'Ben'],
  medic: 'Cal',
  detective: 'Dee',
  villager: ['Eve', 'Fay', 'Gus'],
}

// A game at Night 1
function night(seed = 1): GameState {
  return reduce(setupGame(cast, seed), { type: 'advance' })
}

function play(state: GameState, picks: Record<string, string>): GameState {
  return applyCommands(
    state,
    Object.entries(picks).map(([playerId, targetId]) => ({ type: 'submitAction', playerId, targetId })),
  )
}

const resolve = (state: GameState) => reduce(state, { type: 'resolveNight' })
const messagesFor = (state: GameState, id: string, round = state.round): PrivateResult[] =>
  (state.results[id] ?? []).filter((r) => r.round === round)

describe('who can pick whom', () => {
  it('gives each role its night action, and Villagers a decoy', () => {
    const state = night()
    expect(nightChoice(state, 'ana')).toBe('kill')
    expect(nightChoice(state, 'cal')).toBe('protect')
    expect(nightChoice(state, 'dee')).toBe('investigate')
    expect(nightChoice(state, 'eve')).toBe('suspect')
  })

  it('stops the Mafia from picking themselves or each other', () => {
    expect(eligibleTargets(night(), 'ana')).toEqual(['cal', 'dee', 'eve', 'fay', 'gus'])
  })

  it('lets the Medic protect themselves, but only once per game', () => {
    let state = play(night(), { cal: 'cal' })
    expect(eligibleTargets(night(), 'cal')).toContain('cal')
    state = applyCommands(resolve(state), [{ type: 'reveal' }, { type: 'advance' }])
    // Night 2 (via Day 2 and its vote)
    expect(state.phase).toBe('night')
    expect(eligibleTargets(state, 'cal')).not.toContain('cal')
  })

  it('lets the Medic protect the same person every night', () => {
    let state = resolve(play(night(), { cal: 'eve' }))
    state = applyCommands(state, [{ type: 'reveal' }, { type: 'advance' }])
    expect(eligibleTargets(state, 'cal')).toContain('eve')
  })

  it('never lets anyone pick the dead, and the dead pick nobody', () => {
    let state = reduce(setupGame(cast), { type: 'eliminate', playerIds: ['gus'], cause: 'host' })
    state = reduce(state, { type: 'advance' })
    expect(eligibleTargets(state, 'eve')).not.toContain('gus')
    expect(eligibleTargets(state, 'gus')).toEqual([])
    expectEngineError(() => play(state, { gus: 'eve' }), 'not-alive')
  })

  it('rejects picks that break the rules', () => {
    expectEngineError(() => play(night(), { ana: 'ben' }), 'invalid-target')
    expectEngineError(() => play(night(), { dee: 'dee' }), 'invalid-target')
  })

  it('only takes picks at night', () => {
    expectEngineError(() => play(setupGame(cast), { ana: 'eve' }), 'wrong-phase')
  })

  it('lets players change their pick until the night ends', () => {
    const state = play(night(), { dee: 'ana', ...{} })
    expect(play(state, { dee: 'eve' }).nightPicks.dee).toBe('eve')
  })
})

describe('resolving the night', () => {
  it('kills the Mafia target when nobody protects them', () => {
    const state = resolve(play(night(), { ana: 'eve', ben: 'eve', cal: 'fay' }))
    expect(state.phase).toBe('dawn')
    expect(state.dawn?.deaths).toEqual(['eve'])
    expect(state.players.find((p) => p.id === 'eve')?.alive).toBe(true) // not until Reveal
  })

  it('saves the target when the Medic protects them', () => {
    const state = resolve(play(night(), { ana: 'eve', ben: 'eve', cal: 'eve' }))
    expect(state.dawn?.deaths).toEqual([])
    expect(state.dawn?.beats).toContainEqual(expect.objectContaining({ kind: 'saved', targetId: 'eve', cause: expect.objectContaining({ kind: 'mafia' }) }))
    expect(messagesFor(state, 'cal')).toEqual([{ kind: 'patient-saved', round: 1, targetId: 'eve' }])
    expect(messagesFor(state, 'eve')).toContainEqual({ kind: 'was-saved', round: 1 })
  })

  it('lets the Medic save themselves', () => {
    const state = resolve(play(night(), { ana: 'cal', ben: 'cal', cal: 'cal' }))
    expect(state.dawn?.deaths).toEqual([])
    expect(messagesFor(state, 'cal')).toContainEqual({ kind: 'was-saved', round: 1 })
  })

  it('goes with the most-picked Mafia target', () => {
    const three = { mafioso: ['Ana', 'Ben', 'Hal'], medic: 'Cal', villager: ['Eve', 'Fay', 'Gus', 'Ivy'] }
    let state = reduce(setupGame(three), { type: 'advance' })
    state = resolve(play(state, { ana: 'eve', ben: 'fay', hal: 'fay' }))
    expect(state.dawn?.deaths).toEqual(['fay'])
  })

  it('breaks a Mafia tie at random, the same way every time for the same game', () => {
    const results = new Set<string>()
    for (let seed = 1; seed <= 20; seed++) {
      const state = resolve(play(night(seed), { ana: 'eve', ben: 'fay' }))
      const beat = state.dawn?.beats.find((b) => b.kind === 'mafia-targeted')
      expect(beat).toMatchObject({ tieBroken: true })
      results.add(state.dawn!.deaths[0])
      // Same game, same answer
      expect(resolve(play(night(seed), { ana: 'eve', ben: 'fay' })).dawn?.deaths).toEqual(state.dawn?.deaths)
    }
    expect([...results].sort()).toEqual(['eve', 'fay']) // both outcomes happen across games
  })

  it('kills nobody when the Mafia pick nobody', () => {
    const state = resolve(play(night(), { cal: 'eve' }))
    expect(state.dawn?.deaths).toEqual([])
    expect(messagesFor(state, 'ana')).toEqual([{ kind: 'mafia-chose', round: 1, targetId: null }])
  })

  it('tells the Detective whether their target is Mafia', () => {
    const yes = resolve(play(night(), { dee: 'ben' }))
    expect(messagesFor(yes, 'dee')).toEqual([{ kind: 'investigated', round: 1, targetId: 'ben', result: 'suspicious' }])
    const no = resolve(play(night(), { dee: 'eve' }))
    expect(messagesFor(no, 'dee')).toEqual([{ kind: 'investigated', round: 1, targetId: 'eve', result: 'not-suspicious' }])
  })

  it('still gives the Detective a result about someone killed that night', () => {
    const state = resolve(play(night(), { ana: 'eve', ben: 'eve', dee: 'eve' }))
    expect(state.dawn?.deaths).toEqual(['eve'])
    expect(messagesFor(state, 'dee')[0]).toMatchObject({ kind: 'investigated', targetId: 'eve' })
  })

  it('still carries out the action of a player who is killed that night', () => {
    const state = resolve(play(night(), { ana: 'dee', ben: 'dee', dee: 'ben' }))
    expect(state.dawn?.deaths).toEqual(['dee'])
    expect(messagesFor(state, 'dee')[0]).toMatchObject({ kind: 'investigated', result: 'suspicious' })
  })

  it('gives every living player at least one message, so nobody stands out', () => {
    const state = resolve(play(night(), { ana: 'eve', ben: 'eve', eve: 'ana' }))
    for (const p of state.players) expect(messagesFor(state, p.id).length).toBeGreaterThan(0)
    expect(messagesFor(state, 'eve')).toEqual([{ kind: 'slept', round: 1, suspectedId: 'ana' }])
    expect(messagesFor(state, 'fay')).toEqual([{ kind: 'slept', round: 1, suspectedId: null }])
  })

  it('tells a power role who did nothing that they did nothing', () => {
    const state = resolve(night())
    expect(messagesFor(state, 'cal')).toEqual([{ kind: 'no-pick', round: 1, action: 'protect' }])
    expect(messagesFor(state, 'dee')).toEqual([{ kind: 'no-pick', round: 1, action: 'investigate' }])
  })

  it('records how each player died, for the narrator', () => {
    const state = resolve(play(night(), { ana: 'eve', ben: 'eve' }))
    expect(state.dawn?.deaths).toEqual(['eve'])
    expect(state.dawn?.causes?.eve).toMatchObject({ kind: 'mafia' })
  })

  it('writes the story for the narrator', () => {
    const state = resolve(play(night(), { ana: 'eve', ben: 'eve', cal: 'eve', dee: 'ben', fay: 'ana' }))
    expect(state.dawn?.beats).toEqual([
      { kind: 'mafia-targeted', mafiaIds: ['ana', 'ben'], targetId: 'eve', tieBroken: false },
      { kind: 'protected', medicId: 'cal', targetId: 'eve' },
      { kind: 'investigated', detectiveId: 'dee', targetId: 'ben', result: 'suspicious' },
      expect.objectContaining({ kind: 'ability', ability: 'kill', targetIds: ['eve'] }), // the member who went
      expect.objectContaining({ kind: 'saved', targetId: 'eve' }),
      { kind: 'suspects', playerId: 'fay', targetId: 'ana' },   // Villagers who didn't pick aren't listed
    ])
    expect(state.dawn?.picks).toMatchObject({ ana: 'eve', dee: 'ben', fay: 'ana' })
  })

  it('warns the narrator when the night will end the game', () => {
    const small = { mafioso: 'Ana', medic: 'Cal', villager: 'Eve' } // 1 Mafia vs 2
    const state = resolve(play(reduce(setupGame(small), { type: 'advance' }), { ana: 'eve' }))
    expect(state.dawn?.endsGame).toBe('mafia')
  })

  it('keeps every player’s messages across nights', () => {
    let state = resolve(play(night(), { dee: 'ben' }))
    state = applyCommands(state, [{ type: 'reveal' }, { type: 'advance' }])
    state = resolve(play(state, { dee: 'eve' }))
    expect(state.results.dee.map((r) => r.round)).toEqual([1, 2])
  })
})

describe('reveal', () => {
  it('applies the deaths, records them, and opens the next day on the vote', () => {
    let state = resolve(play(night(), { ana: 'eve', ben: 'eve' }))
    state = reduce(state, { type: 'reveal' })
    expect(state.phase).toBe('vote')
    expect(state.round).toBe(2)
    expect(state.players.find((p) => p.id === 'eve')?.alive).toBe(false)
    expect(state.lastNight).toEqual({ round: 1, deaths: ['eve'] })
    expect(state.history).toEqual([{ kind: 'night', round: 1, deaths: ['eve'] }])
    expect(state.dawn).toBeNull()
    expect(state.nightPicks).toEqual({})
  })

  it('records a quiet night', () => {
    const state = reduce(resolve(night()), { type: 'reveal' })
    expect(state.lastNight).toEqual({ round: 1, deaths: [] })
  })

  it('ends the game when the night decides it', () => {
    const small = { mafioso: 'Ana', medic: 'Cal', villager: 'Eve' } // 1 Mafia vs 2
    let state = reduce(setupGame(small), { type: 'advance' })
    state = reduce(resolve(play(state, { ana: 'eve' })), { type: 'reveal' })
    expect(state.phase).toBe('finale')
    expect(state.winner).toBeNull()
    expect(state.finale).toEqual({ winner: 'mafia', round: 1, fromPhase: 'dawn' })
    expect(state.players.find((p) => p.id === 'eve')?.alive).toBe(false)
    state = reduce(state, { type: 'revealWinner' })
    expect(state.phase).toBe('ended')
    expect(state.winner).toBe('mafia')
  })

  it('only works at dawn', () => {
    expectEngineError(() => reduce(night(), { type: 'reveal' }), 'wrong-phase')
  })
})
