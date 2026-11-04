import { describe, it, expect } from 'vitest'
import {
  countRoles, withRoleCount, fillWithVillagers, phaseLabel, teamOf, teamLabel, joinLink,
  nextPhaseLabel, causeForPhase, winnerLabel,
} from './helpers'

describe('role picker helpers', () => {
  it('counts roles', () => {
    expect(countRoles(['villager', 'medic', 'villager'])).toEqual({ villager: 2, medic: 1 })
  })

  it('changes one count and keeps role-picker order', () => {
    expect(withRoleCount(['medic', 'villager'], 'mafioso', 2))
      .toEqual(['villager', 'medic', 'mafioso', 'mafioso'])
  })

  it('removes a role when its count reaches zero, and never goes negative', () => {
    expect(withRoleCount(['villager', 'medic'], 'medic', 0)).toEqual(['villager'])
    expect(withRoleCount(['villager'], 'medic', -1)).toEqual(['villager'])
  })

  it('fills the remaining slots with Villagers', () => {
    expect(fillWithVillagers(['mafioso', 'medic'], 5))
      .toEqual(['villager', 'villager', 'villager', 'medic', 'mafioso'])
  })

  it('leaves a full or over-full list alone', () => {
    expect(fillWithVillagers(['mafioso', 'medic'], 2)).toEqual(['mafioso', 'medic'])
    expect(fillWithVillagers(['mafioso', 'medic'], 1)).toEqual(['mafioso', 'medic'])
  })
})

describe('labels', () => {
  it('names each phase with its round', () => {
    expect(phaseLabel('lobby', 0)).toBe('Lobby')
    expect(phaseLabel('day', 1)).toBe('Day 1')
    expect(phaseLabel('night', 1)).toBe('Night 1')
    expect(phaseLabel('dawn', 1)).toBe('Dawn 1')
    expect(phaseLabel('vote', 2)).toBe('Day 2')
    expect(phaseLabel('ended', 3)).toBe('Game over')
  })

  it('finds a role’s team', () => {
    expect(teamOf('mafioso')).toBe('mafia')
    expect(teamOf('medic')).toBe('town')
    expect(teamOf(null)).toBeNull()
    expect(teamOf('nope')).toBeNull()
    expect(teamLabel('neutral')).toBe('Neutral')
  })

  it('builds a join link', () => {
    expect(joinLink('KXQRTZ', { origin: 'https://cwhsong.github.io', pathname: '/mafia/' }))
      .toBe('https://cwhsong.github.io/mafia/#KXQRTZ')
    expect(joinLink('KXQRTZ', { origin: 'https://cwhsong.github.io', pathname: '/mafia/' }, true))
      .toBe('https://cwhsong.github.io/mafia/?test#KXQRTZ')
  })
})

describe('narrator controls', () => {
  it('labels the narrator’s day button', () => {
    expect(nextPhaseLabel('day', 1)).toBe('Start Night 1')
    expect(nextPhaseLabel('day', 2)).toBe('Start the vote')
    expect(nextPhaseLabel('night', 1)).toBeNull()
    expect(nextPhaseLabel('lobby', 0)).toBeNull()
    expect(nextPhaseLabel('ended', 3)).toBeNull()
  })

  it('records eliminations with the right cause', () => {
    expect(causeForPhase('vote')).toBe('vote')
    expect(causeForPhase('night')).toBe('night')
    expect(causeForPhase('dawn')).toBe('night')
    expect(causeForPhase('day')).toBe('host')
  })

  it('names the winner', () => {
    expect(winnerLabel('town')).toBe('The Town wins')
    expect(winnerLabel('mafia')).toBe('The Mafia win')
  })
})
