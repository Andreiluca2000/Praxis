import { defineConfig } from 'vitest/config';

// Tests laufen vom Projektordner aus (vite.config.ts setzt root auf ui/ für die Oberfläche).
export default defineConfig({
  test: { root: '.', include: ['tests/**/*.test.ts'], environment: 'node' },
});
