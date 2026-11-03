import { defineConfig } from 'vitest/config'

// Runs only the security-rules tests, inside `firebase emulators:exec` (see package.json).
export default defineConfig({
  test: {
    include: ['rules-tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
})
