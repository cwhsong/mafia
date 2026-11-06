import { describe, it, expect } from 'vitest'
import type { PlayerView } from '../engine'
import {
  beatText, buildLog, dawnSections, deathCauseText, gameOverSubtext, joinNames, lastNightText, lastVoteText, messageText, nightSubtext, QUIET_NIGHT, rosterNotes,
} from './text'

const names: Record<string, string> = { ana: 'Ana', ben: 'Ben', cal: 'Cal', dee: 'Dee', fay: 'Fay' }
const nameOf = (id: string | null | undefined) => (id ? names[id] ?? id : '')
const roles: Record<string, string> = { cal: 'Medic', dee: 'Detective', fay: 'Villager' }
const roleOf = (id: string) => roles[id] ?? 'Mafioso'

describe('night wording', () => {
  it('tells each role what to do', () => {
    expect(nightSubtext('protect')).toBe('Choose who to protect tonight.')
    expect(nightSubtext('suspect')).toBe('Who do you suspect? Nobody sees your answer.')
  })
})

describe('private messages', () => {
  it('words every kind of message', () => {
    expect(messageText({ kind: 'investigated', round: 1, targetId: 'ben', result: 'suspicious' }, nameOf)).toBe('Ben is suspicious.')
    expect(messageText({ kind: 'investigated', round: 1, targetId: 'cal', result: 'not-suspicious' }, nameOf)).toBe('Cal is not suspicious.')
    expect(messageText({ kind: 'patient-saved', round: 1, targetId: 'cal' }, nameOf))
      .toBe('Your patient, Cal, was attacked, and you saved them.')
    expect(messageText({ kind: 'protected', round: 1, targetId: 'cal' }, nameOf)).toBe('You protected Cal. Nobody attacked them.')
    expect(messageText({ kind: 'was-saved', round: 1 }, nameOf)).toBe('You were attacked last night, but someone saved you.')
    expect(messageText({ kind: 'mafia-chose', round: 1, targetId: 'cal' }, nameOf)).toBe('The Mafia chose Cal.')
    expect(messageText({ kind: 'mafia-chose', round: 1, targetId: null }, nameOf)).toBe('The Mafia didn’t choose anyone.')
    expect(QUIET_NIGHT).toContain(messageText({ kind: 'slept', round: 1, suspectedId: 'ben' }, nameOf))
    expect(messageText({ kind: 'no-pick', round: 1, action: 'protect' }, nameOf)).toBe('You didn’t protect anyone.')
  })

  it('varies the quiet-night line from night to night', () => {
    const lines = [1, 2, 3, 4].map((round) => messageText({ kind: 'slept', round, suspectedId: null }, nameOf))
    expect(new Set(lines).size).toBe(4)
  })
})

describe('the narrator’s story', () => {
  it('words every kind of beat with names and roles', () => {
    expect(beatText({ kind: 'mafia-targeted', mafiaIds: ['ana', 'ben'], targetId: 'cal', tieBroken: false }, nameOf, roleOf))
      .toBe('The Mafia (Ana and Ben) targeted Cal.')
    expect(beatText({ kind: 'mafia-targeted', mafiaIds: ['ana', 'ben'], targetId: 'cal', tieBroken: true }, nameOf, roleOf))
      .toBe('The Mafia (Ana and Ben) targeted Cal. Their votes were tied, so it was settled at random.')
    expect(beatText({ kind: 'mafia-targeted', mafiaIds: ['ana'], targetId: null, tieBroken: false }, nameOf, roleOf))
      .toBe('The Mafia (Ana) chose nobody.')
    expect(beatText({ kind: 'protected', medicId: 'cal', targetId: 'fay' }, nameOf, roleOf)).toBe('Cal (Medic) protected Fay.')
    expect(beatText({ kind: 'saved', targetId: 'fay' }, nameOf, roleOf)).toBe('Fay was saved.')
    expect(beatText({ kind: 'killed', targetId: 'fay' }, nameOf, roleOf)).toBe('Fay was killed.')
    expect(beatText({ kind: 'killed', targetId: 'fay', cause: { kind: 'mafia', byId: 'ana' } }, nameOf, roleOf)).toBe('Fay was killed by the Mafia.')
    expect(beatText({ kind: 'saved', targetId: 'fay', cause: { kind: 'veteran', byId: 'cal' } }, nameOf, roleOf)).toBe('Fay was shot by Cal (Medic) after visiting them, but saved.')
    expect(beatText({ kind: 'investigated', detectiveId: 'dee', targetId: 'ben', result: 'suspicious' }, nameOf, roleOf))
      .toBe('Dee (Detective) investigated Ben: suspicious.')
    expect(beatText({ kind: 'suspects', playerId: 'fay', targetId: 'ana' }, nameOf, roleOf)).toBe('Fay suspects Ana.')
    expect(beatText({ kind: 'no-pick', playerId: 'fay' }, nameOf, roleOf)).toBe('Fay (Villager) didn’t choose anyone.')
  })
})

