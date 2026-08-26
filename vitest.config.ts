import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    alias: {
      '@run-down/shared': path.resolve(__dirname, 'shared/src/index.ts'),
      // Point the worker modules to source for testing
    },
  },
  resolve: {
    alias: {
      '@run-down/shared': path.resolve(__dirname, 'shared/src/index.ts'),
    },
  },
});
