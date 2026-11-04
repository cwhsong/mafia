// Everything players read about the roles: the Roles page, the in-game role card and the
// narrator's role picker all show this text. Source: the "Mafia: Daybreak — Roles" doc.
// Game rules live in the role definitions (ROLES); this file is words only.

export type Faction = 'town' | 'mafia' | 'neutral'
export type Complexity = 'Beginner' | 'Intermediate' | 'Advanced'

export interface RoleInfo {
  id: string
  name: string
  faction: Faction
  category: string | null   // 'Investigative', 'Protective', …; null for the Villager
  complexity: Complexity
  ability: string           // the one line a player reads on their card
  goal?: string             // only when the ability doesn't already say how they win
  details: string[]
  repeatable?: boolean      // most roles are unique: at most one per game
}

export interface CategoryInfo {
  name: string
  blurb?: string
}

export interface FactionInfo {
  id: Faction
  name: string
  goal: string
  rules?: string[]          // shared rules shown once, above the cards
  note?: string
  categories: CategoryInfo[]
}

export const FACTIONS: FactionInfo[] = [
  {
    id: 'town',
    name: 'Town',
    goal: 'Eliminate every Mafia member and every Neutral Killing and Chaos role. Benign and Evil Neutrals never stand in the way.',
    categories: [
      { name: 'Investigative' },
      { name: 'Protective' },
      { name: 'Killing' },
      { name: 'Support' },
    ],
  },
  {
    id: 'mafia',
    name: 'Mafia',
    goal: 'Match or outnumber everyone else, with no Serial Killer alive.',
    rules: [
      "The Mafia know each other from the start and see each other's action picks and kill votes live.",
      "Every member marks who to kill. The Godfather's mark is final; without him, the most-marked player is killed.",
      'One Mafioso, picked at random each night and shown to the team, carries out the kill. That’s who a Lookout sees and a Bodyguard kills. With no Mafioso, the Godfather does it himself.',
      'Nobody is promoted when the Godfather dies. If every killer dies, a random member becomes a Mafioso, losing their old ability.',
      'Every Mafia result shows on every Mafia phone, since there’s no team chat in person.',
      "Mafia abilities can't target other Mafia.",
    ],
    categories: [{ name: 'Killing' }, { name: 'Support' }, { name: 'Deception' }],
  },
  {
    id: 'neutral',
    name: 'Neutral',
    goal: 'Neutrals play for themselves, with varying goals.',
    note: "Benign and Evil roles never block anyone's win; Killing and Chaos roles must be eliminated for the Town to win.",
    categories: [
      { name: 'Benign', blurb: 'Harmless: wins by surviving, whoever else wins.' },
      { name: 'Evil', blurb: 'Wins by fooling the Town, not by killing.' },
      { name: 'Killing', blurb: 'A lone killer: wins as the last one standing.' },
    ],
  },
]

export const TERMS: { term: string; meaning: string }[] = [
  { term: 'Visit', meaning: 'Any ability aimed at someone else. Abilities with no target (vests, alerts, visions, self-protection) are not visits.' },
  { term: 'Suspicious', meaning: 'A threat the Town must eliminate to win: the Mafia, plus Neutral Killing and Chaos roles.' },
  { term: 'Reads as', meaning: 'What a player looks like to investigators tonight. Usually their real role; changed by roles like the Framer and Impostor.' },
  { term: 'Protected', meaning: "Survives a normal kill. Protection can't stop the Warden's execution, the Vigilante's guilt, revenge kills, or being voted out." },
  { term: 'Distracted', meaning: 'The night action fails. The player is told "You were distracted."' },
  { term: 'Dawn message', meaning: 'The private result each living player gets when the night ends.' },
]

export const NIGHT_ORDER = [
  'Jail and alerts',
  'Distractions',
  'Swaps',
  'Protection',
  'Disguises',
  'Kills',
  'Investigations',
  'False memories',
  'Aftermath (guilt, revenge)',
]

