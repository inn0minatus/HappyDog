/**
 * track.ts — the SINGLE analytics choke point (spec §7.1).
 *
 * Game code never touches gtag/fbq directly; it calls the typed `track()`
 * overloads, which fan out to GA4 (gtag) and Meta Pixel (fbq). Everything here
 * is safe when the pixels are absent/blocked (optional chaining) and gated on a
 * consent hook. Real GA4/Pixel loading is finished in Phase 5 — `initAnalytics`
 * already env-gates the loader so no live IDs are hardcoded.
 */

import { ENV } from '../config/env';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void };
    dataLayer?: unknown[];
    _fbq?: unknown;
  }
}

/** The three funnel events — names are FIXED by the brief (§3B); do not rename. */
export type AnalyticsEvent = 'start_game' | 'finish_game' | 'click_buy';

/** `start_game` — a round begins. No params required (spec §7.2). */
export type StartGameParams = Record<string, never>;

/** `finish_game` — a round ends (win OR lose) (spec §7.2). */
export interface FinishGameParams {
  result: 'win' | 'lose';
  score: number;
  /** Active play time in seconds, EXCLUDING paused time. */
  duration_s: number;
}

/** `click_buy` — the results-screen CTA was tapped (spec §7.2). */
export interface ClickBuyParams {
  destination: string;
  promo_code: string;
}

// ── Consent gate (spec §7.4) ───────────────────────────────────────────────
// The adapter ships "consent-ready": a single flag every event passes through.
// A future CMP flips it via setAnalyticsConsent(); until then it defaults to
// granted so the funnel is observable in dev/QA.
let consentGranted = true;

export function setAnalyticsConsent(granted: boolean): void {
  consentGranted = granted;
}

function hasConsent(): boolean {
  return consentGranted;
}

// ── track() — typed overloads so call sites get the right param shape ──────
export function track(event: 'start_game', params?: StartGameParams): void;
export function track(event: 'finish_game', params: FinishGameParams): void;
export function track(event: 'click_buy', params: ClickBuyParams): void;
// Implementation signature: `object` is the loosest supertype of every event's
// param shape (interfaces aren't assignable to Record<string, unknown> in TS).
export function track(event: AnalyticsEvent, params: object = {}): void {
  if (!hasConsent()) return;

  // GA4
  window.gtag?.('event', event, params);
  // Meta Pixel — custom events via trackCustom
  window.fbq?.('trackCustom', event, params);

  if (ENV.debugAnalytics) {
    // Intentional QA mirror, gated behind VITE_DEBUG_ANALYTICS.
    console.debug('[track]', event, params);
  }
}

// ── initAnalytics() — env-gated loader (called once from main.ts) ──────────
// Injects the GA4 / Pixel bootstraps ONLY when their IDs are present and consent
// is granted. With no IDs (dev/preview) this is a no-op and track() stays safe.
let initialized = false;

export function initAnalytics(): void {
  if (initialized || !hasConsent()) return;
  initialized = true;

  if (ENV.ga4Id) loadGa4(ENV.ga4Id);
  if (ENV.fbPixelId) loadPixel(ENV.fbPixelId);
}

function loadGa4(measurementId: string): void {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer ?? [];
  const gtag: (...args: unknown[]) => void = (...args) => {
    window.dataLayer?.push(args);
  };
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', measurementId);
}

function loadPixel(pixelId: string): void {
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
    }) as ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue: unknown[][];
      loaded: boolean;
      version: string;
    };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    window.fbq = fbq;
    window._fbq = window._fbq ?? fbq;

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}
