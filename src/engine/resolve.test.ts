import { describe, it, expect } from 'vitest'
import type { GameState } from './types'
import { applyCommands, reduce } from './reduce'
import { eligibleTargets, nightChoice } from './night'
import { runNight } from './resolve'
import { STEPS, STEP_OF } from './steps'
import { checkWin } from './win'
import { setupGame } from './testHelpers'

// The Vigilante is defined but not yet in the role picker; these tests drive the pipeline
// with it to prove limited and late-starting abilities work.
const cast = { mafioso: ['Ana', 'Ben'], medic: 'Cal', vigilante: 'Vic', villager: ['Eve', 'Fay', 'Gus'] }

const toNight = (state: GameState) => reduce(state, { type: 'advance' })
function play(state: GameState, picks: Record<string, string>): GameState {
  return applyCommands(state, Object.entries(picks).map(([playerId, targetId]) => ({ type: 'submitAction', playerId, targetId })))
}
// Resolve, reveal, then skip the day's vote so the next night begins
function nextNight(state: GameState): GameState {
  return applyCommands(state, [{ type: 'resolveNight' }, { type: 'reveal' }, { type: 'closeVote' }, { type: 'revealVote' }])
}

describe('the night order', () => {
  it('runs in priority order, 0 to 6', () => {
    expect(STEPS.indexOf(STEP_OF.jail)).toBeLessThan(STEPS.indexOf(STEP_OF.alert))
    expect(STEPS.indexOf(STEP_OF.alert)).toBeLessThan(STEPS.indexOf(STEP_OF.distract))
    expect(STEPS.indexOf(STEP_OF.distract)).toBeLessThan(STEPS.indexOf(STEP_OF.protect))
    expect(STEPS.indexOf(STEP_OF.protect)).toBe(STEPS.indexOf(STEP_OF.blackmail))
    expect(STEPS.indexOf(STEP_OF.protect)).toBeLessThan(STEPS.indexOf(STEP_OF.investigate))
    expect(STEPS.indexOf(STEP_OF.investigate)).toBeLessThan(STEPS.indexOf(STEP_OF.kill))
    expect(STEPS.indexOf(STEP_OF.kill)).toBeLessThan(STEPS.indexOf(STEP_OF.remember))
  })

  it('records where everyone went, and who carried out the Mafia kill', () => {
    const state = play(toNight(setupGame(cast)), { ana: 'eve', ben: 'eve', cal: 'fay' })
    const night = runNight(state, [
      { actorId: 'ana', kind: 'kill', targetId: 'eve' },
      { actorId: 'ben', kind: 'kill', targetId: 'eve' },
      { actorId: 'cal', kind: 'protect', targetId: 'fay' },
    ])
    expect(['ana', 'ben']).toContain(night.mafia.shooterId)
    expect(night.visits).toContainEqual({ fromId: night.mafia.shooterId, toId: 'eve', kind: 'kill' })
    expect(night.visits).toContainEqual({ fromId: 'cal', toId: 'fay', kind: 'protect' })
    // Only one Mafia member actually visits
    expect(night.visits.filter((v) => v.kind === 'kill')).toHaveLength(1)
    expect(night.deaths).toEqual(['eve'])
  })
})

describe('limited abilities', () => {
  it("can't be used before their first night", () => {
    const state = toNight(setupGame(cast))
    expect(nightChoice(state, 'vic')).toBe('suspect')
  })

  it('kill on their own, are stopped by protection, and run out', () => {
    let state = nextNight(toNight(setupGame(cast))) // Night 2
    expect(nightChoice(state, 'vic')).toBe('kill')
    expect(eligibleTargets(state, 'vic')).not.toContain('vic')

    // Night 2: the Medic saves the Vigilante's target
    state = reduce(play(state, { vic: 'ana', cal: 'ana' }), { type: 'resolveNight' })
    expect(state.dawn?.deaths).toEqual([])
    expect(state.uses.vic).toBe(1)

    // Night 3: the second bullet lands
    state = applyCommands(state, [{ type: 'reveal' }, { type: 'closeVote' }, { type: 'revealVote' }])
    state = reduce(play(state, { vic: 'ben' }), { type: 'resolveNight' })
    expect(state.dawn?.deaths).toEqual(['ben'])
    expect(state.uses.vic).toBe(2)

    // Night 4: out of bullets, back to the decoy pick
    state = applyCommands(state, [{ type: 'reveal' }, { type: 'closeVote' }, { type: 'revealVote' }])
    expect(nightChoice(state, 'vic')).toBe('suspect')
  })
})

describe('winning with Neutrals in the game', () => {
  const withDead = (state: GameState, ...ids: string[]): GameState => ({
    ...state,
    players: state.players.map((p) => (ids.includes(p.id) ? { ...p, alive: false } : p)),
  })

  it('lets the Town win with a Jester still alive', () => {
    const game = setupGame({ mafioso: 'Ana', jester: 'Jo', villager: ['Eve', 'Fay'] })
    expect(checkWin(withDead(game, 'ana'))).toBe('town')
  })

  it('counts a living Jester among "everyone else" for the Mafia', () => {
    const game = setupGame({ mafioso: 'Ana', jester: 'Jo', villager: ['Eve', 'Fay'] })
    expect(checkWin(withDead(game, 'eve'))).toBeNull() // 1 Mafia vs Jester + Fay
    expect(checkWin(withDead(game, 'eve', 'fay'))).toBe('mafia') // 1 vs 1
  })
})
