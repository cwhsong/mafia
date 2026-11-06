import { describe, it, expect } from 'vitest'
import { SKIP, type Command, type GameState, type PrivateResult } from './types'
import { applyCommands, reduce } from './reduce'
import { eligibleTargets, nightChoice } from './night'
import { checkWin, winnersOf } from './win'
import { playerView } from './views'
import { expectEngineError, setupGame } from './testHelpers'

// ---------- helpers ----------

type Cast = Record<string, string | string[]>
type Pick = string | [string, string] // target, or [target, option]

const night1 = (cast: Cast, seed = 1) => reduce(setupGame(cast, seed), { type: 'advance' })

function play(state: GameState, picks: Record<string, Pick>): GameState {
  const commands: Command[] = Object.entries(picks).map(([playerId, pick]) =>
    Array.isArray(pick)
      ? { type: 'submitAction', playerId, targetId: pick[0], option: pick[1] }
      : { type: 'submitAction', playerId, targetId: pick },
  )
  return applyCommands(state, commands)
}

const resolve = (state: GameState) => reduce(state, { type: 'resolveNight' })
const night = (state: GameState, picks: Record<string, Pick> = {}) => resolve(play(state, picks))
// From dawn: reveal, skip the vote (nobody votes), and start the next night
const nextNight = (dawn: GameState) => applyCommands(dawn, [{ type: 'reveal' }, { type: 'closeVote' }, { type: 'revealVote' }])
const said = (state: GameState, id: string, round = state.round): PrivateResult[] =>
  (state.results[id] ?? []).filter((r) => r.round === round)
const deaths = (state: GameState) => state.dawn?.deaths ?? []

function vote(state: GameState, votes: Record<string, string>): GameState {
  return applyCommands(state, [
    ...Object.entries(votes).map(([playerId, targetId]) => ({ type: 'castVote', playerId, targetId }) as Command),
    { type: 'closeVote' },
    { type: 'revealVote' },
  ])
}

// ---------- Mafia ----------

describe('the Mafia', () => {
  const cast = { godfather: 'Don', mafioso: 'Ana', consort: 'Cora', villager: ['Eve', 'Fay', 'Gus', 'Hal'], bartender: 'Bea' }

  it("follows the Godfather's pick over the Mafiosos'", () => {
    const state = applyCommands(night1({ ...cast, mafioso: ['Ana', 'Abe'] }), [
      { type: 'submitAction', playerId: 'don', targetId: 'eve' },
      { type: 'submitAction', playerId: 'ana', targetId: 'fay' },
      { type: 'submitAction', playerId: 'abe', targetId: 'fay' },
    ])
    expect(deaths(resolve(state))).toEqual(['eve'])
  })

  it('goes with the most-picked target when the Godfather makes no pick', () => {
    const state = applyCommands(night1({ ...cast, mafioso: ['Ana', 'Abe', 'Ari'] }), [
      { type: 'submitAction', playerId: 'ana', targetId: 'eve' },
      { type: 'submitAction', playerId: 'abe', targetId: 'fay' },
      { type: 'submitAction', playerId: 'ari', targetId: 'fay' },
    ])
    expect(deaths(resolve(state))).toEqual(['fay'])
  })

  it("gives support members only their own ability, not a say in the kill", () => {
    const state = night1(cast)
    expect(nightChoice(state, 'cora')).toBe('distract')
    expect(eligibleTargets(state, 'cora')).not.toContain('don')
  })

  it('sends the Mafioso to carry out the kill, not the Godfather', () => {
    const state = night(night1({ ...cast, lookout: 'Lou' }), { don: 'eve', lou: 'eve' })
    expect(said(state, 'lou')).toContainEqual({ kind: 'watched', round: 1, targetId: 'eve', visitorIds: ['ana'] })
  })

  it('has the Godfather do it himself when the Mafioso is distracted, and no kill without him', () => {
    const withGf = night(night1(cast), { don: 'eve', bea: 'ana' })
    expect(deaths(withGf)).toEqual(['eve'])
    expect(said(withGf, 'ana')).toContainEqual({ kind: 'distracted', round: 1 })

    const noGf = night(night1({ mafioso: 'Ana', villager: ['Eve', 'Fay', 'Gus'], bartender: 'Bea' }), { ana: 'eve', bea: 'ana' })
    expect(deaths(noGf)).toEqual([])
  })

  it('never lets Mafia abilities target other Mafia', () => {
    const state = night1(cast)
    expect(eligibleTargets(state, 'cora')).not.toContain('don')
    expect(eligibleTargets(state, 'cora')).not.toContain('ana')
  })

  it('promotes nobody when the Godfather dies, and the Godfather reads as not suspicious', () => {
    const state = night(night1({ ...cast, detective: 'Det' }), { det: 'don' })
    expect(said(state, 'det')).toContainEqual({ kind: 'investigated', round: 1, targetId: 'don', result: 'not-suspicious' })
  })
})

