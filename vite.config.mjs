import { defineConfig } from 'vite';

// live2d-web pulls in wlipsync, whose WASM bootstrap contains top-level await.
// Vite 6's default dependency optimizer target is older than TLA support.
export default defineConfig({
  optimizeDeps: {
    esbuildOptions: { target: 'esnext' },
  },
  esbuild: { target: 'esnext' },
  build: { target: 'esnext' },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
