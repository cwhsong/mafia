// ---------- Basic labels ----------

export type Team = 'town' | 'mafia' | 'neutral'

//export type Phase = 'lobby' | 'night' | 'day' | 'vote' | 'ended'
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

export interface GameState {
  hostId: string
  phase: Phase
  round: number             // 0 in lobby; 1 = night 1 / day 1, and so on
  players: Player[]
  roleSlots: string[]       // role ids in the game, one per player
  seed: number              // makes dealing reproducible
  winner: Team | null
  log: GameEvent[]
}

// ---------- Commands (every change to the game is one of these) ----------

export type Command =
  | { type: 'addPlayer'; id: string; name: string }
  | { type: 'removePlayer'; id: string }
  | { type: 'setRoleSlots'; slots: string[] }
  | { type: 'deal' }
  | { type: 'advance' }
  | { type: 'eliminate'; playerIds: string[]; cause: DeathCause }