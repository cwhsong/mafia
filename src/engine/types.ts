// ---------- Basic labels ----------

export type Team = 'town' | 'mafia' | 'neutral'

// finale: the game is decided; the narrator tells the ending before the winner is revealed
export type Phase = 'lobby' | 'day' | 'vote' | 'night' | 'dawn' | 'finale' | 'ended'

export type DeathCause = 'vote' | 'night' | 'host' | 'revenge'

// What the Detective learns about someone
export type DetectiveResult = 'suspicious' | 'not-suspicious'

// ---------- Roles ----------

export type NightActionKind =
  | 'kill' | 'protect' | 'investigate'
  | 'shortlist' | 'watch' | 'follow' | 'examine' | 'spy' | 'vision' | 'categorize'
  | 'guard' | 'jail' | 'alert' | 'distract' | 'vest'
  | 'blackmail' | 'frame' | 'disguise' | 'hypnotize' | 'remember'

// The Hypnotist's menu of fake dawn messages
export const FAKE_MESSAGES = ['protected', 'attacked', 'distracted', 'locked-up', 'quiet'] as const
export type FakeMessage = (typeof FAKE_MESSAGES)[number]

// Who a night ability may be aimed at.
//   other: any living player but yourself     any: any living player, yourself included
//   self:  only yourself (an on/off ability)  dead: a dead player     none: no pick at all
export type TargetRule = 'other' | 'any' | 'self' | 'dead' | 'none'

export interface NightAbility {
  kind: NightActionKind     // decides which step of the night it resolves in (see steps.ts)
  target: TargetRule
  sharedWithTeam?: boolean  // true for Mafia killers: the team picks one kill together
  maxUses?: number | ((playerCount: number) => number)  // e.g. the Vigilante's bullets; absent = unlimited
  selfUses?: number         // how often they may target themselves (Medic: once); absent = unlimited
  fromNight?: number        // first night it can be used (Vigilante: 2); absent = Night 1
  options?: readonly string[]  // an extra choice made with the pick (Hypnotist's fake message, Warden's 'execute')
  optionUses?: number       // how often an option may be used (Warden: execute once)
}

export interface RoleDef {
  id: string                // 'medic' (used in code, never shown)
  name: string              // 'Medic' (shown to players)
  emoji: string
  team: Team
  category: string          // e.g. 'Town Protective'
  description: string       // one or two sentences for the role card
  night: NightAbility | null  // null = no night action (Villager, Jester)
  appearsAs?: DetectiveResult // overrides suspicion checks (the Godfather reads as not suspicious)
  available: boolean        // false = defined but hidden from the role picker
}

// ---------- Players and game ----------

export interface Player {
  id: string
  name: string
  seat: number              // 0, 1, 2… in join order
  alive: boolean
  roleId: string | null     // null until roles are dealt
}

export type GameEvent =
  | { type: 'dealt' }
  | { type: 'phase'; phase: Phase; round: number }
  | { type: 'eliminated'; playerId: string; cause: DeathCause }
  | { type: 'game-over'; winner: Team }

// ---------- Night ----------

// One private dawn message. Every living player gets at least one each night.
export type PrivateResult =
  | { kind: 'investigated'; round: number; targetId: string; result: DetectiveResult }
  | { kind: 'patient-saved'; round: number; targetId: string }  // Medic: their patient was attacked and saved
  | { kind: 'protected'; round: number; targetId: string }      // Medic: nobody attacked their patient
  | { kind: 'was-saved'; round: number }                        // you were attacked, someone saved you
  | { kind: 'mafia-chose'; round: number; targetId: string | null }
  | { kind: 'slept'; round: number; suspectedId: string | null } // no night action (the decoy pick is kept)
  | { kind: 'no-pick'; round: number; action: NightActionKind }  // had an action but didn't choose
  // Wave 1 roles: what you did
  | { kind: 'shortlist'; round: number; targetId: string; roleIds: string[] }
  | { kind: 'watched'; round: number; targetId: string; visitorIds: string[] }
  | { kind: 'followed'; round: number; targetId: string; visitedIds: string[] }
  | { kind: 'examined'; round: number; targetId: string; roleId: string }
  | { kind: 'spied'; round: number; targetIds: string[] }
  | { kind: 'vision'; round: number; playerIds: string[]; evil: boolean }
  | { kind: 'categorized'; round: number; targetId: string; category: string; byId: string }
  | { kind: 'guarded'; round: number; targetId: string; fought: boolean }
  | { kind: 'jailed'; round: number; targetId: string; executedRole: string | null }
  | { kind: 'alerted'; round: number; shotIds: string[] }
  | { kind: 'distracted-them'; round: number; targetId: string }
  | { kind: 'vest'; round: number; left: number }
  | { kind: 'shot'; round: number; targetId: string }
  | { kind: 'blackmailed-them'; round: number; targetId: string }
  | { kind: 'framed'; round: number; targetId: string }
  | { kind: 'disguised'; round: number; targetId: string; roleId: string }
  | { kind: 'hypnotized'; round: number; targetId: string; fake: FakeMessage }
  | { kind: 'remembered'; round: number; roleId: string }
  | { kind: 'revenge'; round: number; targetId: string }
  // Wave 1 roles: what happened to you
  | { kind: 'locked-up'; round: number }
  | { kind: 'distracted'; round: number }
  | { kind: 'blackmailed'; round: number }
  | { kind: 'watched-over'; round: number }   // a Hypnotist's fake "protected" message
  | { kind: 'guilt'; round: number }
  | { kind: 'became-jester'; round: number }

