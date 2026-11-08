import { defineConfig } from 'vite';

// Claude-Brücke als EINE Datei für Node ≥ 22 auf dem Terminalserver (ohne node_modules): dist-bruecke/praxis-bruecke.mjs
export default defineConfig({
  build: {
    ssr: 'src/bruecke/server.ts',
    outDir: 'dist-bruecke',
    emptyOutDir: true,
    target: 'node22',
    sourcemap: false,
    minify: false,
    rollupOptions: { output: { entryFileNames: 'praxis-bruecke.mjs', format: 'es' } },
  },
  ssr: { noExternal: true, target: 'node' },
});
