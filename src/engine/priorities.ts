// Resolves in ascending order, Lower numbers resolve first. Gaps leave room for future roles
// (e.g. role blocks at 10, redirects at 20).
export const PRIORITY = {
  protect: 30,
  kill: 40,
  investigate: 50,
} as const