// What happened in the night, for the narrator's story.
export type StoryBeat =
  | { kind: 'mafia-targeted'; mafiaIds: string[]; targetId: string | null; tieBroken: boolean }
  | { kind: 'protected'; medicId: string; targetId: string }
  | { kind: 'saved'; targetId: string }
  | { kind: 'killed'; targetId: string }
  | { kind: 'investigated'; detectiveId: string; targetId: string; result: DetectiveResult }
  | { kind: 'suspects'; playerId: string; targetId: string }
  | { kind: 'no-pick'; playerId: string }
  // Every other ability, worded by the narrator screen (see beatText)
  | { kind: 'ability'; actorId: string; ability: BeatAbility; targetIds: string[]; detail?: string }

export type BeatAbility =
  | NightActionKind
  | 'execute' | 'veteran-shot' | 'intercept' | 'redirect' | 'guilt' | 'revenge' | 'blocked'

// The night's outcome, waiting at dawn for the narrator to reveal it.
export interface DawnResult {
  round: number
  deaths: string[]
  beats: StoryBeat[]
  picks: Record<string, string>  // every pick, for the narrator's raw view
  endsGame: Team | null          // who would win once these deaths apply
  roleChanges: Record<string, string>  // player id → new role id (Amnesiac), applied at reveal
}

// ---------- Vote ----------

export const ABSTAIN = 'abstain'

export interface VoteResult {
  round: number
  counts: Record<string, number>  // player id → votes
  abstain: number                 // chose Abstain or didn't vote
  eliminatedId: string | null     // most votes AND more than Abstain; ties mean nobody
  endsGame: Team | null
}

// ---------- Public record ----------

// Things everyone at the table saw happen, in order. Players' logs are built from these
// plus their own private results.
export type PublicEntry =
  | { kind: 'night'; round: number; deaths: string[] }
  | { kind: 'vote'; round: number; eliminatedId: string | null; voters: string[] }  // voters: who voted them out
  | { kind: 'narrator-eliminated'; round: number; phase: Phase; playerIds: string[] }
  | { kind: 'mayor'; round: number; playerId: string }                       // revealed as Mayor
  | { kind: 'revenge'; round: number; byId: string; targetId: string | null }  // Avenger or Jester took someone with them
  | { kind: 'remembered'; round: number; roleId: string }                     // an Amnesiac remembered (who stays secret)

// ---------- Whole game ----------

export interface GameState {
  hostId: string
  phase: Phase
  round: number             // 0 in lobby; 1 = Day 1 / Night 1, and so on
  players: Player[]
  roleSlots: string[]       // role ids in the game, one per player
  seed: number              // makes dealing reproducible
  winner: Team | null
  log: GameEvent[]
  nightPicks: Record<string, string>      // tonight: player id → target id
  dawn: DawnResult | null                 // set at dawn until the narrator reveals
  lastNight: { round: number; deaths: string[] } | null  // shown on the following day
  results: Record<string, PrivateResult[]> // each player's private messages, oldest first
  selfTargets: Record<string, number>     // times each player has targeted themselves
  uses: Record<string, number>            // times each player has used a limited ability
  votes: Record<string, string>           // this vote: voter id → target id or ABSTAIN
  voteResult: VoteResult | null           // set when the narrator closes the vote
  lastVote: { round: number; eliminatedId: string | null } | null  // shown the following night
  history: PublicEntry[]                  // the public record of the game
  finale: { winner: Team; round: number; fromPhase: Phase } | null  // set during the finale, narrator only

  // Wave 1 roles
  nightOptions: Record<string, string>    // tonight: player id → extra choice (fake message, 'execute')
  optionUses: Record<string, number>      // times each player has used their option (Warden's execution)
  mayorId: string | null                  // the revealed Mayor
  blackmailed: { playerId: string; round: number } | null  // can't speak during this day
  lastBlackmail: Record<string, string>   // Blackmailer → who they blackmailed last night
  guilt: Record<string, number>           // Vigilante → the night they die of guilt
  nemesisTargets: Record<string, string>  // Nemesis → their assigned Town player
  pendingRevenge: { kind: 'avenger' | 'jester'; playerId: string; options: string[]; round: number } | null
  neutralWins: string[]                   // Jesters voted out, Nemeses whose target was voted out
}

// ---------- Commands (every change to the game is one of these) ----------

export type Command =
  | { type: 'addPlayer'; id: string; name: string }
  | { type: 'removePlayer'; id: string }
  | { type: 'setRoleSlots'; slots: string[] }
  | { type: 'deal' }
  | { type: 'advance' }
  | { type: 'eliminate'; playerIds: string[]; cause: DeathCause }
  // Night and vote (players send these from their phones)
  | { type: 'submitAction'; playerId: string; targetId: string; option?: string }
  | { type: 'clearAction'; playerId: string }
  | { type: 'revealMayor'; playerId: string }
  | { type: 'takeRevenge'; playerId: string; targetId: string | null }  // Avenger / Jester; null = let it go
  | { type: 'castVote'; playerId: string; targetId: string }  // a player id or ABSTAIN
  // Narrator
  | { type: 'resolveNight' }
  | { type: 'reveal' }
  | { type: 'closeVote' }
  | { type: 'reopenVote' }
  | { type: 'revealVote' }
  | { type: 'revealWinner' }

// Commands a player may send about themselves; everything else is the narrator's.
export const PLAYER_COMMANDS = ['submitAction', 'clearAction', 'castVote', 'revealMayor', 'takeRevenge'] as const