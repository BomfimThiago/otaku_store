import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'api',
          root: './api',
          include: ['src/**/*.test.ts'],
        },
      },
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