describe('your log', () => {
  it('groups public events and private results by day and night, oldest first', () => {
    const log = buildLog(
      [
        { kind: 'night', round: 1, deaths: ['ana'] },
        { kind: 'vote', round: 2, eliminatedId: 'dee', voters: ['ben', 'cal', 'fay'] },
        { kind: 'night', round: 2, deaths: [] },
      ],
      [
        { kind: 'investigated', round: 1, targetId: 'dee', result: 'suspicious' },
        { kind: 'investigated', round: 2, targetId: 'cal', result: 'not-suspicious' },
      ],
      nameOf,
    )
    expect(log).toEqual([
      { heading: 'Night 1', night: true, round: 1, lines: [{ text: 'Dee is suspicious.', private: true }, { text: 'Ana died last night.', private: false }] },
      { heading: 'Day 2', night: false, round: 2, lines: [{ text: 'Dee was voted out (Ben, Cal, Fay).', private: false }] },
      { heading: 'Night 2', night: true, round: 2, lines: [{ text: 'Cal is not suspicious.', private: true }, { text: 'Nobody died last night.', private: false }] },
    ])
  })

  it('leaves out quiet-night filler and suspicions', () => {
    const log = buildLog([], [{ kind: 'slept', round: 1, suspectedId: 'ben' }], nameOf)
    expect(log).toEqual([])
  })

  it('records the narrator removing someone and a vote where nobody went out', () => {
    const log = buildLog(
      [
        { kind: 'narrator-eliminated', round: 1, phase: 'day', playerIds: ['fay'] },
        { kind: 'vote', round: 2, eliminatedId: null, voters: [] },
      ],
      [],
      nameOf,
    )
    expect(log.map((s) => s.lines[0].text)).toEqual(['Fay was eliminated by the narrator.', 'Nobody was voted out.'])
  })
})

describe('summaries', () => {
  it('sums up the night and the vote', () => {
    expect(lastNightText([], nameOf)).toBe('Nobody died last night.')
    expect(lastNightText(['cal'], nameOf)).toBe('Cal died last night.')
    expect(lastNightText(['cal', 'fay'], nameOf)).toBe('Cal and Fay died last night.')
    expect(joinNames(['Ana', 'Ben', 'Cal'])).toBe('Ana, Ben, Cal')
    expect(lastVoteText('ben', nameOf)).toBe('Ben was voted out.')
    expect(lastVoteText(null, nameOf)).toBe('Nobody was voted out.')
  })

  it('cheers the winners and consoles the rest', () => {
    expect(gameOverSubtext(true)).toBe('Winner winner chicken dinner.')
    expect(gameOverSubtext(false)).toBe('GGs.')
    expect(gameOverSubtext(null)).toBeNull()
  })
})