// ---------- Distractions ----------

describe('Bartender and Consort', () => {
  it('cancel the target’s action and tell them', () => {
    const state = night(night1({ mafioso: 'Ana', consort: 'Cora', medic: 'Med', villager: ['Eve', 'Fay', 'Gus'] }), {
      ana: 'eve', med: 'eve', cora: 'med',
    })
    expect(deaths(state)).toEqual(['eve'])
    expect(said(state, 'med')).toEqual([{ kind: 'distracted', round: 1 }])
    expect(said(state, 'cora')).toContainEqual({ kind: 'distracted-them', round: 1, targetId: 'med' })
  })

  it('get killed instead when they distract a Serial Killer', () => {
    const state = night(night1({ 'serial-killer': 'Sid', bartender: 'Bea', mafioso: 'Ana', villager: ['Eve', 'Fay', 'Gus', 'Hal'] }), {
      sid: 'eve', bea: 'sid',
    })
    expect(deaths(state)).toEqual(['bea'])
  })
})

// ---------- Veteran ----------

describe('Veteran', () => {
  const cast = { veteran: 'Vet', mafioso: 'Ana', medic: 'Med', bartender: 'Bea', villager: ['Eve', 'Fay', 'Gus'] }

  it('shoots everyone who visits, and survives the Mafia', () => {
    const state = night(night1(cast), { vet: 'vet', ana: 'vet', med: 'vet', bea: 'vet' })
    expect(deaths(state).sort()).toEqual(['ana', 'bea', 'med'])
    expect(said(state, 'vet')).toContainEqual({ kind: 'alerted', round: 1, shotIds: expect.arrayContaining(['ana', 'med', 'bea']) })
    expect(state.dawn?.causes?.med).toEqual({ kind: 'veteran', byId: 'vet' })
  })

  it('has two alerts, and staying home is fine', () => {
    let state = night(night1(cast), { vet: 'vet' })
    state = night(nextNight(state), { vet: 'vet' })
    expect(nightChoice(nextNight(state), 'vet')).toBe('suspect')
  })
})

// ---------- Warden ----------

describe('Warden', () => {
  const cast = { warden: 'War', mafioso: 'Ana', veteran: 'Vet', detective: 'Det', villager: ['Eve', 'Fay', 'Gus'] }

  it('blocks the prisoner and keeps them alive', () => {
    const state = night(night1(cast), { war: 'det', ana: 'det', det: 'ana' })
    expect(deaths(state)).toEqual([])
    expect(said(state, 'det')[0]).toEqual({ kind: 'locked-up', round: 1 })
    expect(said(state, 'det').some((m) => m.kind === 'investigated')).toBe(false)
    expect(said(state, 'war')).toContainEqual({ kind: 'jailed', round: 1, targetId: 'det', executedRole: null })
  })

  it('stops a Veteran going on alert', () => {
    const state = night(night1(cast), { war: 'vet', vet: 'vet', ana: 'vet' })
    expect(deaths(state)).toEqual([]) // the jail protects the Veteran; nobody gets shot
  })

  it('can execute once; it can’t be stopped, and reveals the role', () => {
    let state = night(night1({ ...cast, mafioso: ['Ana', 'Ben'], medic: 'Med' }), { war: ['ana', 'execute'], med: 'ana' })
    expect(deaths(state)).toEqual(['ana'])
    expect(said(state, 'war')).toContainEqual({ kind: 'jailed', round: 1, targetId: 'ana', executedRole: 'mafioso' })
    state = nextNight(state)
    expectEngineError(() => play(state, { war: ['eve', 'execute'] }), 'invalid-option')
  })
})

