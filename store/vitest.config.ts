import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      './api/vitest.config.ts',
      './web/vitest.config.ts',
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
