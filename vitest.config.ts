import { defineConfig } from 'vitest/config'

// Standalone so the app's vite plugins (typed against vite, not vitest's bundled vite) don't clash under tsc.
// Pure-helper unit tests only — node environment, no DOM.
export default defineConfig({
  resolve: {
    alias: { '@': `${import.meta.dirname}/src` },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
