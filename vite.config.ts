import { defineConfig, loadEnv } from 'vite';

// GitHub Pages serves a project site from /<repo>/, so assets need that prefix.
// The deploy workflow passes the real repo name through BASE_PATH.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env['BASE_PATH'] || '/pachka/',
    build: { outDir: 'dist', assetsDir: 'assets', target: 'es2022' },
  };
});
