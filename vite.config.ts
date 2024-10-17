import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: '/POST-Space-apps-orrery-web-app/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        aboutUs: path.resolve(__dirname, 'about-us.html'),
        credits: path.resolve(__dirname, 'credits.html'),
        main: path.resolve(__dirname, 'index.html'),
        learn: path.resolve(__dirname, 'learn-more.html'),
        map: path.resolve(__dirname, 'map.html'),
      }
    },
    target: 'esnext',
  }
});
