import { defineConfig } from 'vite';

// Static-site build (no backend). The demo ships to a GitHub Pages PROJECT page
// served under the `/HappyDog/` sub-path, so `base` is that ABSOLUTE prefix:
// Vite rewrites every asset/script URL it processes (index.html, JS imports) to
// `/HappyDog/…`, and `import.meta.env.BASE_URL` resolves to `/HappyDog/` for the
// RUNTIME string URLs Phaser builds (see PreloadScene + assetManifest).
//
// Assets live in `public/assets/**` and are copied verbatim into `dist/assets/**`
// (Phaser loads them at runtime via `this.load.svg(key, `${BASE_URL}assets/...`)`),
// so we do NOT want Vite to inline or hash them — `publicDir` files are emitted as-is.
export default defineConfig({
  base: '/HappyDog/',
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
