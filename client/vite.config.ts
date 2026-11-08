import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: funciona em qualquer subpasta (ex.: /nome-do-repo/ no GitHub Pages).
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
});
