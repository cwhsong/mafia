import { describe, it, expect } from 'vitest'
import {
  beatText, gameOverSubtext, lastNightText, lastVoteText, logText, messageText, nightSubtext,
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
    expect(messageText({ kind: 'investigated', round: 1, targetId: 'ben', result: 'mafia' }, nameOf)).toBe('Ben is Mafia.')
    expect(messageText({ kind: 'investigated', round: 1, targetId: 'cal', result: 'not-mafia' }, nameOf)).toBe('Cal is not Mafia.')
    expect(messageText({ kind: 'patient-saved', round: 1, targetId: 'cal' }, nameOf))
      .toBe('Your patient, Cal, was attacked, and you saved them.')
    expect(messageText({ kind: 'protected', round: 1, targetId: 'cal' }, nameOf)).toBe('You protected Cal. Nobody attacked them.')
    expect(messageText({ kind: 'was-saved', round: 1 }, nameOf)).toBe('You were attacked last night, but someone saved you.')
    expect(messageText({ kind: 'mafia-chose', round: 1, targetId: 'cal' }, nameOf)).toBe('The Mafia chose Cal.')
    expect(messageText({ kind: 'mafia-chose', round: 1, targetId: null }, nameOf)).toBe('The Mafia didn’t choose anyone.')
    expect(messageText({ kind: 'slept', round: 1, suspectedId: 'ben' }, nameOf)).toBe('You slept through the night.')
    expect(messageText({ kind: 'no-pick', round: 1, action: 'protect' }, nameOf)).toBe('You didn’t protect anyone.')
  })

  it('keeps a Villager’s suspicion in their log, but not in the dawn message', () => {
    const slept = { kind: 'slept', round: 1, suspectedId: 'ben' } as const
    expect(logText(slept, nameOf)).toBe('You slept through the night. You suspected Ben.')
  })
})

describe('the narrator’s story', () => {
  it('words every kind of beat with names and roles', () => {
    expect(beatText({ kind: 'mafia-targeted', mafiaIds: ['ana', 'ben'], targetId: 'cal', tieBroken: false }, nameOf, roleOf))
      .toBe('The Mafia (Ana, Ben) targeted Cal.')
    expect(beatText({ kind: 'mafia-targeted', mafiaIds: ['ana', 'ben'], targetId: 'cal', tieBroken: true }, nameOf, roleOf))
      .toBe('The Mafia (Ana, Ben) targeted Cal. Their votes were tied, so it was settled at random.')
    expect(beatText({ kind: 'mafia-targeted', mafiaIds: ['ana'], targetId: null, tieBroken: false }, nameOf, roleOf))
      .toBe('The Mafia (Ana) chose nobody.')
    expect(beatText({ kind: 'protected', medicId: 'cal', targetId: 'fay' }, nameOf, roleOf)).toBe('The Medic (Cal) protected Fay.')
    expect(beatText({ kind: 'saved', targetId: 'fay' }, nameOf, roleOf)).toBe('Fay was saved.')
    expect(beatText({ kind: 'killed', targetId: 'fay' }, nameOf, roleOf)).toBe('Fay was killed.')
    expect(beatText({ kind: 'investigated', detectiveId: 'dee', targetId: 'ben', result: 'mafia' }, nameOf, roleOf))
      .toBe('The Detective (Dee) investigated Ben: Mafia.')
    expect(beatText({ kind: 'suspects', playerId: 'fay', targetId: 'ana' }, nameOf, roleOf)).toBe('Fay suspects Ana.')
    expect(beatText({ kind: 'no-pick', playerId: 'fay' }, nameOf, roleOf)).toBe('Fay (Villager) didn’t choose anyone.')
  })
})

describe('summaries', () => {
  it('sums up the night and the vote', () => {
    expect(lastNightText([], nameOf)).toBe('Nobody died last night.')
    expect(lastNightText(['cal'], nameOf)).toBe('Cal was killed in the night.')
    expect(lastNightText(['cal', 'fay'], nameOf)).toBe('Cal and Fay were killed in the night.')
    expect(lastVoteText('ben', nameOf)).toBe('Ben was voted out.')
    expect(lastVoteText(null, nameOf)).toBe('Nobody was voted out.')
  })

  it('cheers the winners and consoles the rest', () => {
    expect(gameOverSubtext('town', 'town')).toBe('Winner winner chicken dinner.')
    expect(gameOverSubtext('mafia', 'town')).toBe('GGs.')
    expect(gameOverSubtext(null, 'town')).toBeNull()
  })
})