export const ROLE_INFO: RoleInfo[] = [
  // ---------- Town ----------
  {
    id: 'villager', name: 'Villager', faction: 'town', category: null, complexity: 'Beginner', repeatable: true,
    ability: 'No night action. Find the Mafia through discussion and your vote.',
    details: ['Receive a decoy prompt at night ("Who do you suspect?") so nobody can tell who has a night action. Suspicions go only to the narrator.'],
  },
  {
    id: 'detective', name: 'Detective', faction: 'town', category: 'Investigative', complexity: 'Beginner',
    ability: "Investigate someone to learn whether they're suspicious.",
    details: [
      'Suspicious is anyone the Town must eliminate to win: the Mafia, Neutral Killing, and Neutral Chaos.',
      'The Godfather, Benign, and Evil Neutrals read as not suspicious.',
      'Investigation results may be deceiving: a framed player reads as suspicious, and an Impostor reads as the role they copied.',
    ],
  },
  {
    id: 'private-eye', name: 'Private Eye', faction: 'town', category: 'Investigative', complexity: 'Intermediate',
    ability: 'Investigate someone and learn three roles they could be; one is true.',
    details: [
      "The two fakes are drawn from this game's deck.",
      'Investigating the same target again gives the same three roles.',
      'The Godfather shows his real role here; he only fools suspicion checks.',
      "A framed target's shortlist is built around a Mafia role from the deck; an Impostor's is built around the role they copied.",
    ],
  },
  {
    id: 'lookout', name: 'Lookout', faction: 'town', category: 'Investigative', complexity: 'Intermediate',
    ability: 'Watch someone and learn who visited them.',
    details: [
      'Visits can include kills, protections, investigations, distractions, etc.',
      'Of the Mafia, you see only the member who carried out the kill.',
    ],
  },
  {
    id: 'shadow', name: 'Shadow', faction: 'town', category: 'Investigative', complexity: 'Intermediate',
    ability: 'Follow someone and learn who they visited.',
    details: ['A distracted or jailed player visited no one.'],
  },
  {
    id: 'coroner', name: 'Coroner', faction: 'town', category: 'Investigative', complexity: 'Intermediate',
    ability: 'Examine a dead player and learn their true role.',
    details: ['By default, roles stay hidden on death. Removed from the deck when the “Reveal roles on death” setting is on.'],
  },
  {
    id: 'spy', name: 'Spy', faction: 'town', category: 'Investigative', complexity: 'Intermediate',
    ability: 'Learn who the Mafia visited.',
    details: [
      'Provides the names of the targets, not the Mafia.',
      'Includes every Mafia ability: kills, frames, blackmail, checks, false memories.',
      "Mafia abilities can't target other Mafia, so someone never visited across several nights is worth a look.",
    ],
  },
  {
    id: 'psychic', name: 'Psychic', faction: 'town', category: 'Investigative', complexity: 'Intermediate',
    ability: 'Receive a vision of three names: on odd nights at least one is suspicious, on even nights at least one is not suspicious.',
    details: ['Under 9 players, the vision has two names.'],
  },
  {
    id: 'medic', name: 'Medic', faction: 'town', category: 'Protective', complexity: 'Beginner',
    ability: 'Protect someone from being killed.',
    details: [
      'You can protect yourself once a game.',
      "Protection still works if you're killed the same night.",
      'If your patient is attacked, you learn they were attacked and survived, even if another protection saved them.',
      "Protection doesn't work on certain deaths: Warden's execution, Vigilante's guilt, Avenger / Jester's revenge, etc.",
    ],
  },
  {
    id: 'bodyguard', name: 'Bodyguard', faction: 'town', category: 'Protective', complexity: 'Intermediate',
    ability: "Can guard someone; if they're attacked, die in their place and take the attacker down with you.",
    details: [
      "You take priority before the Medic's protection, but the Medic still learns their target was attacked and survived.",
      'A Medic protecting you saves you.',
      'You kill whoever actually visited: the Mafia member carrying out the kill, not the Godfather who ordered it.',
      "You can't guard yourself.",
    ],
  },
  {
    id: 'warden', name: 'Warden', faction: 'town', category: 'Protective', complexity: 'Intermediate',
    ability: 'Lock someone up, blocking their night action and preventing them from being killed.',
    details: [
      "Once a game, you can execute your prisoner and learn their role. The execution can't be stopped.",
      'The prisoner is told they were locked up.',
      "Jailing takes precedence over things like Veteran's alert.",
    ],
  },
  {
    id: 'vigilante', name: 'Vigilante', faction: 'town', category: 'Killing', complexity: 'Intermediate',
    ability: "Shoot someone. If you kill a Town member, you'll die of guilt the next night.",
    details: [
      "Two bullets a game. Can't shoot on Night 1.",
      "You can't act on the night you die of guilt.",
      "If your target is protected, there's no death and no guilt.",
    ],
  },
  {
    id: 'veteran', name: 'Veteran', faction: 'town', category: 'Killing', complexity: 'Intermediate',
    ability: 'Go on alert and shoot everyone who visits you, friend or foe.',
    details: [
      'Two alerts a game.',
      "You can't be distracted while on alert, but the Warden's jail stops you.",
    ],
  },
  {
    id: 'avenger', name: 'Avenger', faction: 'town', category: 'Killing', complexity: 'Intermediate',
    ability: 'When killed, can take one person down with you.',
    details: [
      'Triggers on any death, including being voted out.',
      'Either "Take someone with you" or "Let it go." The narrator waits for the choice.',
    ],
  },
  {
    id: 'mayor', name: 'Mayor', faction: 'town', category: 'Support', complexity: 'Beginner',
    ability: 'Reveal yourself as Mayor during the day to gain 3x voting power for the rest of the game.',
    details: [
      'Reveal is triggered with a button during the day; every roster then shows you as the mayor.',
      "Once you reveal, the Medic can't protect you.",
    ],
  },
  {
    id: 'bartender', name: 'Bartender', faction: 'town', category: 'Support', complexity: 'Intermediate',
    ability: 'Distract someone to block their night action.',
    details: [
      "Distracting the Mafia member carrying out the kill makes the Godfather do it himself; with no Godfather, there's no kill.",
      'A Serial Killer you distract kills you instead.',
      "You can't distract a Veteran on alert, and you'll be shot for trying.",
    ],
  },
  {
    id: 'ferryman', name: 'Ferryman', faction: 'town', category: 'Support', complexity: 'Advanced',
    ability: 'Swap two people: everything aimed at one hits the other.',
    details: ['Every visit is swapped, including kills, protections and investigations.'],
  },
  {
    id: 'twins', name: 'Twins', faction: 'town', category: 'Support', complexity: 'Beginner', repeatable: true,
    ability: 'Start the game knowing who your twin is.',
    details: ['Always dealt as a pair.'],
  },
  {
    id: 'columnist', name: 'Columnist', faction: 'town', category: 'Support', complexity: 'Beginner',
    ability: 'Once a game, publish an anonymous message that the narrator reads at dawn.',
    details: [
      'Written at night, up to about 150 characters.',
      "The narrator reads it privately first and can skip or redact parts if it's inappropriate.",
    ],
  },
  {
    id: 'medium', name: 'Medium', faction: 'town', category: 'Support', complexity: 'Advanced',
    ability: 'Hear from the dead: each dead player can send you one short message.',
    details: [],
  },

  // ---------- Mafia ----------
  {
    id: 'godfather', name: 'Godfather', faction: 'mafia', category: 'Killing', complexity: 'Beginner',
    ability: "Decide who is the Mafia's kill. You read as not suspicious.",
    details: [
      'You carry out the kill only when no Mafioso is alive.',
      'You fool suspicion checks (Detective, Psychic), but the Private Eye sees your real role.',
    ],
  },
  {
    id: 'mafioso', name: 'Mafioso', faction: 'mafia', category: 'Killing', complexity: 'Beginner', repeatable: true,
    ability: "Carry out the Mafia's kill.",
    details: ['With multiple Mafiosos, one is randomly picked each night to carry out the kill.'],
  },
  {
    id: 'consigliere', name: 'Consigliere', faction: 'mafia', category: 'Support', complexity: 'Intermediate',
    ability: 'Investigate someone and learn their category, like "Town Investigative."',
    details: [
      'The result shows on every Mafia phone, in their roster.',
      'Might later change to the exact role, seen only by the Consigliere.',
    ],
  },
  {
    id: 'consort', name: 'Consort', faction: 'mafia', category: 'Support', complexity: 'Intermediate',
    ability: 'Distract someone so their night action fails.',
    details: ['Same rules as the Bartender.'],
  },
  {
    id: 'blackmailer', name: 'Blackmailer', faction: 'mafia', category: 'Support', complexity: 'Beginner',
    ability: "Blackmail someone so they can't speak during the next day.",
    details: [
      'The target can still vote.',
      'The target is notified at dawn, and the narrator enforces it at the table.',
      "You can't blackmail the same person two days in a row.",
    ],
  },
  {
    id: 'framer', name: 'Framer', faction: 'mafia', category: 'Deception', complexity: 'Intermediate',
    ability: 'Frame someone so they read as Mafia to investigators that night.',
    details: ["The Detective sees suspicious; the Private Eye's shortlist is built around a Mafia role from the deck."],
  },
  {
    id: 'impostor', name: 'Impostor', faction: 'mafia', category: 'Deception', complexity: 'Advanced',
    ability: 'Copy someone, reading as their role to investigators.',
    details: ['Detective, Private Eye and Psychic all see the copied role.'],
  },
  {
    id: 'hypnotist', name: 'Hypnotist', faction: 'mafia', category: 'Deception', complexity: 'Intermediate',
    ability: "Plant a false memory: replace someone's dawn message with a fake one.",
    details: [
      'Pick the fake from a set menu: protected, attacked and survived, distracted, locked up, or a quiet night.',
      'The real message is lost, including an investigation result.',
      "You can't fake an investigation result.",
    ],
  },

  // ---------- Neutral ----------
  {
    id: 'survivor', name: 'Survivor', faction: 'neutral', category: 'Benign', complexity: 'Beginner', repeatable: true,
    ability: 'Can put on a bulletproof vest to survive an attack.',
    goal: 'Be alive at the end, whoever wins.',
    details: ['Two vests under 9 players, three at 9 or more.'],
  },
  {
    id: 'amnesiac', name: 'Amnesiac', faction: 'neutral', category: 'Benign', complexity: 'Advanced',
    ability: 'Once a game, pick a dead player and assume their role.',
    goal: "The assumed role's goal.",
    details: [
      "The pick is blind with hidden roles, until it's taken.",
      'Log announces role remembered, but not who remembered it.',
      'Before remembering, they act like a Survivor, winning by being alive at the end, but without vests.',
    ],
  },
  {
    id: 'jester', name: 'Jester', faction: 'neutral', category: 'Evil', complexity: 'Beginner',
    ability: 'Act suspicious on purpose and get yourself voted out.',
    details: [
      "The game continues, and you're included in the win later.",
      'After being voted out, kill one living player who voted you.',
    ],
  },
  {
    id: 'nemesis', name: 'Nemesis', faction: 'neutral', category: 'Evil', complexity: 'Intermediate',
    ability: 'Get your assigned Town player voted out.',
    details: ['If your target dies another way, you become a Jester.'],
  },
  {
    id: 'serial-killer', name: 'Serial Killer', faction: 'neutral', category: 'Killing', complexity: 'Intermediate',
    ability: "Kill someone, until you're the last one standing.",
    details: [
      'A Bartender who distracts you is killed instead.',
      "The Mafia can't win while you're alive.",
      'Recommended for 9+ players.',
    ],
  },
]

export const INFO: Record<string, RoleInfo> = Object.fromEntries(ROLE_INFO.map((r) => [r.id, r]))

// "Town Protective", "Mafia Killing", "Town" (Villager)
export function categoryLabel(info: RoleInfo): string {
  const faction = FACTIONS.find((f) => f.id === info.faction)!.name
  return info.category ? `${faction} ${info.category}` : faction
}

// "Town Protective · Beginner · Repeatable"
export function tagLine(info: RoleInfo): string {
  return [categoryLabel(info), info.complexity, info.repeatable ? 'Repeatable' : null].filter(Boolean).join(' · ')
}
