import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  define: { 'process.env.COPILOTKIT_TELEMETRY_DISABLED': '"true"' },
  build: { target: 'es2022', chunkSizeWarningLimit: 2500 },
});
