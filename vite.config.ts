import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/mafia/',
  test: {
    // Security-rules tests need the Firebase emulator; they run via `npm run test:rules`.
    include: ['src/**/*.test.ts'],
  },
})
