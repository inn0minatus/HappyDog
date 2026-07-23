/**
 * gameConfig.ts — the SINGLE SOURCE OF TRUTH for tuning constants.
 *
 * Every gameplay/tuning number lives here so playtest edits never touch scene
 * or entity logic (spec §8.2). Values are tagged:
 *   [SPEC]      — quoted exactly from the spec / brief; do not change casually.
 *   [SPEC-RANGE]— spec gives a range; the picked value sits inside it.
 *   [SUGGESTED] — spec leaves it open; this is a sensible default to tune.
 *
 * All pixel values are LOGICAL px at the fixed 1280×720 landscape resolution.
 */

// ── Logical resolution (landscape 16:9) — overrides the spec's portrait default ──
export const GAME_WIDTH = 1280; // [SPEC] canvas override: landscape 1280×720
export const GAME_HEIGHT = 720; // [SPEC] canvas override: landscape 1280×720

/** Canvas background (letterbox bars + default clear). */
export const BACKGROUND_COLOR = '#0f1418'; // [SUGGESTED]

// ── Health (spec §3.4) ──
export const MAX_HP = 3; // [SPEC] start with 3 hearts, hard cap
export const START_HP = 3; // [SPEC]
export const TICK_DAMAGE = 1; // [SPEC] tick collision = −1 HP
export const OBSTACLE_DAMAGE = 1; // [SPEC] bush/puddle = −1 HP (§11 Q10 assumption)
export const TABLET_HEAL = 1; // [SPEC] tablet = +1 HP, capped at MAX_HP
/** Post-hit invulnerability / blink window so one contact can't drain multiple HP. */
export const INVULN_MS = 1000; // [SPEC] ~1 s after damage (§3.4)

// ── Armor power-up (spec §3.7) ──
export const ARMOR_DURATION_MS = 5000; // [SPEC-RANGE] ~4–6 s total invulnerability
/** Approx. number of armor pickups that appear across one level. */
export const ARMOR_SPAWNS_PER_LEVEL = 2; // [SUGGESTED] "occasional, ~1–2/level" (§3.8)

// ── Level length & session duration (spec §3.9) ──
/**
 * Distance-based level. `LEVEL_LENGTH` is world units; HUD progress maps to
 * distance / LEVEL_LENGTH and the FinishLine spawns once at this position.
 * Tuned against the full speed ramp to land inside the 60–90 s window.
 */
export const LEVEL_LENGTH = 40000; // [SUGGESTED] ≈73 s at avg ~550 px/s (400→700 ramp mean)
/** Target active-play duration window (seconds). */
export const TARGET_DURATION_S = { min: 60, max: 90, nominal: 75 } as const; // [SPEC] ~60–90 s

// ── Physics & jump (spec §3.2) ──
export const GRAVITY_Y = 2200; // [SUGGESTED] px/s²
export const JUMP_VELOCITY_Y = -900; // [SUGGESTED] px/s → peak ~184 px, air ~0.82 s
/** Hero is pinned at this screen X (left quarter); the world scrolls past it. */
export const HERO_X = 320; // [SUGGESTED]
/** Top of the ground band (ground occupies y 580 → 720); hero feet rest here. */
export const GROUND_TOP_Y = 580; // [SUGGESTED]

// ── Difficulty ramp (spec §3.8) ──
export const SCROLL_SPEED_START = 400; // [SUGGESTED] px/s at level start
export const SCROLL_SPEED_MAX = 700; // [SUGGESTED] px/s at level end
/** Hazard spacing eases from generous → tight over the run (always jump-clearable). */
export const HAZARD_SPACING_START = 640; // [SUGGESTED] px (within 520–700)
export const HAZARD_SPACING_END = 360; // [SUGGESTED] px (within 300–420)
/** Collectible generosity multiplier applied in the final quarter of the level. */
export const LATE_GENEROSITY_FACTOR = 0.65; // [SUGGESTED] taper to ~60–70% (§3.8)

// ── Scoring (spec §3.5) ──
export const TABLET_SCORE = 100; // [SUGGESTED] per-tablet (primary source)
export const SCORE_SURVIVAL_PER_S = 10; // [SUGGESTED] survival trickle per second

/** Persistence key for the mute preference (spec §6.3). */
export const MUTE_STORAGE_KEY = 'hdr:muted'; // [SUGGESTED]