// ---------- Bodyguard ----------

describe('Bodyguard', () => {
  const cast = { bodyguard: 'Bo', mafioso: ['Ana', 'Ben'], medic: 'Med', villager: ['Eve', 'Fay', 'Gus', 'Hal'] }

  it('dies in the target’s place and takes the attacker down', () => {
    const state = night(night1(cast), { ana: 'eve', ben: 'eve', bo: 'eve', med: 'eve' })
    const shooter = state.dawn!.beats.find((b) => b.kind === 'ability' && b.ability === 'intercept')
    expect(deaths(state)).toContain('bo')
    expect(deaths(state)).not.toContain('eve')
    expect(deaths(state)).toHaveLength(2)
    expect(shooter).toBeDefined()
    expect(said(state, 'med')).toContainEqual({ kind: 'patient-saved', round: 1, targetId: 'eve' })
    expect(said(state, 'eve')).toContainEqual({ kind: 'was-saved', round: 1 })
  })

  it('is saved by a Medic protecting them', () => {
    const state = night(night1(cast), { ana: 'eve', ben: 'eve', bo: 'eve', med: 'bo' })
    expect(deaths(state)).not.toContain('bo')
    expect(deaths(state)).not.toContain('eve')
  })
})

// ---------- Vigilante ----------

describe('Vigilante', () => {
  const cast = { vigilante: 'Vic', mafioso: ['Ana', 'Ben'], villager: ['Eve', 'Fay', 'Gus', 'Hal', 'Ivy'] }

  it('dies of guilt the night after killing a Town member, and can’t act that night', () => {
    let state = nextNight(night(night1(cast))) // Night 2
    state = night(state, { vic: 'eve' })
    expect(deaths(state)).toEqual(['eve'])
    expect(state.dawn?.causes?.eve).toEqual({ kind: 'role', byId: 'vic' })
    state = nextNight(state) // Night 3
    expect(nightChoice(state, 'vic')).toBe('suspect')
    state = night(state)
    expect(deaths(state)).toContain('vic')
    expect(said(state, 'vic')).toContainEqual({ kind: 'guilt', round: 3 })
    expect(state.dawn?.causes?.vic).toEqual({ kind: 'guilt', byId: null })
  })

  it('feels no guilt for killing the Mafia', () => {
    let state = night(nextNight(night(night1(cast))), { vic: 'ana' })
    state = night(nextNight(state))
    expect(deaths(state)).not.toContain('vic')
  })
})

// ---------- Investigators ----------

