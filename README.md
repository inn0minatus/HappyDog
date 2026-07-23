# Happy Dog Runner

A branded, mobile-first **2D browser runner** promoting a dog flea-and-tick tablet.
The player's dog auto-runs through a park, jumps obstacles, dodges **ticks**, and
collects **tablets**; the round ends in **Victory** or **Game Over** and surfaces a
**buy CTA** to [tabletki.ua](https://tabletki.ua).

> **Status: Phase 1 — Foundation & Scaffold.** The scene flow is navigable
> end-to-end (Boot → Preload → Menu → Game → Results → Menu) against **greybox
> placeholder art**. There is no real gameplay/physics yet — GameScene is a
> placeholder with temporary debug controls to reach the results screen.

## Stack

- **Phaser 3** + **TypeScript** (strict) + **Vite**
- 100% static, no backend — deploy `dist/` to any CDN (Cloudflare Pages / Netlify)
- Arcade Physics · `Scale.FIT` + `CENTER_BOTH` · fixed logical **1280×720 landscape**
- All graphics are **SVG** (one file per entity/state), loaded via `this.load.svg`

## Getting started

```bash
npm install
npm run dev          # dev server
npm run build        # production build → dist/
npm run preview      # preview the production build
npm run typecheck    # tsc --noEmit (strict type check)
npm run gen:placeholders   # regenerate the greybox SVGs from the asset list
```

## Project structure

```
index.html                 # mount + analytics snippet placeholders + viewport CSS
vite.config.ts             # static build (base './'), es2020
tsconfig.json              # strict TS, moduleResolution bundler
scripts/gen-placeholders.mts   # emits every greybox SVG (single-sourced from assetManifest)
public/assets/<folder>/*.svg    # placeholder art (dog/env/entities/vfx/ui/screens)
src/
  main.ts                  # Phaser.Game bootstrap + config
  scenes/                  # Boot → Preload → Menu → Game → Results (+ keys.ts)
  entities/                # HeroDog (placeholder; Phase 2 adds HP/physics/states)
  systems/                 # AudioManager (mute persistence + iOS unlock stub)
  ui/                      # Button factory, OrientationOverlay (rotate hint)
  analytics/               # track() adapter (GA4 + Meta Pixel), env-gated
  config/                  # gameConfig (tuning), env (VITE_*), assetManifest
  i18n/                    # strings (Ukrainian primary, i18n-ready)
```

## Configuration

Copy `.env.example` → `.env` and fill per environment. **Every var is optional** —
the app runs correctly with all unset (analytics no-ops, placeholder promo/URL).
See `src/config/env.ts`. No live IDs are hardcoded anywhere.

## Analytics

The three funnel events (`start_game`, `finish_game`, `click_buy`) go through the
single `track()` adapter (`src/analytics/track.ts`), which fans out to GA4 (`gtag`)
and Meta Pixel (`fbq`). It is safe when the pixels are absent/blocked and ships
**consent-ready** (`setAnalyticsConsent`). Real GA4/Pixel wiring lands in Phase 5.

## Assets

`src/config/assetManifest.ts` is the single shared asset contract (key · type ·
width · height · path). PreloadScene iterates it to load every SVG, and
`scripts/gen-placeholders.mts` **imports that same manifest** to emit a matching
greybox for every key (no duplicate asset list to keep in sync). **Phase 2
replaces the SVG files against the exact same keys and dimensions** — no code
changes needed.
