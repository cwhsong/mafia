import { ABSTAIN, type GameState, type VoteResult } from './types'
import { EngineError, assertNoRevenge, assertPhase } from './errors'
import { checkWin } from './win'
import { eliminate } from './eliminate'
import { enterPhase } from './phases'
import { toFinale } from './finale'

// Who a player may vote for: anyone else still alive, or Abstain.
export function voteOptions(state: GameState, playerId: string): string[] {
  const me = state.players.find((p) => p.id === playerId)
  if (!me?.alive) return []
  return [...state.players.filter((p) => p.alive && p.id !== playerId).map((p) => p.id), ABSTAIN]
}

export function castVote(state: GameState, playerId: string, targetId: string): GameState {
  assertPhase(state, 'vote')
  if (state.voteResult) throw new EngineError('vote-closed', 'The vote is closed')
  const voter = state.players.find((p) => p.id === playerId)
  if (!voter) throw new EngineError('unknown-player', `No player with id ${playerId}`)
  if (!voter.alive) throw new EngineError('not-alive', `${voter.name} is out of the game`)
  if (!voteOptions(state, playerId).includes(targetId)) {
    throw new EngineError('invalid-target', `${voter.name} can't vote for that player`)
  }
  return { ...state, votes: { ...state.votes, [playerId]: targetId } }
}

// Counts the vote. Not voting counts as Abstain. The top player is out only if they
// have more votes than Abstain and nobody ties them.
export function tallyVotes(state: GameState): VoteResult {
  const alive = state.players.filter((p) => p.alive)
  const aliveIds = new Set(alive.map((p) => p.id))
  const counts: Record<string, number> = {}
  let abstain = 0

  for (const voter of alive) {
    const target = state.votes[voter.id]
    const weight = voter.id === state.mayorId ? 3 : 1 // a revealed Mayor's vote counts three times
    if (!target || target === ABSTAIN || !aliveIds.has(target)) abstain += weight
    else counts[target] = (counts[target] ?? 0) + weight
  }

  const most = Math.max(0, ...Object.values(counts))
  const top = Object.keys(counts).filter((id) => counts[id] === most)
  const eliminatedId = top.length === 1 && most > abstain ? top[0] : null

  const endsGame = eliminatedId
    ? checkWin({
        ...state,
        players: state.players.map((p) => (p.id === eliminatedId ? { ...p, alive: false } : p)),
      })
    : null

  return { round: state.round, counts, abstain, eliminatedId, endsGame }
}

export function closeVote(state: GameState): GameState {
  assertPhase(state, 'vote')
  assertNoRevenge(state)
  if (state.voteResult) throw new EngineError('vote-closed', 'The vote is already closed')
  return { ...state, voteResult: tallyVotes(state) }
}

export function reopenVote(state: GameState): GameState {
  assertPhase(state, 'vote')
  if (!state.voteResult) throw new EngineError('vote-not-closed', 'The vote is still open')
  return { ...state, voteResult: null }
}

// The narrator reveals the vote: the eliminated player (if any) is out, then night falls.
export function revealVote(state: GameState): GameState {
  assertPhase(state, 'vote')
  assertNoRevenge(state)
  const result = state.voteResult
  if (!result) throw new EngineError('vote-not-closed', 'Close the vote first')

  const eliminated = result.eliminatedId ? eliminate(state, [result.eliminatedId], 'vote') : state
  const voters = result.eliminatedId
    ? state.players.filter((p) => state.votes[p.id] === result.eliminatedId).map((p) => p.id)
    : []
  const after: GameState = {
    ...eliminated,
    lastVote: { round: state.round, eliminatedId: result.eliminatedId },
    history: [...state.history, { kind: 'vote', round: state.round, eliminatedId: result.eliminatedId, voters }],
  }
  if (after.phase === 'ended') return toFinale(state, after)
  return enterPhase({ ...after, blackmailed: null }, 'night', state.round)
}

// A Mayor reveals themselves during the day. From then on their vote counts three times,
// and every roster shows them as the Mayor.
export function revealMayor(state: GameState, playerId: string): GameState {
  assertPhase(state, 'day', 'vote')
  const me = state.players.find((p) => p.id === playerId)
  if (!me?.alive || me.roleId !== 'mayor') throw new EngineError('not-allowed', 'Only a living Mayor can reveal')
  if (state.mayorId) throw new EngineError('not-allowed', 'The Mayor has already revealed')
  return {
    ...state,
    mayorId: playerId,
    history: [...state.history, { kind: 'mayor', round: state.round, playerId }],
  }
}
