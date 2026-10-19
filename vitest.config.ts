import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // mermaid требует DOM даже для парсинга
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
