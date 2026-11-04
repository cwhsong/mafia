import { describe, expect, it } from 'vitest'
import { parseRoute, rolesHref } from './route'
import { codeFromHash } from '../transport/roomCode'

describe('parseRoute', () => {
  it('reads the Roles page and a role', () => {
    expect(parseRoute('#/roles')).toEqual({ page: 'roles', roleId: null })
    expect(parseRoute('#/roles/')).toEqual({ page: 'roles', roleId: null })
    expect(parseRoute('#/roles/private-eye')).toEqual({ page: 'roles', roleId: 'private-eye' })
  })

  it('leaves join links and empty hashes to the app', () => {
    expect(parseRoute('#KXQRTZ')).toEqual({ page: 'app' })
    expect(parseRoute('')).toEqual({ page: 'app' })
  })

  it('never reads a page link as a room code', () => {
    expect(codeFromHash(rolesHref('medic'))).toBeNull()
    expect(codeFromHash(rolesHref())).toBeNull()
  })
})
