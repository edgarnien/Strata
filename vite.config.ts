import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // Relative asset URLs: the build works under any GitHub Pages path (the repo was renamed
  // from picture-tool-motion to Strata) and in `vite preview`; the dev server stays on /.
  base: command === 'build' ? './' : '/',
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
}));
