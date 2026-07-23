/**
 * strings.ts — tiny i18n layer. Ukrainian is the primary locale (spec §11 Q4);
 * adding a locale is just another entry in STRINGS. `t(key)` looks up the
 * current locale, falls back to Ukrainian, and supports `{var}` interpolation.
 */

export type Locale = 'uk' | 'en';

const DEFAULT_LOCALE: Locale = 'uk';
let currentLocale: Locale = DEFAULT_LOCALE;

/**
 * Ukrainian dictionary — the authoritative key set. Every UI string used by any
 * scene (incl. the rotate-device hint) lives here.
 */
const uk = {
  // Loading
  loading: 'Завантаження…',

  // Menu
  menu_title: 'Щасливий Пес',
  menu_subtitle: 'Забіг парком',
  menu_play: 'Грати',
  menu_hint: 'Тапни, щоб стрибнути — уникай кліщів!',
  menu_sound_on: 'Звук: увімкнено',
  menu_sound_off: 'Звук: вимкнено',

  // HUD
  hud_score: 'Рахунок',

  // Game (Phase-1 temporary debug controls)
  game_debug_hint: 'ДЕМО: завершити забіг →',
  game_debug_win: '🏁 Перемога (демо)',
  game_debug_lose: '☠ Поразка (демо)',

  // Results
  results_victory_title: 'Ти впорався! 🐕',
  results_gameover_title: 'Кліщі тебе наздогнали…',
  results_score: 'Рахунок: {score}',
  results_promo_label: 'Промокод:',
  results_cta: 'Купити на tabletki.ua',
  results_play_again: 'Грати ще раз',
  results_menu: 'На головну',

  // Orientation guard
  rotate_title: 'Поверни пристрій',
  rotate_body: 'Гра працює горизонтально 📱↻',
} as const;

/** Every valid string key (derived from the Ukrainian dictionary). */
export type StringKey = keyof typeof uk;

/** Optional partial overrides for other locales; missing keys fall back to `uk`. */
const en: Partial<Record<StringKey, string>> = {
  loading: 'Loading…',
  menu_title: 'Happy Dog',
  menu_subtitle: 'Park Run',
  menu_play: 'Play',
  menu_hint: 'Tap to jump — dodge the ticks!',
  menu_sound_on: 'Sound: on',
  menu_sound_off: 'Sound: off',
  hud_score: 'Score',
  game_debug_hint: 'DEMO: finish run →',
  game_debug_win: '🏁 Victory (demo)',
  game_debug_lose: '☠ Defeat (demo)',
  results_victory_title: 'You made it! 🐕',
  results_gameover_title: 'The ticks got you…',
  results_score: 'Score: {score}',
  results_promo_label: 'Promo code:',
  results_cta: 'Buy on tabletki.ua',
  results_play_again: 'Play again',
  results_menu: 'Main menu',
  rotate_title: 'Rotate your device',
  rotate_body: 'This game plays in landscape 📱↻',
};

const STRINGS: Record<Locale, Partial<Record<StringKey, string>>> = { uk, en };

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Translate `key` for the current locale. Falls back to Ukrainian for any key
 * missing in the active locale. `vars` fills `{name}` placeholders.
 */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  // `uk[key]` is always a string (concrete dictionary), so the result is too.
  let out: string = STRINGS[currentLocale][key] ?? uk[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.split(`{${name}}`).join(String(value));
    }
  }
  return out;
}