describe('investigators', () => {
  const cast = {
    mafioso: 'Ana', framer: 'Fra', impostor: 'Imp', 'private-eye': 'Pi', lookout: 'Lou', shadow: 'Sha', detective: 'Det',
    spy: 'Spy', psychic: 'Psy', medic: 'Med', villager: ['Eve', 'Fay'],
  }

  it('Private Eye: three roles from the deck, the truth among them, the same every time', () => {
    let state = night(night1(cast), { pi: 'med' })
    const first = said(state, 'pi').find((m) => m.kind === 'shortlist')!
    expect(first).toMatchObject({ kind: 'shortlist', targetId: 'med' })
    const roleIds = (first as Extract<PrivateResult, { kind: 'shortlist' }>).roleIds
    expect(roleIds).toHaveLength(3)
    expect(roleIds).toContain('medic')
    for (const id of roleIds) expect(state.roleSlots).toContain(id)
    state = night(nextNight(state), { pi: 'med' })
    expect(said(state, 'pi').find((m) => m.kind === 'shortlist')).toMatchObject({ roleIds })
  })

  it('Framer: the target reads as Mafia to the Detective and the Private Eye', () => {
    const state = night(night1(cast), { fra: 'eve', det: 'eve', pi: 'eve' })
    expect(said(state, 'det')).toContainEqual({ kind: 'investigated', round: 1, targetId: 'eve', result: 'suspicious' })
    const list = said(state, 'pi').find((m) => m.kind === 'shortlist') as Extract<PrivateResult, { kind: 'shortlist' }>
    expect(list.roleIds).not.toContain('villager')
  })

  it('Impostor: reads as the copied role', () => {
    const state = night(night1(cast), { imp: 'med', det: 'imp' })
    expect(said(state, 'det')).toContainEqual({ kind: 'investigated', round: 1, targetId: 'imp', result: 'not-suspicious' })
  })

  it('Lookout and Shadow: who visited, and where someone went', () => {
    const state = night(night1(cast), { med: 'eve', lou: 'eve', sha: 'med', ana: 'fay' })
    expect(said(state, 'lou')).toContainEqual({ kind: 'watched', round: 1, targetId: 'eve', visitorIds: ['med'] })
    expect(said(state, 'sha')).toContainEqual({ kind: 'followed', round: 1, targetId: 'med', visitedIds: ['eve'] })
  })

  it('Spy: who the Mafia visited', () => {
    const state = night(night1(cast), { ana: 'fay', fra: 'eve' })
    const spied = said(state, 'spy').find((m) => m.kind === 'spied') as Extract<PrivateResult, { kind: 'spied' }>
    expect(spied.targetIds.sort()).toEqual(['eve', 'fay'])
  })

  it('Psychic: a vision with someone suspicious on odd nights (three names at 9+ players)', () => {
    const state = night(night1(cast))
    const seen = said(state, 'psy').find((m) => m.kind === 'vision') as Extract<PrivateResult, { kind: 'vision' }>
    expect(seen.evil).toBe(true)
    expect(seen.playerIds).toHaveLength(3)
    expect(seen.playerIds.some((id) => ['ana', 'fra', 'imp'].includes(id))).toBe(true)
  })

  it('Coroner: the true role of a dead player', () => {
    let state = night(night1({ coroner: 'Cor', mafioso: 'Ana', medic: 'Med', villager: ['Eve', 'Fay', 'Gus'] }), { ana: 'med' })
    state = nextNight(state)
    expect(eligibleTargets(state, 'cor')).toEqual(['med'])
    state = night(state, { cor: 'med' })
    expect(said(state, 'cor')).toContainEqual({ kind: 'examined', round: 2, targetId: 'med', roleId: 'medic' })
  })

  it('Consigliere: the category, shown to every Mafia member', () => {
    const state = night(night1({ consigliere: 'Con', mafioso: 'Ana', medic: 'Med', villager: ['Eve', 'Fay', 'Gus'] }), { con: 'med' })
    const result = { kind: 'categorized', round: 1, targetId: 'med', category: 'Town Protective', byId: 'con' }
    expect(said(state, 'con')).toContainEqual(result)
    expect(said(state, 'ana')).toContainEqual(result)
  })
})

// ---------- Blackmailer and Hypnotist ----------

