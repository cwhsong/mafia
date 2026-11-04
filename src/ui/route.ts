import { useSyncExternalStore } from 'react'

// Pages live after the # so GitHub Pages can serve them from one file:
//   #/roles          the Roles page
//   #/roles/medic    the Roles page with the Medic open
// Join links use the same spot for a room code (#KXQRTZ). Codes never contain "/",
// so the two can't be confused.
export type Route = { page: 'app' } | { page: 'roles'; roleId: string | null }

export function parseRoute(hash: string): Route {
  const match = hash.match(/^#\/roles(?:\/([a-z-]+))?\/?$/)
  if (match) return { page: 'roles', roleId: match[1] ?? null }
  return { page: 'app' }
}

export function rolesHref(roleId?: string | null): string {
  return roleId ? `#/roles/${roleId}` : '#/roles'
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseRoute(hash)
}

// Leaves a page without adding a history step for the join code that may follow.
export function goHome() {
  history.pushState(null, '', window.location.pathname + window.location.search)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
