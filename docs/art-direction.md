# Happy Dog Runner — Art Bible (Phase 2, LOCKED)

The single shared art direction for all 34 final SVGs. Every asset follows this
for one coherent look. Palette is chosen to be easy to re-theme (brand kit is
still a placeholder, spec §11 #6).

## Style
Flat vector **cartoon with soft cel shading**. Clean, rounded, friendly,
family-appropriate. Per shape: 1 base tone + 1 shadow tone + optional 1
highlight. Light source **top-left**. Outlines in warm charcoal `#2E2A28`,
rounded caps/joins — ~3–4px on characters/entities, ~2px on UI, hairline/none on
large backgrounds. Subtle inline `linearGradient` allowed for skies/glows only.
No gradients-as-crutch; keep files lean.

## Palette
| Role | Hex |
|---|---|
| Sky (top → horizon) | `#8FD3F4` → `#DFF3FF` |
| Sun / warm glow | `#FFE9A8` |
| Far hills/trees / shadow | `#A9D88C` / `#8FC96F` |
| Mid foliage / shadow | `#6FBF5A` / `#549C42` |
| Foreground grass / shadow / hi | `#4E9E3E` / `#3C8130` / `#6BBF52` |
| Path/ground / shadow / pebble / dirt | `#E9C892` / `#D2A863` / `#C08E52` / `#A97440` |
| Wood/trunk / shadow | `#9B6B43` / `#7C5233` |
| Hero dog fur / shadow / cream / patch | `#F4B860` / `#E09B3C` / `#FBE8C6` / `#E08A3A` |
| Dog nose+eyes / tongue | `#2E2A28` / `#F27C7C` |
| Brand primary (teal) / dark / light | `#2FB4A0` / `#1E8C7C` / `#6FD3C4` |
| Brand secondary / CTA (coral) / dark | `#FF7A59` / `#E85B3A` |
| Accent yellow (score/coin/glow) | `#FFC93C` |
| Tablet (product) body / ring | `#FDFBF4` / `#2FB4A0` |
| Tick (enemy) body / shadow / legs / belly | `#7A5C6E` / `#5E4556` / `#4A3A44` / `#9C7C8E` |
| Heart | full `#FF6B6B` + hi `#FF9A9A`; empty = hollow, `#FF6B6B` outline + crack |
| UI panel cream / border / text | `#FFF6E6` / `#E6C88A` / `#3A2E28` |
| Soft drop shadow | `rgba(0,0,0,0.15)` |

Collar = teal `#2FB4A0` with a yellow `#FFD24A` tag.

## Characters & key motifs
- **Hero dog**: one friendly golden pup (fur `#F4B860`, cream muzzle/belly, teal
  collar + yellow tag). Same character across all 5+1 states. Always **faces
  right** (travel direction).
- **Tablet** (the product): reads clearly as a pill/tablet — cream capsule/round
  with a teal ring + subtle paw/cross mark + sparkle.
- **Tick** (enemy): cartoonish, **non-scary** — rounded plum-brown body, little
  legs, big friendly-mischievous eyes. No fangs, nothing threatening.
- **Buttons**: rounded-rect (corner ~18–24px), soft drop shadow, subtle top
  highlight. Play = teal; buy CTA = coral; secondary = cream + teal outline;
  pause/mute = round teal chips. **No baked text labels** (code renders localized
  Ukrainian text on top) — author shapes + iconography only.

## Orientation & anchors (Phase-3 contract)
- Landscape 1280×720. Dog & ground entities **face right**, stand on an implied
  ground line at the **bottom edge** of their viewBox, horizontally centered →
  Phase 3 anchors **bottom-center**.
- Parallax `park_bg_far` / `park_bg_near` / `park_fg_grass` and `ground_tile`
  MUST be **horizontally seamless** (left edge continues into right; no motif
  clipped at x=0 or x=W) — they scroll via tileSprite.
- `ui_progress_bar`: author only the **frame/track**; inner fill area is
  **transparent** (code draws the dynamic fill on top).
- Hearts distinguishable by **shape + fill**, not colour alone (accessibility).

## Tech
Self-contained SVG (no external refs/fonts/`<image>`/http). `viewBox="0 0 W H"`
matching the exact manifest dimensions. Lean files. `dog_armored` is distinct art
(dog_run stance + translucent teal energy shield), not a runtime tint.