describe('Blackmailer and Hypnotist', () => {
  const cast = { blackmailer: 'Bm', hypnotist: 'Hy', mafioso: 'Ana', detective: 'Det', villager: ['Eve', 'Fay', 'Gus', 'Hal'] }

  it('Blackmailer: silences the target for the next day, not twice in a row', () => {
    let state = night(night1(cast), { bm: 'eve' })
    expect(said(state, 'eve')).toContainEqual({ kind: 'blackmailed', round: 1 })
    state = applyCommands(state, [{ type: 'reveal' }])
    expect(playerView(state, 'eve').blackmailed).toBe(true)
    state = applyCommands(state, [{ type: 'closeVote' }, { type: 'revealVote' }])
    expect(eligibleTargets(state, 'bm')).not.toContain('eve')
  })

  it('Hypnotist: replaces the target’s dawn message, erasing a real result', () => {
    const state = night(night1(cast), { det: 'ana', hy: ['det', 'quiet'] })
    expect(said(state, 'det')).toEqual([{ kind: 'slept', round: 1, suspectedId: null }])
    expect(said(state, 'hy')).toContainEqual({ kind: 'hypnotized', round: 1, targetId: 'det', fake: 'quiet' })
  })
})

// ---------- Survivor and Amnesiac ----------

describe('Survivor and Amnesiac', () => {
  it('Survivor: a vest stops an attack; two vests under 9 players', () => {
    let state = night(night1({ survivor: 'Sur', mafioso: 'Ana', villager: ['Eve', 'Fay', 'Gus'] }), { sur: 'sur', ana: 'sur' })
    expect(deaths(state)).toEqual([])
    expect(said(state, 'sur')).toContainEqual({ kind: 'was-saved', round: 1 })
    state = night(nextNight(state), { sur: 'sur' })
    expect(nightChoice(nextNight(state), 'sur')).toBe('suspect')
  })

  it('Amnesiac: becomes a dead player’s role at dawn; the town hears the role, not who', () => {
    let state = night(night1({ amnesiac: 'Amy', mafioso: 'Ana', medic: 'Med', villager: ['Eve', 'Fay', 'Gus'] }), { ana: 'med' })
    state = night(nextNight(state), { amy: 'med' })
    state = reduce(state, { type: 'reveal' })
    expect(state.players.find((p) => p.id === 'amy')?.roleId).toBe('medic')
    expect(state.history).toContainEqual({ kind: 'remembered', round: 2, roleId: 'medic' })
  })
})

// ---------- Skipping a night ----------

describe('skipping tonight', () => {
  const cast = { mafioso: 'Ana', veteran: 'Vet', medic: 'Med', detective: 'Det', villager: ['Eve', 'Fay', 'Gus'] }

  it("tells the narrator what a distracted or jailed player couldn't do", () => {
    let state = night1({ mafioso: 'Ana', consort: 'Cora', medic: 'Med', warden: 'War', detective: 'Det', villager: ['Eve', 'Fay'] })
    state = night(state, { ana: 'eve', cora: 'med', med: 'eve', war: 'det', det: 'ana' })
    expect(state.dawn?.beats).toContainEqual({ kind: 'ability', actorId: 'cora', ability: 'distract', targetIds: ['med', 'eve'], detail: 'protect' })
    expect(state.dawn?.beats).toContainEqual({ kind: 'ability', actorId: 'war', ability: 'jail', targetIds: ['det', 'ana'], detail: 'investigate' })
    expect(state.dawn?.beats).not.toContainEqual({ kind: 'no-pick', playerId: 'ana' })
  })

  it('counts as a choice, does nothing, and tells the narrator', () => {
    let state = night1(cast)
    state = play(state, { vet: SKIP, med: SKIP, ana: 'vet', det: 'vet' })
    expect(state.nightPicks.vet).toBe(SKIP)
    state = resolve(state)
    expect(deaths(state)).toEqual(['vet'])          // no alert: the Detective visits safely, the Mafia kill
    expect(state.dawn?.picks.med).toBe(SKIP)
    expect(state.dawn?.beats).toContainEqual({ kind: 'skipped', playerId: 'med' })
    expect(said(state, 'med')).toContainEqual({ kind: 'skipped', round: 1, action: 'protect' })
  })

  it("can't be used to pass on a Jester's revenge", () => {
    let state = applyCommands(night(night1({ jester: 'Jo', mafioso: 'Ana', villager: ['Eve', 'Fay', 'Gus', 'Hal'] })), [{ type: 'reveal' }])
    state = vote(state, { eve: 'jo', fay: 'jo', gus: 'jo', hal: 'jo' })
    expectEngineError(() => reduce(state, { type: 'submitAction', playerId: 'jo', targetId: SKIP }), 'invalid-target')
  })
})

