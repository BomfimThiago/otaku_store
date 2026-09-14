import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      './api/vitest.config.ts',
      {
        test: {
          name: 'web',
          root: './web',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'shared',
          root: './shared',
          include: ['src/**/*.test.ts'],
        },
      },
    ],
  },
});
