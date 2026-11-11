import { defineConfig } from 'vite';

// GitHub Pages serves the site from /lanekeeper/. Override with SITE_BASE=/ for a custom domain.
export default defineConfig({
  base: process.env.SITE_BASE ?? '/lanekeeper/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'], maplibre: ['maplibre-gl'] },
      },
    },
  },
  test: { environment: 'node' },
});
