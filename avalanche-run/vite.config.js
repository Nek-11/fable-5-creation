import { defineConfig } from 'vite';

export default defineConfig({
  base: '/fable-5-creation/avalanche-run/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
