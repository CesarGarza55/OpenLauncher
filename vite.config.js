import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  build: {
    target: 'esnext',
    sourcemap: false,
    cssMinify: true,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
