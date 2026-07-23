/**
 * env.ts — runtime configuration read from VITE_* env vars.
 *
 * Every value has a safe placeholder default so the app is fully correct when
 * the vars are unset (dev, previews). Real IDs/codes are injected at build time
 * via `.env` (see `.env.example`). Never hardcode live IDs here.
 */

const env = import.meta.env;

/** Immutable, resolved runtime config. */
export const ENV = {
  /** GA4 Measurement ID (e.g. "G-XXXX"). Empty → GA4 disabled. */
  ga4Id: env.VITE_GA4_ID ?? '',
  /** Meta Pixel ID. Empty → Pixel disabled. */
  fbPixelId: env.VITE_FB_PIXEL_ID ?? '',
  /** Promo code surfaced on the CTA. Placeholder until client confirms (§11). */
  promoCode: env.VITE_PROMO_CODE ?? 'DOG10',
  /** Base buy URL; UTM params appended by buildBuyUrl(). */
  buyUrl: env.VITE_BUY_URL ?? 'https://tabletki.ua',
  /** Campaign attribution (UTM). */
  utmSource: env.VITE_UTM_SOURCE ?? 'happydogrunner',
  utmMedium: env.VITE_UTM_MEDIUM ?? 'game',
  utmCampaign: env.VITE_UTM_CAMPAIGN ?? 'tick_protection',
  /** Mirror analytics events to console for QA. */
  debugAnalytics: (env.VITE_DEBUG_ANALYTICS ?? 'false') === 'true',
} as const;

/**
 * Host portion of the buy URL, used as the fixed `destination` param of the
 * click_buy event (spec §7.2). Falls back to 'tabletki.ua' if the URL is odd.
 */
export function buyDestination(): string {
  try {
    return new URL(ENV.buyUrl).host || 'tabletki.ua';
  } catch {
    return 'tabletki.ua';
  }
}

/**
 * Build the buy URL the CTA navigates to (spec §6.4). Carries BOTH the promo
 * code (as `promo=`) so it survives even if the player never copies the chip,
 * AND the UTM campaign params for attribution. The URL API guarantees a single
 * `?`, proper `&` separators, and value encoding.
 */
export function buildBuyUrl(): string {
  try {
    const url = new URL(ENV.buyUrl);
    if (ENV.promoCode) url.searchParams.set('promo', ENV.promoCode);
    if (ENV.utmSource) url.searchParams.set('utm_source', ENV.utmSource);
    if (ENV.utmMedium) url.searchParams.set('utm_medium', ENV.utmMedium);
    if (ENV.utmCampaign) url.searchParams.set('utm_campaign', ENV.utmCampaign);
    return url.toString();
  } catch {
    // Misconfigured base URL — return it untouched rather than throwing.
    return ENV.buyUrl;
  }
}