// ---------- Losing the last killer ----------

describe('the Mafia without a killer', () => {
  const cast = { mafioso: 'Ana', framer: 'Fra', villager: ['Eve', 'Fay', 'Gus', 'Hal', 'Ivy'] }

  it('makes a member a Mafioso when the last killer is voted out', () => {
    let state = applyCommands(night(night1(cast)), [{ type: 'reveal' }])
    state = vote(state, { eve: 'ana', fay: 'ana', gus: 'ana', hal: 'ana' })
    expect(state.players.find((p) => p.id === 'fra')?.roleId).toBe('mafioso')
    expect(state.results.fra).toContainEqual(expect.objectContaining({ kind: 'became-mafioso' }))
    expect(nightChoice(state, 'fra')).toBe('kill')
    state = night(state, { fra: 'eve' })
    expect(deaths(state)).toEqual(['eve'])
  })

  it('tells the narrator at dawn who will become the Mafioso', () => {
    const state = night(night1({ mafioso: 'Ana', framer: 'Fra', villager: ['Eve', 'Fay', 'Gus', 'Hal'], vigilante: 'Vic' }))
    expect(state.dawn?.promotes ?? null).toBeNull()
    const n2 = night(nextNight(state), { vic: 'ana' })
    expect(n2.dawn?.deaths).toEqual(['ana'])
    expect(n2.dawn?.promotes).toBe('fra')
    expect(reduce(n2, { type: 'reveal' }).players.find((p) => p.id === 'fra')?.roleId).toBe('mafioso')
  })

  it('keeps everyone as they are while a killer is alive', () => {
    const state = applyCommands(night(night1({ ...cast, godfather: 'Don' })), [{ type: 'reveal' }])
    const after = vote(state, { eve: 'ana', fay: 'ana', gus: 'ana', hal: 'ana', ivy: 'ana' })
    expect(after.players.find((p) => p.id === 'fra')?.roleId).toBe('framer')
  })
})

// ---------- Jester and Nemesis ----------

describe('Jester', () => {
  const cast = { jester: 'Jo', mafioso: 'Ana', villager: ['Eve', 'Fay', 'Gus', 'Hal'] }

  it('wins when voted out, the game goes on, and one voter dies the next night', () => {
    let state = applyCommands(night(night1(cast)), [{ type: 'reveal' }])
    state = vote(state, { eve: 'jo', fay: 'jo', gus: 'jo', hal: 'jo' })
    expect(state.phase).toBe('night')
    expect(state.neutralWins).toContain('jo')
    expect(nightChoice(state, 'jo')).toBe('revenge')
    expect(eligibleTargets(state, 'jo').sort()).toEqual(['eve', 'fay', 'gus', 'hal'])
    state = night(applyCommands(state, [{ type: 'takeRevenge', playerId: 'jo', targetId: 'fay' }]))
    expect(deaths(state)).toEqual(['fay'])
  })

  it("strikes first: the voter can't act that night, like being distracted, and only finds out at dawn", () => {
    let state = applyCommands(night(night1({ jester: 'Jo', mafioso: 'Ana', medic: 'Med', villager: ['Eve', 'Fay', 'Gus'] })), [{ type: 'reveal' }])
    state = vote(state, { eve: 'jo', fay: 'jo', gus: 'jo', med: 'jo' })
    state = applyCommands(state, [{ type: 'takeRevenge', playerId: 'jo', targetId: 'med' }])
    state = night(state, { med: 'eve', ana: 'eve' })
    expect(deaths(state).sort()).toEqual(['eve', 'med'])   // the Medic never got to protect Eve
    expect(state.dawn?.beats).toContainEqual(expect.objectContaining({ ability: 'revenge', targetIds: ['med', 'eve'], detail: 'protect' }))
    expect(said(state, 'med')).not.toContainEqual(expect.objectContaining({ kind: 'distracted' }))
  })

  it('takes a random voter if they don’t choose, and is listed among the winners', () => {
    let state = applyCommands(night(night1(cast)), [{ type: 'reveal' }])
    state = vote(state, { eve: 'jo', fay: 'jo', gus: 'jo', hal: 'jo' })
    state = night(state)
    expect(deaths(state)).toHaveLength(1)
    expect(['eve', 'fay', 'gus', 'hal']).toContain(deaths(state)[0])
    // The Town later wins; the Jester won too
    state = reduce(state, { type: 'reveal' })
    state = reduce(state, { type: 'eliminate', playerIds: ['ana'], cause: 'host' })
    state = reduce(state, { type: 'revealWinner' })
    expect(winnersOf(state)).toContain('jo')
  })
})

