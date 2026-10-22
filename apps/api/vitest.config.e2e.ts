import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    testTimeout: 30000,
    root: './',
    include: ['**/*.e2e-spec.ts'],
  },
});
