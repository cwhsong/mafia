import { expect } from 'vitest'
import { EngineError, type EngineErrorCode } from './errors'

// Passes only if fn throws an EngineError with exactly this code.
export function expectEngineError(fn: () => unknown, code: EngineErrorCode): void {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError)
    expect((error as EngineError).code).toBe(code)
    return
  }
  throw new Error(`Expected EngineError "${code}", but nothing was thrown`)
}