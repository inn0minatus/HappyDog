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

// ════════════════════════════════════════════════════════════════════════════
// Phase 3 — core run-loop tuning (all [SUGGESTED]; playtest-tunable).
// These sit here (not in scene/entity code) so difficulty edits never touch logic.
// ════════════════════════════════════════════════════════════════════════════

// ── Spawn geometry ──────────────────────────────────────────────────────────
/** Entities appear this far PAST the right edge (off-screen) before scrolling in. */
export const SPAWN_MARGIN_PX = 140; // [SUGGESTED]
/** Entities are recycled to the pool once this far PAST the left edge. */
export const RECYCLE_MARGIN_PX = 260; // [SUGGESTED]

// ── Parallax scroll factors, relative to world speed (ground/path = 1.0) ──────
// Closer layers scroll faster → depth. far < near < ground < foreground grass.
export const PARALLAX_FACTOR_FAR = 0.16; // [SUGGESTED] far skyline — slowest
export const PARALLAX_FACTOR_NEAR = 0.42; // [SUGGESTED] near foliage — medium
export const PARALLAX_FACTOR_GROUND = 1.0; // [SUGGESTED] ground/path — world speed
export const PARALLAX_FACTOR_GRASS = 1.12; // [SUGGESTED] foreground grass — fastest

// ── Hero physics body — a FORGIVING hitbox smaller than the art frame ─────────
export const HERO_BODY_WIDTH = 74; // [SUGGESTED] px, centered on the frame width
export const HERO_BODY_HEIGHT = 116; // [SUGGESTED] px, anchored to the dog's feet

// ── Pooled-entity hitboxes (fraction of the art frame; forgiving to the player) ─
export const HAZARD_HITBOX_SCALE = 0.62; // [SUGGESTED] ticks/bush/puddle
export const PICKUP_HITBOX_SCALE = 0.9; // [SUGGESTED] tablets/armor — easy to grab
export const FINISH_HITBOX_WIDTH = 34; // [SUGGESTED] thin, full-height trigger band

// ── Object-pool sizes (max concurrent per type; sized > worst-case on-screen) ──
export const POOL_SIZE_HAZARD = 12; // [SUGGESTED] per hazard type
export const POOL_SIZE_TABLET = 16; // [SUGGESTED]
export const POOL_SIZE_ARMOR = 4; // [SUGGESTED]

// ── Collectible placement ─────────────────────────────────────────────────────
// Tablets/armor HOVER above the ground so the player must JUMP to collect — the
// same jump that clears ground hazards (reinforces the one-verb core loop, §3.1).
export const COLLECTIBLE_HOVER_PX = 150; // [SUGGESTED] above GROUND_TOP_Y (must-jump)
export const COLLECTIBLE_HOVER_JITTER_PX = 46; // [SUGGESTED] extra height, 0..N upward
/** Base world spacing between tablets (widened late-game by the generosity taper). */
export const TABLET_SPACING_START = 560; // [SUGGESTED] world units

// ── Hazard mix (spawn weights; higher = more frequent). Tick is the signature threat.
export const HAZARD_WEIGHT_TICK = 3; // [SUGGESTED]
export const HAZARD_WEIGHT_BUSH = 2; // [SUGGESTED]
export const HAZARD_WEIGHT_PUDDLE = 2; // [SUGGESTED]

// ── i-frame + armor visual tells ──────────────────────────────────────────────
export const INVULN_BLINK_MS = 110; // [SUGGESTED] alpha-blink cadence during i-frames
export const ARMOR_EXPIRY_TELL_MS = 1000; // [SPEC] aura flashes in the final ~1 s (§4.4)
export const ARMOR_AURA_BLINK_MS = 120; // [SUGGESTED] aura blink cadence in the tell

// ── Hit feedback ──────────────────────────────────────────────────────────────
export const HIT_SHAKE_MS = 180; // [SUGGESTED] camera shake duration on damage
export const HIT_SHAKE_INTENSITY = 0.01; // [SUGGESTED] camera shake magnitude (fraction)
export const HIT_FLASH_MS = 120; // [SUGGESTED] red flash on the dog
export const HERO_HIT_POSE_MS = 220; // [SUGGESTED] how long the dog_hit pose shows

