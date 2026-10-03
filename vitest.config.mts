import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Logica pura (scoring, telefone, mensagens): nao precisa de DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