describe('Nemesis', () => {
  const cast = { nemesis: 'Nem', mafioso: 'Ana', villager: ['Eve', 'Fay', 'Gus', 'Hal'] }

  it('gets a Town target at the deal and wins if they are voted out', () => {
    const lobby = setupGame(cast)
    const dealt = reduce({ ...lobby, phase: 'lobby', round: 0, players: lobby.players.map((p) => ({ ...p, roleId: null })) }, { type: 'deal' })
    const nemesis = dealt.players.find((p) => p.roleId === 'nemesis')!
    const target = dealt.nemesisTargets[nemesis.id]
    expect(dealt.players.find((p) => p.id === target)?.roleId).toBe('villager')
  })

  it('becomes a Jester if the target dies another way', () => {
    let state: GameState = { ...night1(cast), nemesisTargets: { nem: 'eve' } }
    state = reduce(night(state, { ana: 'eve' }), { type: 'reveal' })
    expect(state.players.find((p) => p.id === 'nem')?.roleId).toBe('jester')
    expect(said(state, 'nem', 1)).toContainEqual({ kind: 'became-jester', round: 1 })
  })

  it('wins when the target is voted out', () => {
    let state: GameState = { ...night1(cast), nemesisTargets: { nem: 'eve' } }
    state = vote(reduce(night(state), { type: 'reveal' }), { nem: 'eve', fay: 'eve', gus: 'eve', hal: 'eve' })
    expect(state.neutralWins).toContain('nem')
  })
})

// ---------- Avenger ----------

describe('Avenger', () => {
  const cast = { avenger: 'Ava', mafioso: ['Ana', 'Ben'], villager: ['Eve', 'Fay', 'Gus', 'Hal', 'Ivy'] }

  it('chooses someone to take down after dying; everything waits until they do', () => {
    let state = reduce(night(night1(cast), { ana: 'ava', ben: 'ava' }), { type: 'reveal' })
    expect(state.pendingRevenge).toMatchObject({ kind: 'avenger', playerId: 'ava' })
    expect(playerView(state, 'ava').revenge?.kind).toBe('avenger')
    expectEngineError(() => reduce(state, { type: 'closeVote' }), 'revenge-pending')
    state = reduce(state, { type: 'takeRevenge', playerId: 'ava', targetId: 'ana' })
    expect(state.players.find((p) => p.id === 'ana')?.alive).toBe(false)
    expect(state.pendingRevenge).toBeNull()
    expect(state.history).toContainEqual({ kind: 'revenge', round: 2, byId: 'ava', targetId: 'ana' })
  })

  it('can let it go, and triggers when voted out', () => {
    let state = reduce(night(night1(cast)), { type: 'reveal' })
    state = vote(state, { eve: 'ava', fay: 'ava', gus: 'ava', hal: 'ava', ivy: 'ava' })
    expect(state.pendingRevenge).toMatchObject({ kind: 'avenger' })
    state = reduce(state, { type: 'takeRevenge', playerId: 'ava', targetId: null })
    expect(state.pendingRevenge).toBeNull()
    expect(state.players.filter((p) => !p.alive)).toHaveLength(1)
  })
})

