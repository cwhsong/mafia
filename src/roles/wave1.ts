import type { RoleDef } from '../engine/types'
import { FAKE_MESSAGES } from '../engine/types'

// Wave 1 roles. Words players read live in info.ts; this file is the rules.
// `available: true` puts a role in the narrator's role picker.

export const privateEye: RoleDef = {
  id: 'private-eye', name: 'Private Eye', emoji: '🕵️', team: 'town', category: 'Town Investigative',
  description: 'Investigate someone and learn three roles they could be; one is true.',
  night: { kind: 'shortlist', target: 'other' }, available: true,
}

export const lookout: RoleDef = {
  id: 'lookout', name: 'Lookout', emoji: '👀', team: 'town', category: 'Town Investigative',
  description: 'Watch someone and learn who visited them.',
  night: { kind: 'watch', target: 'other' }, available: true,
}

export const shadow: RoleDef = {
  id: 'shadow', name: 'Shadow', emoji: '👣', team: 'town', category: 'Town Investigative',
  description: 'Follow someone and learn who they visited.',
  night: { kind: 'follow', target: 'other' }, available: true,
}

export const coroner: RoleDef = {
  id: 'coroner', name: 'Coroner', emoji: '⚰️', team: 'town', category: 'Town Investigative',
  description: 'Examine a dead player and learn their true role.',
  night: { kind: 'examine', target: 'dead' }, available: true,
}

export const spy: RoleDef = {
  id: 'spy', name: 'Spy', emoji: '🎧', team: 'town', category: 'Town Investigative',
  description: 'Learn who the Mafia visited.',
  night: { kind: 'spy', target: 'none' }, available: true,
}

export const psychic: RoleDef = {
  id: 'psychic', name: 'Psychic', emoji: '🔮', team: 'town', category: 'Town Investigative',
  description: 'Receive a vision of names; on odd nights one is suspicious, on even nights one is not.',
  night: { kind: 'vision', target: 'none' }, available: true,
}

export const bodyguard: RoleDef = {
  id: 'bodyguard', name: 'Bodyguard', emoji: '🛡️', team: 'town', category: 'Town Protective',
  description: "Guard someone; if they're attacked, die in their place and take the attacker down with you.",
  night: { kind: 'guard', target: 'other' }, available: true,
}

export const warden: RoleDef = {
  id: 'warden', name: 'Warden', emoji: '🔒', team: 'town', category: 'Town Protective',
  description: 'Lock someone up, blocking their night action and preventing them from being killed.',
  night: { kind: 'jail', target: 'other', options: ['execute'], optionUses: 1 }, available: true,
}

export const veteran: RoleDef = {
  id: 'veteran', name: 'Veteran', emoji: '🎖️', team: 'town', category: 'Town Killing',
  description: 'Go on alert and shoot everyone who visits you, friend or foe.',
  night: { kind: 'alert', target: 'self', maxUses: 2 }, available: true,
}

export const avenger: RoleDef = {
  id: 'avenger', name: 'Avenger', emoji: '⚔️', team: 'town', category: 'Town Killing',
  description: 'When killed, can take one person down with you.',
  night: null, available: true,
}

export const mayor: RoleDef = {
  id: 'mayor', name: 'Mayor', emoji: '🎩', team: 'town', category: 'Town Support',
  description: 'Reveal yourself as Mayor during the day to gain 3x voting power for the rest of the game.',
  night: null, available: true,
}

export const bartender: RoleDef = {
  id: 'bartender', name: 'Bartender', emoji: '🍸', team: 'town', category: 'Town Support',
  description: 'Distract someone to block their night action.',
  night: { kind: 'distract', target: 'other' }, available: true,
}

export const godfather: RoleDef = {
  id: 'godfather', name: 'Godfather', emoji: '🌹', team: 'mafia', category: 'Mafia Killing',
  description: "Decide who is the Mafia's kill. You read as not suspicious.",
  night: { kind: 'kill', target: 'other', sharedWithTeam: true },
  appearsAs: 'not-suspicious', available: true,
}

export const consigliere: RoleDef = {
  id: 'consigliere', name: 'Consigliere', emoji: '📜', team: 'mafia', category: 'Mafia Support',
  description: 'Investigate someone and learn their category, like "Town Investigative."',
  night: { kind: 'categorize', target: 'other' }, available: true,
}

export const consort: RoleDef = {
  id: 'consort', name: 'Consort', emoji: '💋', team: 'mafia', category: 'Mafia Support',
  description: 'Distract someone so their night action fails.',
  night: { kind: 'distract', target: 'other' }, available: true,
}

export const blackmailer: RoleDef = {
  id: 'blackmailer', name: 'Blackmailer', emoji: '✉️', team: 'mafia', category: 'Mafia Support',
  description: "Blackmail someone so they can't speak during the next day.",
  night: { kind: 'blackmail', target: 'other' }, available: true,
}

export const framer: RoleDef = {
  id: 'framer', name: 'Framer', emoji: '🖼️', team: 'mafia', category: 'Mafia Deception',
  description: 'Frame someone so they read as Mafia to investigators that night.',
  night: { kind: 'frame', target: 'other' }, available: true,
}

export const impostor: RoleDef = {
  id: 'impostor', name: 'Impostor', emoji: '🎭', team: 'mafia', category: 'Mafia Deception',
  description: 'Copy someone, reading as their role to investigators.',
  night: { kind: 'disguise', target: 'other' }, available: true,
}

export const hypnotist: RoleDef = {
  id: 'hypnotist', name: 'Hypnotist', emoji: '🌀', team: 'mafia', category: 'Mafia Deception',
  description: "Plant a false memory: replace someone's dawn message with a fake one.",
  night: { kind: 'hypnotize', target: 'other', options: FAKE_MESSAGES }, available: true,
}

export const survivor: RoleDef = {
  id: 'survivor', name: 'Survivor', emoji: '🦺', team: 'neutral', category: 'Neutral Benign',
  description: 'Can put on a bulletproof vest to survive an attack.',
  night: { kind: 'vest', target: 'self', maxUses: (players) => (players >= 9 ? 3 : 2) }, available: true,
}

export const amnesiac: RoleDef = {
  id: 'amnesiac', name: 'Amnesiac', emoji: '❔', team: 'neutral', category: 'Neutral Benign',
  description: 'Once a game, pick a dead player and assume their role.',
  night: { kind: 'remember', target: 'dead', maxUses: 1 }, available: true,
}

export const nemesis: RoleDef = {
  id: 'nemesis', name: 'Nemesis', emoji: '🎯', team: 'neutral', category: 'Neutral Evil',
  description: 'Get your assigned Town player voted out.',
  night: null, available: true,
}

export const serialKiller: RoleDef = {
  id: 'serial-killer', name: 'Serial Killer', emoji: '🔪', team: 'neutral', category: 'Neutral Killing',
  description: "Kill someone, until you're the last one standing.",
  night: { kind: 'kill', target: 'other' }, available: true,
}

export const WAVE_1: RoleDef[] = [
  privateEye, lookout, shadow, coroner, spy, psychic, bodyguard, warden, veteran, avenger, mayor, bartender,
  godfather, consigliere, consort, blackmailer, framer, impostor, hypnotist,
  survivor, amnesiac, nemesis, serialKiller,
]
