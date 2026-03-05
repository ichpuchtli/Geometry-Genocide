import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [glsl()],
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
