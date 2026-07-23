// gen-placeholders.mts — emit a greybox placeholder SVG for EVERY asset key.
//
// Run: `npm run gen:placeholders` (executes via `tsx`, which resolves the TS
// import below). Each file is a single colored <rect> at the key's logical
// dimensions with the key name + dimensions as visible text, so the app runs
// end-to-end in Phase 1. Phase 2 REPLACES these files against the EXACT same
// keys/paths/dimensions.
//
// SINGLE SOURCE OF TRUTH: this reads `src/config/assetManifest.ts` directly, so
// a new manifest key can never drift out of lock-step with the generated art —
// add a key there and its greybox is emitted here automatically.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_MANIFEST } from '../src/config/assetManifest';

const OUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');

/** Fill colour per namespace folder (purely to make greyboxes scannable). */
const COLORS: Record<string, string> = {
  dog: '#cfd8e3',
  env: '#d6e8cf',
  entities: '#f2d7a8',
  vfx: '#e6d3f2',
  ui: '#dfe3e8',
  screens: '#eef1f4',
};
const FALLBACK_COLOR = '#dfe3e8';

/** Font size that fits `text` inside `w` (approx 0.6em advance for monospace). */
function fitFont(text: string, w: number, h: number, cap: number): number {
  const byHeight = Math.floor(Math.min(w, h) / 5);
  const byWidth = Math.floor((w - 8) / (text.length * 0.62));
  return Math.max(8, Math.min(byHeight, byWidth, cap));
}

function svg(key: string, w: number, h: number, color: string): string {
  const dims = `${w}x${h}`;
  const keyFs = fitFont(key, w, h, 26);
  const dimFs = fitFont(dims, w, h, Math.max(8, Math.round(keyFs * 0.72)));
  const cx = w / 2;
  const cy = h / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="6" fill="${color}" stroke="#5b6670" stroke-width="2"/>
  <text x="${cx}" y="${cy - keyFs * 0.15}" font-family="monospace" font-size="${keyFs}" fill="#20272e" text-anchor="middle" dominant-baseline="middle">${key}</text>
  <text x="${cx}" y="${cy + keyFs}" font-family="monospace" font-size="${dimFs}" fill="#48525c" text-anchor="middle" dominant-baseline="middle">${dims}</text>
</svg>
`;
}

let count = 0;
for (const a of ASSET_MANIFEST) {
  // `path` is `assets/<folder>/<key>.svg` — derive the folder from it.
  const folder = a.path.split('/')[1] ?? '';
  const color = COLORS[folder] ?? FALLBACK_COLOR;
  const dir = join(OUT_ROOT, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${a.key}.svg`), svg(a.key, a.width, a.height, color));
  count += 1;
}

console.log(`Generated ${count} placeholder SVGs under public/assets/ (source: src/config/assetManifest.ts)`);
