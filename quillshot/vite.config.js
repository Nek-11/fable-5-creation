import { defineConfig } from 'vite';

export default defineConfig({
  base: '/fable-5-creation/quillshot/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
