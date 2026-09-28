import { defineConfig } from 'vitest/config';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the repo under /picture-tool-motion/; the dev server stays on /.
  base: command === 'build' || isPreview ? '/picture-tool-motion/' : '/',
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
}));
