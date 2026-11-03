import { describe, it, expect } from 'vitest'
import { ABSTAIN, type GameState } from './types'
import { applyCommands, reduce } from './reduce'
import { voteOptions } from './vote'
import { expectEngineError, setupGame } from './testHelpers'

const cast = {
  mafioso: ['Ana', 'Ben'],
  medic: 'Cal',
  detective: 'Dee',
  villager: ['Eve', 'Fay', 'Gus'],
}

// Day 2's vote, after a quiet first night
function voting(): GameState {
  return applyCommands(setupGame(cast), [
    { type: 'advance' },      // Night 1
    { type: 'resolveNight' }, // Dawn 1
    { type: 'reveal' },       // Day 2
    { type: 'advance' },      // Vote
  ])
}

function vote(state: GameState, votes: Record<string, string>): GameState {
  return applyCommands(
    state,
    Object.entries(votes).map(([playerId, targetId]) => ({ type: 'castVote', playerId, targetId })),
  )
}

const close = (state: GameState) => reduce(state, { type: 'closeVote' })

describe('casting votes', () => {
  it('lets a player vote for anyone else alive, or abstain', () => {
    const options = voteOptions(voting(), 'eve')
    expect(options).not.toContain('eve')
    expect(options).toContain('ana')
    expect(options.at(-1)).toBe(ABSTAIN)
  })

  it('lets players change their vote while it is open', () => {
    expect(vote(voting(), { eve: 'ana', ...{} }).votes.eve).toBe('ana')
    expect(vote(vote(voting(), { eve: 'ana' }), { eve: 'ben' }).votes.eve).toBe('ben')
  })

  it('rejects votes for yourself, from the dead, and after the vote closes', () => {
    expectEngineError(() => vote(voting(), { eve: 'eve' }), 'invalid-target')
    const withDead = reduce(voting(), { type: 'eliminate', playerIds: ['gus'], cause: 'host' })
    expectEngineError(() => vote(withDead, { gus: 'ana' }), 'not-alive')
    expectEngineError(() => vote(close(voting()), { eve: 'ana' }), 'vote-closed')
  })
})

describe('closing the vote', () => {
  it('puts out the player with the most votes when they beat Abstain', () => {
    const state = close(vote(voting(), { eve: 'ana', fay: 'ana', gus: 'ana', cal: 'ana', dee: 'ben' }))
    // Ana 4, Ben 1, Abstain 2 (Ana and Ben didn't vote)
    expect(state.voteResult).toMatchObject({ counts: { ana: 4, ben: 1 }, abstain: 2, eliminatedId: 'ana' })
  })

  it('counts players who did not vote as Abstain', () => {
    const state = close(vote(voting(), { eve: 'ana', fay: 'ana' }))
    // Ana 2, Abstain 5: nobody is out
    expect(state.voteResult).toMatchObject({ abstain: 5, eliminatedId: null })
  })

  it('puts nobody out when Abstain ties the leader', () => {
    const state = close(vote(voting(), { eve: 'ana', fay: 'ana', gus: 'ana', cal: ABSTAIN }))
    // Ana 3, Abstain 4 (Cal plus 3 who didn't vote)… and with one more:
    expect(state.voteResult?.eliminatedId).toBeNull()
    const tied = close(vote(voting(), { eve: 'ana', fay: 'ana', gus: 'ana', cal: 'ana', dee: ABSTAIN }))
    // Ana 4, Abstain 3
    expect(tied.voteResult?.eliminatedId).toBe('ana')
  })

  it('puts nobody out on a tie between players', () => {
    const state = close(vote(voting(), { eve: 'ana', fay: 'ana', gus: 'ana', cal: 'ben', dee: 'ben', ana: 'ben', ben: 'gus' }))
    // Ana 3, Ben 3, Gus 1, Abstain 0
    expect(state.voteResult?.eliminatedId).toBeNull()
  })

  it('warns the narrator when the vote will end the game', () => {
    const small = { mafioso: 'Ana', medic: 'Cal', villager: ['Eve', 'Fay', 'Gus'] }
    let state = applyCommands(setupGame(small), [
      { type: 'advance' }, { type: 'resolveNight' }, { type: 'reveal' }, { type: 'advance' },
    ])
    state = close(vote(state, { cal: 'ana', eve: 'ana', fay: 'ana', gus: 'ana' }))
    expect(state.voteResult).toMatchObject({ eliminatedId: 'ana', endsGame: 'town' })
  })

  it('can be reopened if closed by mistake', () => {
    const state = reduce(close(vote(voting(), { eve: 'ana' })), { type: 'reopenVote' })
    expect(state.voteResult).toBeNull()
    expect(state.votes.eve).toBe('ana')
  })
})

describe('revealing the vote', () => {
  it('eliminates the player and starts the night', () => {
    let state = close(vote(voting(), { eve: 'ana', fay: 'ana', gus: 'ana', cal: 'ana', dee: 'ana' }))
    state = reduce(state, { type: 'revealVote' })
    expect(state.players.find((p) => p.id === 'ana')?.alive).toBe(false)
    expect(state.phase).toBe('night')
    expect(state.round).toBe(2)
    expect(state.votes).toEqual({})
    expect(state.voteResult).toBeNull()
    expect(state.lastVote).toEqual({ round: 2, eliminatedId: 'ana' })
    expect(state.history.at(-1)).toEqual({
      kind: 'vote', round: 2, eliminatedId: 'ana', voters: ['cal', 'dee', 'eve', 'fay', 'gus'],
    })
    expect(state.log.at(-2)).toEqual({ type: 'eliminated', playerId: 'ana', cause: 'vote' })
  })

  it('moves on to the night when nobody is out', () => {
    const state = reduce(close(voting()), { type: 'revealVote' })
    expect(state.history.at(-1)).toEqual({ kind: 'vote', round: 2, eliminatedId: null, voters: [] })
    expect(state.phase).toBe('night')
    expect(state.players.every((p) => p.alive)).toBe(true)
  })

  it('needs the vote closed first', () => {
    expectEngineError(() => reduce(voting(), { type: 'revealVote' }), 'vote-not-closed')
  })

  it('ends the game when the vote decides it', () => {
    let state = close(vote(voting(), { cal: 'ana', dee: 'ana', eve: 'ana', fay: 'ana', gus: 'ana' }))
    state = reduce(state, { type: 'revealVote' })
    state = applyCommands(state, [
      { type: 'submitAction', playerId: 'ben', targetId: 'eve' },
      { type: 'resolveNight' },
      { type: 'reveal' },
      { type: 'advance' },
      { type: 'castVote', playerId: 'cal', targetId: 'ben' },
      { type: 'castVote', playerId: 'dee', targetId: 'ben' },
      { type: 'castVote', playerId: 'fay', targetId: 'ben' },
      { type: 'closeVote' },
      { type: 'revealVote' },
    ])
    expect(state.phase).toBe('ended')
    expect(state.winner).toBe('town')
  })
})
