# Happy Dog Runner

A branded, **mobile-first 2D browser runner** — an advergame promoting a dog
flea-and-tick tablet. The hero dog auto-runs through a park, jumps obstacles,
dodges **ticks**, and collects **tablets**. A finite ~60–90 s level ends in
**Victory** (reach the finish line) or **Game Over** (lose all 3 HP), and both
results screens surface a single **buy CTA** that carries a promo code and links
to [tabletki.ua](https://tabletki.ua). The gameplay is the vehicle; the marketing
funnel (`start_game` → `finish_game` → `click_buy`) is the point.

> **Status: Phase 5 — launch candidate.** Core run loop, UI/HUD/audio, and the
> analytics + CTA + deploy tooling are all in place against final SVG art.

## Stack

- **Phaser 3** + **TypeScript** (strict) + **Vite**
- 100% **static**, **no backend** — ship `dist/` to any static host
- Arcade Physics · `Scale.FIT` + `CENTER_BOTH` · fixed logical **1280×720 landscape**
- Graphics are **SVG only** (one file per entity/state), loaded via `this.load.svg`
- Audio is **synthesized at runtime** into WAV blobs (zero network, fully static-hostable) as placeholder SFX/music

## Run

```bash
npm install
npm run dev          # local dev server (Vite)
npm run build        # production build → dist/
npm run preview      # serve the built dist/ locally
npm run typecheck    # tsc --noEmit (strict) — keep green
```

## Configuration

Copy `.env.example` → `.env` (or `.env.local`) and fill per environment. **Every
var is optional** — with none set, or with the example placeholders left in, the
app builds and runs correctly and **analytics is a safe no-op** (no vendor script
loads, no network request, no console error). Resolved in `src/config/env.ts`.

| Var | What it is | Client supplies |
|---|---|---|
| `VITE_GA4_ID` | GA4 Measurement ID (`G-XXXXXXXXXX`). Placeholder/empty → GA4 disabled | Real `G-…` from their GA4 property |
| `VITE_FB_PIXEL_ID` | Meta Pixel ID (15-digit numeric). All-zeros/empty → Pixel disabled | Real id from Events Manager |
| `VITE_PROMO_CODE` | Promo code shown & copyable on the CTA, also appended to the buy URL as `promo=` | Real code (default `DOG10` is a placeholder) |
| `VITE_BUY_URL` | Base buy URL the CTA opens (`promo=` + UTM appended at runtime by `buildBuyUrl()`) | Exact tabletki.ua product page |
| `VITE_UTM_SOURCE` | UTM source appended to the buy URL | Per campaign (default `happydogrunner`) |
| `VITE_UTM_MEDIUM` | UTM medium appended to the buy URL | Per campaign (default `game`) |
| `VITE_UTM_CAMPAIGN` | UTM campaign appended to the buy URL | Per campaign (default `tick_protection`) |
| `VITE_DEBUG_ANALYTICS` | `"true"` mirrors every `track()` call to `console.debug` for QA | n/a (default off) |

## Analytics

All tracking goes through the single `track()` adapter in `src/analytics/track.ts`
— game code never calls `gtag`/`fbq` directly. The three funnel events (names are
fixed by the brief, do not rename):

| Event | Params | Fires from |
|---|---|---|
| `start_game` | _(none)_ | `GameScene`, once as the run begins |
| `finish_game` | `result` (`win`\|`lose`), `score`, `duration_s` (active play, paused time excluded) | `GameScene`, on Victory **or** Game Over |
| `click_buy` | `destination`, `promo_code` | `ResultsScene`, when the buy CTA is tapped (then opens the buy URL in a new tab) |

Each event is dispatched to **GA4** (`gtag('event', …)`) and **Meta Pixel**
(`fbq('trackCustom', …)`) — but **only when a real (non-empty, non-placeholder)
ID is configured AND consent is granted** (`setAnalyticsConsent`, defaults to
granted). Vendor scripts are injected at runtime by `initAnalytics()` only then;
absent/blocked pixels never throw (`typeof`-guarded), so the game is fully
playable with ad-blockers on.

## Deploy to GitHub Pages (no CI, zero Actions minutes)

This repo ships **without any GitHub Actions workflow** — deploy is a **local
build + push to the `gh-pages` branch**, served by Pages' built-in
"Deploy from a branch" pipeline. That uses **zero Actions minutes**.

**One-time setup** (repo → Settings → Pages):
- **Source:** `Deploy from a branch`
- **Branch:** `gh-pages` / folder: `/` (root)

**Then publish:**
```bash
npm run deploy
```
This runs `vite build`, then publishes `dist/` to the `gh-pages` branch via the
[`gh-pages`](https://www.npmjs.com/package/gh-pages) package
(`gh-pages -d dist -t`; the `-t`/`--dotfiles` flag ensures `.nojekyll` is pushed).

Two things make this work:
- `public/.nojekyll` (empty) is copied into the `dist/` root, telling GitHub Pages
  to **serve `dist/assets/` without Jekyll processing** (otherwise underscored /
  generated asset paths can be dropped).
- **Vite `base` is `'/HappyDog/'`** (a project-page sub-path, not `/`). Vite
  rewrites the processed asset/script URLs to that prefix, and `PreloadScene`
  prefixes the runtime SVG URLs with `import.meta.env.BASE_URL` — so everything
  resolves under the sub-path instead of 404-ing at the domain root.

**Live URL:** <https://inn0minatus.github.io/HappyDog/>
**Repo:** `git@github.com:inn0minatus/HappyDog.git`

## Customizing assets

**Branded audio** — replace the synthesized placeholders with real files via
`scene.load.audio(key, ['x.m4a', 'x.ogg'])` under the **same keys** in
`src/systems/audio.ts` (`registerAudio`). Nothing else changes — playback already
runs through the shared `scene.sound`, so the persisted mute
(`localStorage` `hdr:muted`) and the iOS first-gesture unlock apply automatically.
Keys: SFX `sfx_jump`, `sfx_hit`, `sfx_tablet`, `sfx_armor`, `sfx_victory`,
`sfx_defeat`, `sfx_ui`; music `music_menu`, `music_game`.

**Final art / brand** — art is SVG at `public/assets/<group>/<key>.svg`
(groups: `dog`, `env`, `entities`, `vfx`, `ui`, `screens`). The single contract of
keys + logical dimensions is `src/config/assetManifest.ts`. Replace files at those
exact keys; for any new/edited asset or a re-theme, follow the locked palette &
style in `docs/art-direction.md`.

> ⚠️ **Do not run `npm run gen:placeholders`** now that final art exists — it
> regenerates the Phase-1 greybox from the manifest and **clobbers the finals**.

## Still client-dependent (spec §11)

These block a firm cost/timeline and must be confirmed before launch:

- **Performance KPIs** — proposed budget (§2.3): ≤3 s TTI on 4G, 60 FPS mid-range /
  ≥30 FPS floor on low-end, ≤4–6 MB gzipped initial download.
- **Final promo code + exact tabletki.ua landing URL** (currently placeholder
  `DOG10` and `https://tabletki.ua`).
- **GA4 Measurement ID + Meta Pixel ID** (env vars above).
- **Brand assets** — logo, colors, product imagery (placeholders until brand kit).
- **Environment theme** — park is assumed; the brief offered park / forest / city avenue.
- **UI language & i18n** — Ukrainian primary, built i18n-ready (`src/i18n/strings.ts`).

## Pre-launch on-device checks

These need a **real device** and are **not blockers**, but should be done before
launch:

- **(a) Visual playtest + `gameConfig` tuning.** Jump feel, hitbox fairness, hazard
  density, and parallax all live as constants in `src/config/gameConfig.ts` —
  e.g. `HAZARD_SPACING_START`/`HAZARD_SPACING_END`, `COLLECTIBLE_HOVER_PX`,
  `HERO_BODY_WIDTH`/`HERO_BODY_HEIGHT`, and the parallax factors
  (`PARALLAX_FACTOR_FAR`/`_NEAR`/`_GROUND`/`_GRASS`) — watch the parallax **seam**
  between layers on a real screen.
- **(b) iOS / mobile audio-unlock.** Web Audio is suspended until the first user
  gesture, so **menu music can't autoplay before the first tap — by design.**
  Verify silence before the first gesture and correct audio after it; confirm a
  muted player who taps Play stays muted.
