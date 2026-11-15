import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Permite que funcione en cualquier subruta de GitHub Pages
  server: {
    port: 5173,
    cors: true
  }
});
