import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Oberfläche für Tauri. Kein Netzwerkzugriff nach außen; Server nur für die Entwicklung auf 127.0.0.1.
export default defineConfig({
  root: 'ui',
  plugins: [react()],
  clearScreen: false,
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022', sourcemap: false },
});
