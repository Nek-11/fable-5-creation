import { defineConfig } from 'vite';

export default defineConfig({
  base: '/fable-5-creation/paper-storm/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
