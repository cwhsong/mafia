import { describe, it, expect } from 'vitest'
import { playerMaySend } from './permissions'

describe('playerMaySend', () => {
  it('lets players send their own night pick and vote', () => {
    expect(playerMaySend({ type: 'submitAction', playerId: 'ana', targetId: 'eve' }, 'ana')).toBe(true)
    expect(playerMaySend({ type: 'castVote', playerId: 'ana', targetId: 'abstain' }, 'ana')).toBe(true)
  })

  it('stops players acting for someone else', () => {
    expect(playerMaySend({ type: 'submitAction', playerId: 'ben', targetId: 'eve' }, 'ana')).toBe(false)
    expect(playerMaySend({ type: 'castVote', playerId: 'ben', targetId: 'eve' }, 'ana')).toBe(false)
  })

  it('keeps narrator commands for the narrator', () => {
    expect(playerMaySend({ type: 'deal' }, 'ana')).toBe(false)
    expect(playerMaySend({ type: 'resolveNight' }, 'ana')).toBe(false)
    expect(playerMaySend({ type: 'eliminate', playerIds: ['ben'], cause: 'vote' }, 'ana')).toBe(false)
  })
})