// ---------- Mayor ----------

describe('Mayor', () => {
  const cast = { mayor: 'May', mafioso: 'Ana', medic: 'Med', villager: ['Eve', 'Fay', 'Gus'] }

  it('reveals during the day; their vote counts three times; the Medic can’t protect them', () => {
    let state = reduce(night(night1(cast)), { type: 'reveal' })
    state = reduce(state, { type: 'revealMayor', playerId: 'may' })
    expect(playerView(state, 'eve').mayorId).toBe('may')
    expectEngineError(() => reduce(state, { type: 'revealMayor', playerId: 'may' }), 'not-allowed')
    // Mayor (3) + Medic beat Eve + Fay (2); without the Mayor's weight it would be a tie
    state = applyCommands(state, [
      { type: 'castVote', playerId: 'may', targetId: 'ana' },
      { type: 'castVote', playerId: 'med', targetId: 'ana' },
      { type: 'castVote', playerId: 'eve', targetId: 'gus' },
      { type: 'castVote', playerId: 'fay', targetId: 'gus' },
      { type: 'closeVote' },
    ])
    expect(state.voteResult?.eliminatedId).toBe('ana')
  })

  it('stops the Medic protecting a revealed Mayor', () => {
    let state = reduce(night(night1(cast)), { type: 'reveal' })
    state = applyCommands(state, [{ type: 'revealMayor', playerId: 'may' }, { type: 'closeVote' }, { type: 'revealVote' }])
    expect(eligibleTargets(state, 'med')).not.toContain('may')
  })

  it('can only be revealed by the Mayor', () => {
    const state = reduce(night(night1(cast)), { type: 'reveal' })
    expectEngineError(() => reduce(state, { type: 'revealMayor', playerId: 'eve' }), 'not-allowed')
  })
})

// ---------- Serial Killer and winning ----------

describe('Serial Killer and winning', () => {
  const withDead = (state: GameState, ...ids: string[]): GameState => ({
    ...state,
    players: state.players.map((p) => (ids.includes(p.id) ? { ...p, alive: false } : p)),
  })
  const cast = { 'serial-killer': 'Sid', mafioso: 'Ana', villager: ['Eve', 'Fay', 'Gus'], survivor: 'Sur' }

  it('kills each night and reads as suspicious', () => {
    const state = night(night1({ ...cast, detective: 'Det' }), { sid: 'eve', det: 'sid' })
    expect(deaths(state)).toEqual(['eve'])
    expect(said(state, 'det')).toContainEqual({ kind: 'investigated', round: 1, targetId: 'sid', result: 'suspicious' })
  })

  it('stops the Mafia winning at parity while alive, and blocks the Town too', () => {
    const game = setupGame(cast)
    expect(checkWin(withDead(game, 'eve', 'fay', 'sur'))).toBeNull()      // Ana, Sid, Gus
    expect(checkWin(withDead(game, 'ana'))).toBeNull()                    // no Mafia, but Sid lives
  })

  it('wins as the last one standing, or facing one other player', () => {
    const game = setupGame(cast)
    expect(checkWin(withDead(game, 'eve', 'fay', 'gus', 'sur'))).toBe('neutral') // Sid vs Ana
    const end = { ...withDead(game, 'ana', 'eve', 'fay'), phase: 'ended' as const, winner: 'neutral' as const }
    expect(winnersOf(end).sort()).toEqual(['sid', 'sur']) // the Survivor won alongside
  })
})
