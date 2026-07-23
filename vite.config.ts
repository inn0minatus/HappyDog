import { defineConfig } from 'vite';

// Static-site build (no backend). `base: './'` keeps every asset/script URL
// relative so the built `dist/` works when served from a domain root OR a
// sub-path (Cloudflare Pages / Netlify / a nested folder) without edits.
//
// Assets live in `public/assets/**` and are copied verbatim into `dist/assets/**`
// (Phaser loads them at runtime via `this.load.svg(key, 'assets/...')`), so we do
// NOT want Vite to inline or hash them — `publicDir` files are always emitted as-is.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: false,
    // The single large chunk is the Phaser engine itself; a runner game loads it
    // all up-front, so code-splitting buys nothing. Raise the advisory ceiling
    // above Phaser's size instead of adding manualChunks.
    chunkSizeWarningLimit: 2000,
  },
  server: {
    host: true,
    open: false,
  },
  preview: {
    host: true,
  },
});
