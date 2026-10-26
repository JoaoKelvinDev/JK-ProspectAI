import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

const backendTarget = process.env.JK_BACKEND_URL ?? 'http://127.0.0.1:8000';
const proxy = {
  '/api': { target: backendTarget, changeOrigin: true },
  '/health': { target: backendTarget, changeOrigin: true },
  '/openapi.json': { target: backendTarget, changeOrigin: true },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
});
