// ---------- Basic labels ----------

export type Team = 'town' | 'mafia' | 'neutral'

export type Phase = 'lobby' | 'day' | 'vote' | 'night' | 'dawn' | 'ended'

export type DeathCause = 'vote' | 'night' | 'host'

// What the Detective learns about someone
export type DetectiveResult = 'mafia' | 'not-mafia'

// ---------- Roles ----------

export type NightActionKind = 'kill' | 'protect' | 'investigate'

export interface NightAbility {
  kind: NightActionKind
  priority: number          // lower runs first when the night resolves
  canTargetSelf: boolean
  sharedWithTeam?: boolean  // true for Mafia: the team picks one kill together
  maxUses?: number          // e.g. Vigilante's limited bullets; absent = unlimited
  selfUses?: number         // how often they may target themselves (Medic: once); absent = unlimited
}

export interface RoleDef {
  id: string                // 'medic' (used in code, never shown)
  name: string              // 'Medic' (shown to players)
  emoji: string
  team: Team
  category: string          // e.g. 'Town Protective'
  description: string       // one or two sentences for the role card
  night: NightAbility | null  // null = no night action (Villager, Jester)
  appearsAs?: DetectiveResult // overrides what the Detective sees (e.g. Godfather later)
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

// What happened in the night, for the narrator's story.
export type StoryBeat =
  | { kind: 'mafia-targeted'; mafiaIds: string[]; targetId: string | null; tieBroken: boolean }
  | { kind: 'protected'; medicId: string; targetId: string }
  | { kind: 'saved'; targetId: string }
  | { kind: 'killed'; targetId: string }
  | { kind: 'investigated'; detectiveId: string; targetId: string; result: DetectiveResult }
  | { kind: 'suspects'; playerId: string; targetId: string }
  | { kind: 'no-pick'; playerId: string }

// The night's outcome, waiting at dawn for the narrator to reveal it.
export interface DawnResult {
  round: number
  deaths: string[]
  beats: StoryBeat[]
  picks: Record<string, string>  // every pick, for the narrator's raw view
  endsGame: Team | null          // who would win once these deaths apply
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
  votes: Record<string, string>           // this vote: voter id → target id or ABSTAIN
  voteResult: VoteResult | null           // set when the narrator closes the vote
  lastVote: { round: number; eliminatedId: string | null } | null  // shown the following night
  history: PublicEntry[]                  // the public record of the game
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
  | { type: 'submitAction'; playerId: string; targetId: string }
  | { type: 'castVote'; playerId: string; targetId: string }  // a player id or ABSTAIN
  // Narrator
  | { type: 'resolveNight' }
  | { type: 'reveal' }
  | { type: 'closeVote' }
  | { type: 'reopenVote' }
  | { type: 'revealVote' }

// Commands a player may send about themselves; everything else is the narrator's.
export const PLAYER_COMMANDS = ['submitAction', 'castVote'] as const