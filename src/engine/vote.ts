import { ABSTAIN, type GameState, type VoteResult } from './types'
import { EngineError, assertPhase } from './errors'
import { checkWin } from './win'
import { eliminate } from './eliminate'
import { enterPhase } from './phases'

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
    if (!target || target === ABSTAIN || !aliveIds.has(target)) abstain++
    else counts[target] = (counts[target] ?? 0) + 1
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
  if (after.phase === 'ended') return after
  return enterPhase(after, 'night', state.round)
}
