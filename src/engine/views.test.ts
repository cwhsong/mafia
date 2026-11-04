import { describe, it, expect } from 'vitest'
import { playerView, narratorView } from './views'
import { eliminate } from './eliminate'
import { applyCommands } from './reduce'
import { ABSTAIN } from './types'
import { lobbyWith, setupGame } from './testHelpers'

const cast = {
  mafioso: ['Ana', 'Ben'],
  medic: 'Cal',
  detective: 'Dee',
  villager: ['Eve', 'Fay', 'Gus'],
}

describe('playerView', () => {
  it('shows a player their own role and nobody else’s', () => {
    const view = playerView(setupGame(cast), 'cal')
    expect(view.me?.roleId).toBe('medic')
    for (const p of view.players) {
      expect(p).not.toHaveProperty('roleId')
    }
  })

  it('gives town players no teammates', () => {
    expect(playerView(setupGame(cast), 'eve').teammates).toEqual([])
  })

  it('shows Mafia their fellow Mafia', () => {
    const view = playerView(setupGame(cast), 'ana')
    expect(view.teammates).toEqual([{ id: 'ben', name: 'Ben', roleId: 'mafioso', alive: true }])
  })

  it('keeps showing a dead teammate, marked dead', () => {
    const state = eliminate(setupGame(cast), ['ben'], 'vote')
    expect(playerView(state, 'ana').teammates[0].alive).toBe(false)
  })

  it('shows everyone who is alive', () => {
    const state = eliminate(setupGame(cast), ['eve'], 'vote')
    const eve = playerView(state, 'cal').players.find((p) => p.id === 'eve')
    expect(eve?.alive).toBe(false)
  })

  it('shows the public role list', () => {
    expect(playerView(setupGame(cast), 'eve').roleSlots).toHaveLength(7)
  })

  it('hides all roles until the game ends', () => {
    expect(playerView(setupGame(cast), 'eve').revealedRoles).toBeNull()
  })

  it('reveals every role once the game ends', () => {
    const ended = eliminate(setupGame(cast), ['ana', 'ben'], 'vote')
    const view = playerView(ended, 'eve')
    expect(view.phase).toBe('ended')
    expect(view.winner).toBe('town')
    expect(view.revealedRoles).toMatchObject({ ana: 'mafioso', cal: 'medic', eve: 'villager' })
  })

  it('works in the lobby, before roles exist', () => {
    const view = playerView(lobbyWith(3), 'id1')
    expect(view.phase).toBe('lobby')
    expect(view.me?.roleId).toBeNull()
    expect(view.players).toHaveLength(3)
  })

  it('returns no "me" for someone not in the game', () => {
    expect(playerView(setupGame(cast), 'stranger').me).toBeNull()
  })

  it('never includes the seed or the log', () => {
    const view = playerView(setupGame(cast), 'eve')
    expect(view).not.toHaveProperty('seed')
    expect(view).not.toHaveProperty('log')
  })
})

describe('playerView at night', () => {
  const night = () => applyCommands(setupGame(cast), [{ type: 'advance' }])

  it('gives each living player their action and who they can pick', () => {
    const view = playerView(night(), 'cal')
    expect(view.night).toMatchObject({ choice: 'protect', myPick: null })
    expect(view.night?.targets).toContain('cal')
  })

  it('gives Villagers the decoy', () => {
    expect(playerView(night(), 'eve').night?.choice).toBe('suspect')
  })

  it('shows Mafia their teammates’ picks live, and nobody else', () => {
    const state = applyCommands(night(), [{ type: 'submitAction', playerId: 'ben', targetId: 'eve' }])
    expect(playerView(state, 'ana').night?.teamPicks).toEqual([{ playerId: 'ben', name: 'Ben', targetId: 'eve' }])
    expect(playerView(state, 'cal').night?.teamPicks).toEqual([])
    expect(JSON.stringify(playerView(state, 'cal'))).not.toContain('targetId')
  })

  it('shows a player only their own pick', () => {
    const state = applyCommands(night(), [
      { type: 'submitAction', playerId: 'dee', targetId: 'ana' },
      { type: 'submitAction', playerId: 'cal', targetId: 'eve' },
    ])
    expect(playerView(state, 'dee').night?.myPick).toBe('ana')
    expect(JSON.stringify(playerView(state, 'dee'))).not.toContain('nightPicks')
  })

  it('gives the dead no night action', () => {
    const state = applyCommands(setupGame(cast), [
      { type: 'eliminate', playerIds: ['gus'], cause: 'host' },
      { type: 'advance' },
    ])
    expect(playerView(state, 'gus').night).toBeNull()
  })

  it('shows only your own dawn messages', () => {
    const state = applyCommands(night(), [
      { type: 'submitAction', playerId: 'dee', targetId: 'ben' },
      { type: 'resolveNight' },
    ])
    expect(playerView(state, 'dee').messages).toEqual([
      { kind: 'investigated', round: 1, targetId: 'ben', result: 'suspicious' },
    ])
    expect(JSON.stringify(playerView(state, 'eve'))).not.toContain('investigated')
  })

  it('shows everyone who died last night', () => {
    const state = applyCommands(night(), [
      { type: 'submitAction', playerId: 'ana', targetId: 'eve' },
      { type: 'resolveNight' },
      { type: 'reveal' },
    ])
    expect(playerView(state, 'fay').lastNight).toEqual({ round: 1, deaths: ['eve'] })
  })
})

describe('playerView during the vote', () => {
  const voting = () =>
    applyCommands(setupGame(cast), [
      { type: 'advance' }, { type: 'resolveNight' }, { type: 'reveal' },
      { type: 'castVote', playerId: 'eve', targetId: 'ana' },
      { type: 'castVote', playerId: 'fay', targetId: ABSTAIN },
    ])

  it('shows the public tally and who has not voted', () => {
    const view = playerView(voting(), 'gus').vote
    expect(view?.votes).toEqual({ eve: 'ana', fay: ABSTAIN })
    expect(view?.notVoted).toEqual(['ana', 'ben', 'cal', 'dee', 'gus'])
    expect(view?.closed).toBe(false)
  })

  it('does not show the result before the narrator reveals it', () => {
    const state = applyCommands(voting(), [{ type: 'closeVote' }])
    const view = playerView(state, 'gus')
    expect(view.vote?.closed).toBe(true)
    expect(JSON.stringify(view)).not.toContain('eliminatedId')
  })
})

describe('playerView in the finale', () => {
  it('shows the game is decided without giving away the winner or any roles', () => {
    const state = applyCommands(setupGame(cast), [
      { type: 'eliminate', playerIds: ['ana', 'ben'], cause: 'vote' },
    ])
    expect(state.phase).toBe('finale')
    const view = playerView(state, 'eve')
    expect(view.phase).toBe('finale')
    expect(view.winner).toBeNull()
    expect(view.revealedRoles).toBeNull()
    expect(view.finale).toEqual({ round: 1, fromPhase: 'day' })
    expect(JSON.stringify(view)).not.toContain('"town"')
  })

  it('reveals the winner and every role once the narrator says so', () => {
    const state = applyCommands(setupGame(cast), [
      { type: 'eliminate', playerIds: ['ana', 'ben'], cause: 'vote' },
      { type: 'revealWinner' },
    ])
    const view = playerView(state, 'eve')
    expect(view.winner).toBe('town')
    expect(view.revealedRoles).toMatchObject({ ana: 'mafioso' })
  })
})

describe('narratorView', () => {
  it('shows the whole game', () => {
    const state = setupGame(cast)
    expect(narratorView(state)).toEqual({ kind: 'narrator', game: state })
  })
})
