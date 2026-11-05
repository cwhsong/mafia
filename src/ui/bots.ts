import { useEffect, useRef } from 'react'
import {
  ABSTAIN, eligibleTargets, killMarkTargets, marksKill, nightChoice, nightOptions, voteOptions,
  type Command, type GameState,
} from '../engine'
import type { RoomSession } from './roomSession'

// Test players (added with "+ 1 test player" in test mode) have ids starting with "test-".
// The narrator's phone plays for them, at random, so one person can run a whole game.
export const isBot = (id: string) => id.startsWith('test-')

type Rand = () => number
const pickOne = <T,>(items: T[], rand: Rand): T => items[Math.floor(rand() * items.length)]

// What the bots do right now. `done` remembers decisions already made (so a bot that chose
// to stay home doesn't roll again on every update); keys are added to it.
export function botMoves(state: GameState, done: Set<string>, rand: Rand = Math.random): Command[] {
  const commands: Command[] = []
  const once = (key: string) => {
    if (done.has(key)) return false
    done.add(key)
    return true
  }

  for (const p of state.players.filter((pl) => isBot(pl.id))) {
    const key = `${state.phase}:${state.round}:${p.id}`

    // An Avenger's last act can come at any time
    if (state.pendingRevenge?.kind === 'avenger' && state.pendingRevenge.playerId === p.id && once(`${key}:avenge`)) {
      const options = state.pendingRevenge.options.filter((id) => state.players.find((x) => x.id === id)?.alive)
      commands.push({ type: 'takeRevenge', playerId: p.id, targetId: options.length && rand() < 0.7 ? pickOne(options, rand) : null })
      continue
    }

    if (state.phase === 'night') {
      const choice = nightChoice(state, p.id)
      if (!choice || state.nightPicks[p.id] || !once(`${key}:act`)) continue
      const targets = eligibleTargets(state, p.id)

      if (choice === 'revenge') {
        if (targets.length) commands.push({ type: 'takeRevenge', playerId: p.id, targetId: pickOne(targets, rand) })
      } else if (choice === 'alert' || choice === 'vest') {
        if (rand() < 0.5) commands.push({ type: 'submitAction', playerId: p.id, targetId: p.id })
      } else if (targets.length) {
        const options = nightOptions(state, p.id)
        const option = choice === 'hypnotize' ? pickOne(options, rand) : options.includes('execute') && rand() < 0.15 ? 'execute' : undefined
        commands.push({ type: 'submitAction', playerId: p.id, targetId: pickOne(targets, rand), ...(option ? { option } : {}) })
      }

      if (marksKill(state, p.id)) {
        const marks = killMarkTargets(state, p.id)
        if (marks.length) commands.push({ type: 'markKill', playerId: p.id, targetId: pickOne(marks, rand) })
      }
    }

    if (state.phase === 'vote' && !state.voteResult && p.alive && !state.votes[p.id] && once(`${key}:vote`)) {
      const options = voteOptions(state, p.id)
      const target = rand() < 0.25 ? ABSTAIN : pickOne(options.filter((id) => id !== ABSTAIN), rand)
      if (target) commands.push({ type: 'castVote', playerId: p.id, targetId: target })
    }
  }
  return commands
}

// The narrator's phone sends the bots' moves a moment after each change, like real players.
export function useBots(session: RoomSession, game: GameState, enabled: boolean) {
  const done = useRef(new Set<string>())
  useEffect(() => {
    if (!enabled) return
    const commands = botMoves(game, done.current)
    if (commands.length === 0) return
    const timer = setTimeout(() => commands.forEach((c) => session.send(c)), 400 + Math.random() * 600)
    return () => clearTimeout(timer)
  }, [enabled, game, session])
}
