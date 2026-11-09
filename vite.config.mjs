import { defineConfig } from 'vite';

// live2d-web pulls in wlipsync, whose WASM bootstrap contains top-level await.
// Vite 6's default dependency optimizer target is older than TLA support.
// GitHub Actions provides GITHUB_REPOSITORY=owner/repository.
// Local npm run dev uses '/', while GitHub Pages uses '/repository/'.
const [owner = '', repo = ''] = (process.env.GITHUB_REPOSITORY || '').split('/');
const pagesBase = repo
  ? (repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '/' : `/${repo}/`)
  : '/';

export default defineConfig({
  base: pagesBase,
  optimizeDeps: {
    esbuildOptions: { target: 'esnext' },
  },
  esbuild: { target: 'esnext' },
  build: { target: 'esnext' },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