// ── Hero animation feel (presentation tunables) ───────────────────────────────
export const HERO_RUN_TILT_DEG = 3; // [SUGGESTED] jaunty body tilt while running
export const HERO_RUN_TILT_MS = 260; // [SUGGESTED] half-cycle of the run tilt
export const HERO_JUMP_STRETCH = 0.14; // [SUGGESTED] takeoff stretch (scaleY↑/scaleX↓)
export const HERO_JUMP_STRETCH_MS = 130; // [SUGGESTED]
export const HERO_LAND_SQUASH = 0.16; // [SUGGESTED] landing squash (scaleY↓/scaleX↑)
export const HERO_LAND_SQUASH_MS = 120; // [SUGGESTED]
export const HERO_VICTORY_HOP_VELOCITY = -520; // [SUGGESTED] little victory jump (px/s)

/** Delay after the win/lose pose before handing off to ResultsScene (lets it read). */
export const RESULTS_HANDOFF_DELAY_MS = 850; // [SUGGESTED]

// ════════════════════════════════════════════════════════════════════════════
// Phase 4 — presentation layout & audio config (all [SUGGESTED]).
// The HUD/pause/audio code carries NO magic numbers; every position, size,
// colour, depth and volume lives here so layout edits never touch UI logic.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Render layering (presentation only) — shared by GameScene, Hud and
 * PauseOverlay so every layer agrees. Higher = drawn on top. The pause overlay
 * sits ABOVE the HUD; its backdrop dims everything below it.
 */
export const DEPTH = {
  bgFar: 0,
  bgNear: 1,
  ground: 2,
  grass: 3,
  entity: 5,
  hero: 6,
  aura: 7,
  hud: 100,
  pauseBackdrop: 200,
  pausePanel: 210,
  pauseContent: 220,
} as const;

/** HUD layout (top-of-screen, thumb-safe). All px at 1280×720. */
export const HUD = {
  // Level-progress bar (frame asset + a dynamic fill drawn through its window).
  progressBarWidth: 1180, // == ui_progress_bar asset width
  progressBarY: 22,
  progressFillInsetX: 5, // fill sits inside the frame border
  progressFillHeight: 8,
  progressFillColor: 0x6cc04a, // bright green — reads against the frame
  // Score row (top-left): icon + number.
  scoreIconX: 40,
  scoreRowY: 62,
  scoreTextX: 66,
  scoreFontSize: '26px',
  scoreColor: '#20272e',
  scoreStrokeColor: '#f4f7fa', // light halo for contrast over any background (a11y)
  scoreStrokeThickness: 4,
  // Hearts (below the score row). Distinguished by SHAPE+FILL in the art, not colour.
  heartStartX: 42,
  heartY: 106,
  heartSpacing: 46,
  // Top-right control cluster: mute then pause.
  pauseBtnX: 1224,
  pauseBtnY: 62,
  muteBtnX: 1148,
  muteBtnY: 62,
  frozenBtnAlpha: 0.35, // dim the pause button once the run has ended
  // Small armor tell (shield icon) shown to the right of the hearts while armored.
  armorTellX: 214,
  armorTellY: 106,
  armorTellScale: 0.62,
  armorTellPulseScale: 0.78,
  armorTellPulseMs: 340,
} as const;

/** Pause overlay layout (centered panel + stacked buttons). */
export const PAUSE = {
  backdropColor: 0x0f1418,
  backdropAlpha: 0.72,
  fadeInMs: 140,
  titleOffsetY: -118,
  titleFontSize: '40px',
  titleColor: '#20272e',
  resumeOffsetY: -40,
  restartOffsetY: 28,
  menuOffsetY: 96,
  buttonWidth: 264,
  buttonHeight: 56,
  muteOffsetX: 206,
  muteOffsetY: -128,
  muteLabelOffsetY: 34,
  muteLabelFontSize: '13px',
  muteLabelColor: '#3a444d',
} as const;

/** Placeholder-audio mix levels (0..1). */
export const AUDIO = {
  sfxVolume: 0.5,
  uiVolume: 0.4,
  musicVolume: 0.32,
} as const;

/** Promo code copy confirmation label fade duration. */
export const PROMO_COPY_FADE_MS = 1200; // [SUGGESTED]
