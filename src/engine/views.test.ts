import { describe, it, expect } from 'vitest'
import { playerView, narratorView } from './views'
import { eliminate } from './eliminate'
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

describe('narratorView', () => {
  it('shows the whole game', () => {
    const state = setupGame(cast)
    expect(narratorView(state)).toEqual({ kind: 'narrator', game: state })
  })
})
