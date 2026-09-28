import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the repo under /picture-tool-motion/; the dev server stays on /.
  base: command === 'build' ? '/picture-tool-motion/' : '/',
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
}));
