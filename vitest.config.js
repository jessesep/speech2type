import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js', 'tests/**/*.spec.js'],
    exclude: ['node_modules', 'dist', 'build', 'gui'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['src/index.js'], // Too large to test initially
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
