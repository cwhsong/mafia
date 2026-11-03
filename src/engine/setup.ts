import type { GameState, Player } from './types'
import { EngineError, assertPhase } from './errors'
import { ROLES } from '../roles'

export const MIN_PLAYERS = 5
export const MAX_PLAYERS = 50

export function createGame(hostId: string, seed: number): GameState {
  return {
    hostId,
    phase: 'lobby',
    round: 0,
    players: [],
    roleSlots: [],
    seed,
    winner: null,
    log: [],
    nightPicks: {},
    dawn: null,
    lastNight: null,
    results: {},
    selfTargets: {},
    votes: {},
    voteResult: null,
    lastVote: null,
    history: [],
  }
}

export function addPlayer(state: GameState, id: string, name: string): GameState {
  assertPhase(state, 'lobby')

  const cleanName = name.trim()
  if (!cleanName) {
    throw new EngineError('empty-name', 'Name cannot be empty')
  }
  if (state.players.length >= MAX_PLAYERS) {
    throw new EngineError('too-many-players', `Room is full (${MAX_PLAYERS} players)`)
  }
  if (state.players.some((p) => p.id === id)) {
    throw new EngineError('duplicate-id', `Player ${id} already joined`)
  }
  if (state.players.some((p) => p.name.toLowerCase() === cleanName.toLowerCase())) {
    throw new EngineError('duplicate-name', `Someone is already called ${cleanName}`)
  }

  const player: Player = {
    id,
    name: cleanName,
    seat: state.players.length,
    alive: true,
    roleId: null,
  }
  return { ...state, players: [...state.players, player] }
}

export function removePlayer(state: GameState, id: string): GameState {
  assertPhase(state, 'lobby')

  if (!state.players.some((p) => p.id === id)) {
    throw new EngineError('unknown-player', `No player with id ${id}`)
  }

  const players = state.players
    .filter((p) => p.id !== id)
    .map((p, index) => ({ ...p, seat: index })) // close the gap in seat numbers

  return { ...state, players }
}

export function setRoleSlots(state: GameState, slots: readonly string[]): GameState {
  assertPhase(state, 'lobby')

  for (const id of slots) {
    const role = ROLES[id]
    if (!role) {
      throw new EngineError('unknown-role', `Unknown role: ${id}`)
    }
    if (!role.available) {
      throw new EngineError('role-unavailable', `${role.name} is not available yet`)
    }
  }
  return { ...state, roleSlots: [...slots] }
}

// Returns a list of problems in plain English. Empty list = ready to deal.
export function validateSetup(state: GameState): string[] {
  const problems: string[] = []
  const playerCount = state.players.length
  const slotCount = state.roleSlots.length
  const mafiaCount = state.roleSlots.filter((id) => ROLES[id]?.team === 'mafia').length

  if (playerCount < MIN_PLAYERS) {
    problems.push(`Need at least ${MIN_PLAYERS} players (have ${playerCount}).`)
  }
  if (slotCount !== playerCount) {
    problems.push(`Pick ${playerCount} roles to match ${playerCount} players (have ${slotCount}).`)
  }
  if (mafiaCount === 0) {
    problems.push('Include at least one Mafia role.')
  } else if (mafiaCount * 2 >= playerCount) {
    problems.push(`Too many Mafia: ${mafiaCount} of ${playerCount} players. Mafia must be under half.`)
  }
  return problems
}