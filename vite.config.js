import { defineConfig } from 'vite';

import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // The editor, diagram and whiteboard libraries are large but lazy-loaded;
    // the warning about them is noise on every first run.
    chunkSizeWarningLimit: 2500,
  },
  test: {
    // Agent worktrees live inside the repo; their copies of the tests are not ours.
    exclude: ['**/node_modules/**', '**/dist/**', '.worktrees/**'],
  },
});
