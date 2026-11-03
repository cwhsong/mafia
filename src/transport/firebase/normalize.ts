import type { GameEvent, GameState, PlayerView } from '../../engine'

// Firebase drops nulls and empty lists, and may hand lists back as objects.
// These functions turn what comes out of the database back into complete objects.

type Raw = Record<string, unknown>

function asList(value: unknown): Raw[] {
  if (Array.isArray(value)) return value.filter(Boolean) as Raw[]
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (value as Raw)[k] as Raw)
  }
  return []
}

function asStrings(value: unknown): string[] {
  return asList(value) as unknown as string[]
}

export function normalizeGameState(raw: unknown): GameState {
  const r = (raw ?? {}) as Raw
  return {
    hostId: String(r.hostId ?? ''),
    phase: (r.phase as GameState['phase']) ?? 'lobby',
    round: Number(r.round ?? 0),
    players: asList(r.players).map((p) => ({
      id: String(p.id),
      name: String(p.name),
      seat: Number(p.seat ?? 0),
      alive: Boolean(p.alive),
      roleId: (p.roleId as string | undefined) ?? null,
    })),
    roleSlots: asStrings(r.roleSlots),
    seed: Number(r.seed ?? 0),
    winner: (r.winner as GameState['winner']) ?? null,
    log: asList(r.log) as unknown as GameEvent[],
  }
}

export function normalizePlayerView(raw: unknown): PlayerView {
  const r = (raw ?? {}) as Raw
  const me = r.me as Raw | undefined
  return {
    kind: 'player',
    phase: (r.phase as PlayerView['phase']) ?? 'lobby',
    round: Number(r.round ?? 0),
    winner: (r.winner as PlayerView['winner']) ?? null,
    players: asList(r.players).map((p) => ({
      id: String(p.id),
      name: String(p.name),
      seat: Number(p.seat ?? 0),
      alive: Boolean(p.alive),
    })),
    roleSlots: asStrings(r.roleSlots),
    me: me
      ? {
          id: String(me.id),
          name: String(me.name),
          seat: Number(me.seat ?? 0),
          alive: Boolean(me.alive),
          roleId: (me.roleId as string | undefined) ?? null,
        }
      : null,
    teammates: asList(r.teammates).map((t) => ({
      id: String(t.id),
      name: String(t.name),
      roleId: String(t.roleId),
      alive: Boolean(t.alive),
    })),
    revealedRoles: (r.revealedRoles as Record<string, string> | undefined) ?? null,
  }
}
