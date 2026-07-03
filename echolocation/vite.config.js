import { defineConfig } from 'vite';

export default defineConfig({
  base: '/fable-5-creation/echolocation/',
  resolve: {
    dedupe: ['three'],
  },
  optimizeDeps: {
    include: ['three'],
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
