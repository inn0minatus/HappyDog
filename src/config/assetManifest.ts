/**
 * assetManifest.ts — the SINGLE SHARED asset contract for the whole game.
 *
 * PreloadScene iterates this manifest to load every asset via `load.svg`, and
 * `scripts/gen-placeholders.mts` reads the same key/width/height set to emit the
 * Phase-1 greybox SVGs. Phase 2 REPLACES the SVG files against these EXACT keys
 * and dimensions — do not rename keys or change dims without updating both the
 * art and any code that positions the sprite.
 *
 * Conventions:
 *  - ALL graphics are SVG (locked override): one file per entity/state.
 *  - Keys are stable & namespaced (`dog_*`, `park_*`, `ui_*`, `vfx_*`, ...).
 *  - `path` is relative (no leading slash) so it resolves under any base path.
 *  - Dimensions are LOGICAL px at the 1280×720 landscape canvas; parallax /
 *    full-screen layers span the full 1280 width.
 */

export interface AssetDef {
  /** Stable texture key used everywhere in code. */
  readonly key: string;
  /** Always 'svg' in this project. */
  readonly type: 'svg';
  /** Rasterization width passed to load.svg (logical px). */
  readonly width: number;
  /** Rasterization height passed to load.svg (logical px). */
  readonly height: number;
  /** Path under /public, relative to the document base. */
  readonly path: string;
}

// Generic over the key so literal key types survive inference (powers `AssetKey`
// and the typo-safe `KEYS` lookup below).
const asset = <K extends string>(key: K, width: number, height: number, folder: string) => ({
  key,
  type: 'svg' as const,
  width,
  height,
  path: `assets/${folder}/${key}.svg`,
});

export const ASSET_MANIFEST = [
  // ── Hero dog — 5 states + armored variant (spec §4.1). One MVP dog. ──
  asset('dog_run', 140, 150, 'dog'), // default auto-run loop
  asset('dog_jump', 140, 150, 'dog'), // on tap (rise + fall)
  asset('dog_hit', 140, 150, 'dog'), // on −1 HP
  asset('dog_victory', 160, 170, 'dog'), // victory screen / crossing finish
  asset('dog_defeat', 160, 170, 'dog'), // game over
  asset('dog_armored', 150, 160, 'dog'), // armored run overlay/variant

  // ── Environment — park, parallax spans full 1280 width (spec §4.2) ──
  asset('park_bg_far', 1280, 720, 'env'), // far skyline/treeline (slowest)
  asset('park_bg_near', 1280, 360, 'env'), // near foliage (medium)
  asset('ground_tile', 256, 160, 'env'), // repeating ground/path tile (band y580→720)
  asset('park_fg_grass', 1280, 140, 'env'), // optional foreground grass tufts

  // ── Gameplay entities (spec §4.3) ──
  asset('tick', 64, 64, 'entities'), // damaging enemy
  asset('tablet', 56, 56, 'entities'), // collectible (the product)
  asset('bush', 150, 110, 'entities'), // jump obstacle
  asset('puddle', 180, 50, 'entities'), // jump obstacle
  asset('armor_pickup', 64, 64, 'entities'), // shield power-up pickup
  asset('finish_line', 96, 480, 'entities'), // spawned once at LEVEL_LENGTH

  // ── Armor VFX (spec §4.4) ──
  asset('vfx_armor_burst', 140, 140, 'vfx'), // pickup burst
  asset('vfx_armor_aura', 170, 170, 'vfx'), // persistent active aura (+ expiry flash)

  // ── UI kit (spec §4.5 / §6) ──
  asset('ui_heart_full', 52, 52, 'ui'), // HP heart (filled) — shape+fill, not colour alone
  asset('ui_heart_empty', 52, 52, 'ui'), // HP heart (empty)
  asset('ui_score_icon', 44, 44, 'ui'), // optional score icon
  asset('ui_btn_pause', 64, 64, 'ui'), // HUD pause button
  asset('ui_btn_mute_on', 64, 64, 'ui'), // mute toggle — sound ON state
  asset('ui_btn_mute_off', 64, 64, 'ui'), // mute toggle — sound OFF state
  asset('ui_progress_bar', 1180, 14, 'ui'), // full-width thin level-progress bar
  asset('ui_title_logo', 720, 260, 'ui'), // menu title / logo placeholder
  asset('ui_btn_play', 360, 104, 'ui'), // primary Play button
  asset('ui_promo_chip', 460, 120, 'ui'), // promo-code chip on results
  asset('ui_btn_cta', 380, 100, 'ui'), // buy CTA button
  asset('ui_btn_play_again', 300, 84, 'ui'), // secondary "play again" button
  asset('ui_pause_panel', 520, 360, 'ui'), // centered pause overlay panel

  // ── Full-screen backgrounds (spec §4.5 / §6) ──
  asset('screen_bg_menu', 1280, 720, 'screens'), // main menu backdrop
  asset('screen_bg_victory', 1280, 720, 'screens'), // victory results backdrop
  asset('screen_bg_gameover', 1280, 720, 'screens'), // game-over results backdrop
];

/** Union of every valid asset key (literal), derived from the manifest. */
export type AssetKey = (typeof ASSET_MANIFEST)[number]['key'];

/**
 * Typo-safe key accessors. Prefer `KEYS.dog_run` over the bare string in code so
 * a renamed asset surfaces as a compile error, not a silent missing texture.
 */
export const KEYS = Object.fromEntries(ASSET_MANIFEST.map((a) => [a.key, a.key])) as {
  readonly [K in AssetKey]: K;
};
