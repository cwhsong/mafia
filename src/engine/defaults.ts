import type { GameState } from './types'

// Games saved before a field existed (for example, a room open while the site updated)
// get sensible empty values, so nothing reads undefined.
export function withDefaults(state: GameState): GameState {
  return {
    ...state,
    uses: state.uses ?? {},
    nightOptions: state.nightOptions ?? {},
    optionUses: state.optionUses ?? {},
    mayorId: state.mayorId ?? null,
    blackmailed: state.blackmailed ?? null,
    lastBlackmail: state.lastBlackmail ?? {},
    guilt: state.guilt ?? {},
    nemesisTargets: state.nemesisTargets ?? {},
    pendingRevenge: state.pendingRevenge ?? null,
    neutralWins: state.neutralWins ?? [],
  }
}