describe('at the table', () => {
  const base = {
    teammates: [], mayorId: null, nemesisTarget: null, messages: [],
  } as unknown as PlayerView

  it('keeps the latest suspicion about someone, as a private note', () => {
    const notes = rosterNotes({
      ...base,
      messages: [
        { kind: 'investigated', round: 1, targetId: 'dee', result: 'suspicious' },
        { kind: 'investigated', round: 3, targetId: 'dee', result: 'not-suspicious' },
      ],
    })
    expect(notes.get('dee')).toEqual([{ text: 'Not suspicious', private: true, tone: 'good' }])
  })

  it('shows the Mayor to everyone, and your family and learned roles only to you', () => {
    const notes = rosterNotes({
      ...base,
      mayorId: 'fay',
      teammates: [{ id: 'gus', name: 'Gus', roleId: 'godfather', alive: true }],
      messages: [{ kind: 'examined', round: 2, targetId: 'eve', roleId: 'doctor' }],
    })
    expect(notes.get('fay')).toEqual([{ text: 'Mayor', private: false, tone: 'mayor' }])
    expect(notes.get('gus')).toEqual([{ text: 'Mafia · Godfather', private: true, tone: 'bad' }])
    expect(notes.get('eve')?.[0]).toMatchObject({ private: true })
    expect(notes.has('ana')).toBe(false)
  })
})

describe('narrator deaths', () => {
  const roleOf = (id: string) => ({ ana: 'Vigilante', cal: 'Veteran', dee: 'Mafioso' })[id] ?? 'Villager'
  it('says how each player died', () => {
    expect(deathCauseText('fay', { kind: 'mafia', byId: 'dee' }, nameOf, roleOf)).toBe('Fay, killed by the Mafia')
    expect(deathCauseText('ben', { kind: 'role', byId: 'ana' }, nameOf, roleOf)).toBe('Ben, shot by Ana (Vigilante)')
    expect(deathCauseText('dee', { kind: 'veteran', byId: 'cal' }, nameOf, roleOf)).toBe('Dee, shot by Cal (Veteran) after visiting them')
    expect(deathCauseText('dee', undefined, nameOf, roleOf)).toBe('Dee died.')
  })
})

describe('narrator dawn sections', () => {
  const roleOf = (id: string) => ({ ana: 'Mafioso', ben: 'Godfather', cal: 'Medic', dee: 'Vigilante', fay: 'Framer' })[id] ?? 'Villager'
  it('groups the night by step, merges the Mafia lines, and drops suspicions', () => {
    const sections = dawnSections(
      [
        { kind: 'mafia-targeted', mafiaIds: ['ana', 'ben'], targetId: 'cal', tieBroken: false },
        { kind: 'protected', medicId: 'cal', targetId: 'cal' },
        { kind: 'ability', actorId: 'fay', ability: 'frame', targetIds: ['dee'] },
        { kind: 'ability', actorId: 'ana', ability: 'kill', targetIds: ['cal'] },
        { kind: 'saved', targetId: 'cal', cause: { kind: 'mafia', byId: 'ana' } },
        { kind: 'killed', targetId: 'fay', cause: { kind: 'role', byId: 'dee' } },
        { kind: 'suspects', playerId: 'eve', targetId: 'ana' },
        { kind: 'no-pick', playerId: 'eve' },
      ],
      nameOf,
      roleOf,
    )
    expect(sections).toEqual([
      { title: 'Protection', lines: ['Cal (Medic) protected Cal.'] },
      { title: 'Disguises', lines: ['Fay (Framer) framed Dee.'] },
      { title: 'Kills', lines: ['The Mafia (Ana and Ben) chose Cal; Ana went.', 'Cal was attacked by the Mafia, but saved.', 'Fay was shot by Dee (Vigilante).'] },
      { title: 'Didn’t act', lines: ['eve (Villager) didn’t choose anyone.'] },
    ])
  })
})
